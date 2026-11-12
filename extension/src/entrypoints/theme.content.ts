/**
 * Theme engine content script.
 *
 * - document_start: style lands before first paint where possible
 * - ONE <style> tag for everything (AGENTS.md contract): created once,
 *   then only textContent is swapped on changes
 * - live restyle via storage watch — toggles apply without page reload
 *
 * Known limitation, tracked in a follow-up issue: first application is an
 * async storage read, so a brief flash of the site's own theme is possible
 * on cold navigation. Fix (SW-cached sync read) comes next.
 */

import { getSettingsStore } from '@/shared/storage'
import { buildThemeCss } from '@/shared/theme-css'

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    let styleEl: HTMLStyleElement | undefined

    const apply = async () => {
      try {
        const settings = await getSettingsStore().load()
        const css = buildThemeCss(settings.global)

        if (css === null) {
          styleEl?.remove()
          styleEl = undefined
          return
        }

        if (styleEl === undefined) {
          styleEl = document.createElement('style')
          styleEl.dataset.themepark = 'theme'
          ;(document.head ?? document.documentElement).appendChild(styleEl)
        }
        styleEl.textContent = css
      } catch (error) {
        // Restricted pages (chrome://, etc.) can throw in unexpected ways —
        // degrade gracefully, never break the host page (AGENTS.md).
        console.warn('[ThemePark] theme apply skipped:', error)
      }
    }

    void apply()
    getSettingsStore().watch(() => void apply())
  },
})
