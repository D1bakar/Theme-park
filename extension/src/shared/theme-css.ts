/**
 * Theme CSS compiler — settings → one CSS string (or null for "inject
 * nothing"). Pure function: no DOM, no chrome, fully unit-testable.
 *
 * Contract (AGENTS.md): the content script injects the result as exactly
 * ONE <style> tag, never per-element styles.
 *
 * The product is ONE theme — AMOLED anti-reflective dark. There are no
 * other themes to compile. `auto` (power switch off) injects nothing:
 * the site's own scheme wins.
 */

import type { GlobalSettings, ThemeMode } from './schema'

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

/**
 * Bounded panel set: body's direct children, landmarks, and known framework
 * app roots (plus one level inside — React/Next/Vue/Gatsby bury the visible
 * container there). Solid-color rules on this set are cheap; the set is
 * bounded so pages never melt (perf budget, AGENTS.md).
 */
export const PANEL_CONTAINERS =
  'body>div,body>main,body>header,body>footer,body>nav,body>section,body>article,body>aside,' +
  'body>#root,body>#app,body>#__next,body>#___gatsby,' +
  'body>#root>div,body>#app>div,body>#__next>div,body>#___gatsby>div'

/**
 * AMOLED anti-reflective dark — the one theme.
 *
 * Anti-reflective = every glare source removed, like a matte screen:
 * - True #000000 on the root AND the bounded panel set (OLED pixels fully
 *   off; gray panels are the classic AMOLED-mode failure).
 * - Text luminance ~83% (#d4d4d4): pure white on black blooms and reads as
 *   glare on OLED — the standard anti-halation tuning.
 * - Dimmed link tone; tuned selection color.
 *
 * Solid colors only: no backdrop-filter, no blanket `*` selectors.
 */
export function buildAmoledCss(): string {
  return [
    ':root{--tp-bg:#000000;--tp-fg:#d4d4d4}',
    'html,body{background-color:var(--tp-bg)!important;color:var(--tp-fg)!important}',
    'html{color-scheme:dark}',
    `${PANEL_CONTAINERS}{background-color:#000000!important}`,
    'a{color:#86a8ff!important}',
    '::selection{background:#1a3a6a!important;color:#e8e8e8}',
  ].join('')
}

/**
 * Builds the full CSS for a GlobalSettings. Defensive clamping is repeated
 * here on purpose: normalizeSettings already clamps, but this function may
 * be fed values from anywhere, and CSS-injection must never trust input.
 */
export function buildThemeCss(g: GlobalSettings): string | null {
  const rules: string[] = []

  if (g.theme === 'amoled') {
    rules.push(buildAmoledCss())
    if (g.dimImages) {
      // The anti-glare of antireflective: bright photos are the biggest
      // glare source on OLED in the dark. Images only — filters on video
      // cost composite layers for little gain (perf budget).
      rules.push('img{filter:brightness(.82)!important}')
    }
  }

  if (g.fontSize !== 100) {
    // Two-pronged: `:root` scales rem-based sites; `body !important` scales
    // sites that size text in px but inherit body's font-size.
    rules.push(`html{font-size:${clamp(g.fontSize, 80, 200)}%}`)
    rules.push(`body{font-size:${clamp(g.fontSize, 80, 200)}%!important}`)
  }

  if (g.lineHeight !== 0) {
    rules.push(`body{line-height:${clamp(g.lineHeight, 1, 2)}!important}`)
  }

  if (g.maxWidthCh !== 0) {
    rules.push(`body{max-width:${clamp(g.maxWidthCh, 40, 100)}ch;margin-inline:auto}`)
  }

  if (g.animations === 'off') {
    rules.push('*,*::before,*::after{animation:none!important;transition:none!important}')
    rules.push('html{scroll-behavior:auto!important}')
  }

  if (g.smoothScroll && g.animations !== 'off') {
    rules.push('html{scroll-behavior:smooth}')
  }

  if (rules.length === 0) return null
  return rules.join('')
}
