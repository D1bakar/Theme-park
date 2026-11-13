/**
 * Theme engine content script.
 *
 * - document_start: style lands before first paint where possible
 * - ONE <style> tag for everything (AGENTS.md contract): created once,
 *   then only textContent is swapped on changes
 * - live restyle via storage watch — toggles apply without page reload
 *
 * Anti-flash (issue #10): the product default is AMOLED on, so a
 * synchronous black guess is painted on <html> at document_start — before
 * any async storage read can resolve. Cold navigations therefore never
 * flash white. The guess is reconciled the moment real settings arrive:
 * if the theme is on, the stylesheet covers it and the guess is cleared;
 * if off, the guess is cleared and the site's own look returns.
 *
 * Adaptive glare (issue #42, #50): when the glare setting is `auto`, the
 * text luminance follows the light around the screen — AmbientLightSensor
 * lux where the browser exposes it, local time as the fallback. Readings
 * pass through hysteresis and a three-sample debounce so clouds and passing
 * shadows do not flicker the whole page.
 *
 * Accessibility back-off (issue #50): forced-colors means the OS palette
 * wins. ThemePark injects nothing and paints no black guess, so it never
 * fights Windows High Contrast. prefers-contrast: more maps to the
 * brightest (sunlight) tone, because the user explicitly asked for maximum
 * contrast.
 */

import type { GlareState } from '@/shared/ambient'
import { nextGlare, resolveGlare, settleGlare } from '@/shared/ambient'
import { createGradientNeutralizer, type GradientNeutralizer } from '@/shared/gradient-scan'
import type { GlobalSettings } from '@/shared/schema'
import { getSettingsStore } from '@/shared/storage'
import { buildThemeCss } from '@/shared/theme-css'

/** The slice of AmbientLightSensor we use. Not in lib.dom on all TS. */
interface AmbientLightSensorLike {
  illuminance: number | null
  addEventListener(type: 'reading', listener: () => void): void
  start(): void
  stop(): void
}
type AmbientLightSensorCtor = new (options?: { frequency?: number }) => AmbientLightSensorLike

/** Re-evaluate the clock fallback every 10 minutes — negligible cost. */
const HOUR_RECHECK_MS = 10 * 60 * 1000

export default defineContentScript({
  matches: ['<all_urls>'],
  // Whole-screen antireflection includes embedded frames: a white iframe is
  // a bright rectangle the top document's stylesheet can never reach.
  allFrames: true,
  matchAboutBlank: true,
  matchOriginAsFallback: true,
  runAt: 'document_start',
  main() {
    let styleEl: HTMLStyleElement | undefined
    let current: GlobalSettings | null = null
    let lux: number | null = null
    let sensorTried = false
    let sensor: AmbientLightSensorLike | null = null
    let hourTimer: number | undefined
    let gradient: GradientNeutralizer | null = null

    // The level actually painted on the page. Sensor readings are debounced
    // through `settleGlare`; the clock fallback sets it directly.
    let glare: GlareState = { level: 'indoor', candidate: null, samples: 0 }

    const forcedColorsQuery = window.matchMedia('(forced-colors: active)')
    const contrastQuery = window.matchMedia('(prefers-contrast: more)')
    let forcedColors = forcedColorsQuery.matches
    let highContrast = contrastQuery.matches

    const docEl = document.documentElement
    // Skip the anti-flash guess when the OS high-contrast palette owns the
    // page: painting black first would be a visible fight we cannot win.
    if (!forcedColors) docEl.style.backgroundColor = '#000'
    const clearGuess = () => {
      docEl.style.backgroundColor = ''
    }

    /** The glare level to compile, including the contrast override. */
    const effectiveGlare = () => (highContrast ? 'sunlight' : glare.level)

    /** Enables or disables gradient neutralisation with the AMOLED theme. */
    const syncGradient = (active: boolean) => {
      if (active) {
        gradient ??= createGradientNeutralizer(document)
        gradient.enable()
      } else {
        gradient?.disable()
      }
    }

    /** Compiles and applies the current settings at the current glare level. */
    const render = () => {
      if (current === null) return
      try {
        // Forced colors: hand the page back to the OS palette entirely.
        const active = current.theme === 'amoled' && !forcedColors
        const css = active ? buildThemeCss(current, effectiveGlare()) : null

        if (css === null) {
          styleEl?.remove()
          styleEl = undefined
          clearGuess() // power switch (or OS palette) owns the page now
          syncGradient(false)
          return
        }

        if (styleEl === undefined) {
          styleEl = document.createElement('style')
          styleEl.dataset.themepark = 'theme'
          ;(document.head ?? document.documentElement).appendChild(styleEl)
        }
        // Sensor readings arrive ~1×/s; identical CSS must not invalidate
        // style on every tick.
        if (styleEl.textContent !== css) styleEl.textContent = css
        clearGuess() // stylesheet now owns the colors (html bg is in the CSS)
        syncGradient(true)
      } catch (error) {
        // Restricted pages (chrome://, etc.) can throw in unexpected ways —
        // degrade gracefully, never break the host page (AGENTS.md).
        clearGuess()
        console.warn('[ThemePark] theme apply skipped:', error)
      }
    }

    /**
     * Starts the ambient sensor once, if the browser exposes it. A reading
     * only updates the cached lux and re-renders; the sensor stays local.
     */
    const ensureSensor = () => {
      if (sensorTried) return
      sensorTried = true
      const ctor = (globalThis as { AmbientLightSensor?: AmbientLightSensorCtor })
        .AmbientLightSensor
      if (typeof ctor !== 'function') return
      try {
        const created = new ctor({ frequency: 1 })
        sensor = created
        created.addEventListener('reading', () => {
          const value = created.illuminance
          if (typeof value !== 'number' || !Number.isFinite(value)) return
          lux = value
          if (current?.glare !== 'auto') return
          // Hysteresis decides where the light is trying to go; the debounce
          // requires it to hold for several readings before repainting.
          const target = nextGlare(glare.level, value)
          const next = settleGlare(glare, target)
          const changed = next.level !== glare.level
          glare = next
          if (changed) render()
        })
        created.start()
      } catch {
        // Permission policy, flag off, or no hardware: the clock fallback
        // already covers this page — no warning, no user-visible failure.
        sensor = null
      }
    }

    /**
     * Clock fallback, used only while no sensor reading exists. The hour
     * moves slowly, so this level applies immediately — no debounce.
     */
    const refreshClock = () => {
      if (current?.glare !== 'auto' || lux !== null) return
      glare = {
        level: resolveGlare('auto', null, new Date().getHours()),
        candidate: null,
        samples: 0,
      }
      render()
    }

    /** Clock fallback needs to notice the hour changing on a long-lived tab. */
    const ensureHourTimer = () => {
      if (hourTimer !== undefined) return
      hourTimer = window.setInterval(refreshClock, HOUR_RECHECK_MS)
    }

    /** Starts or stops the ambient machinery to match the current settings. */
    const syncAmbient = () => {
      const wanted =
        current !== null && current.theme === 'amoled' && current.glare === 'auto' && !forcedColors
      if (wanted) {
        ensureSensor()
        ensureHourTimer()
        return
      }
      sensor?.stop()
      sensor = null
      sensorTried = false
      if (hourTimer !== undefined) {
        window.clearInterval(hourTimer)
        hourTimer = undefined
      }
    }

    /** Reacts to OS accessibility preferences without a reload. */
    const syncMedia = () => {
      forcedColors = forcedColorsQuery.matches
      highContrast = contrastQuery.matches
      syncAmbient()
      render()
    }

    const apply = async () => {
      try {
        const settings = await getSettingsStore().load()
        current = settings.global
        // Any settings change restarts glare from a known level: a manual
        // choice must not inherit a half-finished sensor candidate.
        glare = {
          level: resolveGlare(
            current.glare,
            current.glare === 'auto' ? lux : null,
            new Date().getHours(),
          ),
          candidate: null,
          samples: 0,
        }
        syncAmbient()
        render()
      } catch (error) {
        // Storage or restricted-page failure: degrade gracefully, never
        // break the host page (AGENTS.md).
        clearGuess()
        console.warn('[ThemePark] theme apply skipped:', error)
      }
    }

    void apply()
    getSettingsStore().watch(() => void apply())
    forcedColorsQuery.addEventListener('change', syncMedia)
    contrastQuery.addEventListener('change', syncMedia)
    // Laptops sleep; timers pause. Re-evaluate when the tab wakes up.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshClock()
    })
  },
})
