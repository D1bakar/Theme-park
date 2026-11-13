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
 * AMOLED anti-reflective dark — the one theme. TOTAL antireflection:
 * the whole screen goes matte, not just some surfaces.
 *
 * Anti-reflective = every glare source removed, like a matte screen:
 * - True #000000 EVERYWHERE: a blanket background-color takeover kills every
 *   light surface (buttons, cards, table cells, inline styles) — not just
 *   known panels. Blanket *plain-color* rules are compositor-cheap; the
 *   perf ban (AGENTS.md) is on blanket backdrop-filter, still enforced.
 * - Uniform #d4d4d4 text: every glyph at ~83% luminance — no white text
 *   blooms on OLED anywhere.
 * - Glow removal: box-shadow and text-shadow blanketed away; hairlines
 *   forced dark instead of light.
 * - Images (and svg artwork) pulled down to 82% when dimImages is on.
 *
 * Known boundary (honest): a photo painted via `background-image` cannot be
 * selectively dimmed — CSS has no selector for "element that has one".
 * img/video-adjacent content dims; CSS-background photos stay full-bright.
 *
 * Solid colors only: no backdrop-filter, no JS color rewriting, no loops.
 */
export function buildAmoledCss(): string {
  return [
    ':root{--tp-bg:#000000;--tp-fg:#d4d4d4}',
    'html,body{background-color:#000000!important;color:#d4d4d4!important}',
    'html{color-scheme:dark}',
    // The blanket takeover — every surface, pseudo-element included.
    '*,*::before,*::after{background-color:#000000!important;color:#d4d4d4!important;border-color:#1f1f1f!important;box-shadow:none!important;text-shadow:none!important}',
    // Links keep one accent (specificity beats the blanket `*` naturally).
    'a{color:#86a8ff!important}',
    // Inputs' caret stays visible on black.
    'input,textarea{caret-color:#d4d4d4!important}',
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
      // White-filled SVG artwork (icons, logos) glares the same way.
      rules.push('svg{opacity:.82!important}')
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
