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
 */

import { getSettingsStore } from '@/shared/storage'
import { buildThemeCss } from '@/shared/theme-css'

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    let styleEl: HTMLStyleElement | undefined

    const docEl = document.documentElement
    docEl.style.backgroundColor = '#000'
    const clearGuess = () => {
      docEl.style.backgroundColor = ''
    }

    const apply = async () => {
      try {
        const settings = await getSettingsStore().load()
        const css = buildThemeCss(settings.global)

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
        styleEl.textContent = css
        clearGuess() // stylesheet now owns the colors (html bg is in the CSS)
      } catch (error) {
        // Restricted pages (chrome://, etc.) can throw in unexpected ways —
        // degrade gracefully, never break the host page (AGENTS.md).
        clearGuess()
        console.warn('[ThemePark] theme apply skipped:', error)
      }
    }

    void apply()
    getSettingsStore().watch(() => void apply())
  },
})
