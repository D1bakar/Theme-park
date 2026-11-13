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
 * Adaptive glare (issue #42): when the glare setting is `auto`, the text
 * luminance follows the light around the screen — AmbientLightSensor lux
 * where the browser exposes it, local time as the fallback. The sensor is
 * permissionless, read-only, and entirely local; if it is missing or
 * throws, the clock path takes over silently.
 */

import { resolveGlare } from '@/shared/ambient'
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

    const docEl = document.documentElement
    docEl.style.backgroundColor = '#000'
    const clearGuess = () => {
      docEl.style.backgroundColor = ''
    }

    /** Compiles and applies the current settings at the current glare level. */
    const render = () => {
      if (current === null) return
      try {
        const glare = resolveGlare(current.glare, lux, new Date().getHours())
        const css = buildThemeCss(current, glare)

        if (css === null) {
          styleEl?.remove()
          styleEl = undefined
          clearGuess() // power switch is off — give the page back its own look
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
          if (typeof value === 'number' && Number.isFinite(value)) {
            lux = value
            render()
          }
        })
        created.start()
      } catch {
        // Permission policy, flag off, or no hardware: the clock fallback
        // already covers this page — no warning, no user-visible failure.
        sensor = null
      }
    }

    /** Clock fallback needs to notice the hour changing on a long-lived tab. */
    const ensureHourTimer = () => {
      if (hourTimer !== undefined) return
      hourTimer = window.setInterval(() => {
        if (current?.glare === 'auto') render()
      }, HOUR_RECHECK_MS)
    }

    /** Starts or stops the ambient machinery to match the current settings. */
    const syncAmbient = () => {
      const wanted = current !== null && current.theme === 'amoled' && current.glare === 'auto'
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

    const apply = async () => {
      try {
        const settings = await getSettingsStore().load()
        current = settings.global
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
    // Laptops sleep; timers pause. Re-evaluate when the tab wakes up.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && current?.glare === 'auto') render()
    })
  },
})
