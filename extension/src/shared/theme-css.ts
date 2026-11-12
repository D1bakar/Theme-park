/**
 * Theme CSS compiler — settings → one CSS string (or null for "inject
 * nothing"). Pure function: no DOM, no chrome, fully unit-testable.
 *
 * Contract (AGENTS.md): the content script injects the result as exactly
 * ONE <style> tag, never per-element styles.
 *
 * Honest scope for M1 (documented, not hidden): this applies theme colors to
 * the page root (html/body) and typography globals. It does NOT re-theme
 * every site's internal panels — that needs per-site heuristics and lands
 * in M2+. `auto` mode injects no colors: the site's own color-scheme wins.
 */

import type { GlobalSettings, ThemeMode } from './schema'

interface Palette {
  bg: string
  fg: string
  scheme: 'dark' | 'light'
}

const PALETTES: Record<Exclude<ThemeMode, 'auto' | 'glass'>, Palette> = {
  light: { bg: '#ffffff', fg: '#1a1a1a', scheme: 'light' },
  dark: { bg: '#121212', fg: '#e8e8e8', scheme: 'dark' },
  amoled: { bg: '#000000', fg: '#f0f0f0', scheme: 'dark' },
}

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

/**
 * Glass-mode CSS — iOS/macOS liquid-glass language: a fixed gradient
 * "wallpaper" behind the page, frosted translucent surfaces with backdrop
 * blur and specular highlights.
 *
 * PERF GUARD: backdrop-filter applies ONLY to body's direct children and
 * landmarks — a bounded set (usually < 15 elements). Never a blanket
 * `*` selector; unbounded backdrop-filter melts complex pages and blows
 * the perf budget (AGENTS.md).
 */
export function buildGlassCss(): string {
  return [
    ':root{--tp-fg:#f5f5f7;--tp-glass:rgba(255,255,255,.055);--tp-glass-border:rgba(255,255,255,.14)}',
    'html,body{background:transparent!important;color:var(--tp-fg)!important}',
    'html{color-scheme:dark}',
    // Wallpaper sits under all content; `fixed` keeps it stable on scroll.
    'body::before{content:"";position:fixed;inset:0;z-index:-2;background:linear-gradient(160deg,#0a0e18,#141b2e 45%,#1b1030)}',
    // Frosted surfaces: bounded selector set (direct children + landmarks).
    'body>div,body>main,body>header,body>footer,body>nav,body>section,body>article,body>aside{background-color:var(--tp-glass)!important;backdrop-filter:blur(22px) saturate(1.4);-webkit-backdrop-filter:blur(22px) saturate(1.4);border:1px solid var(--tp-glass-border);border-radius:18px;box-shadow:inset 0 1px rgba(255,255,255,.28),inset 0 -1px rgba(255,255,255,.05)}',
    // Buttery: gentle color transitions, composited properties only.
    'body>div,body>main,body>header,body>footer,body>nav{transition:background-color .35s cubic-bezier(.32,.72,0,1),color .35s cubic-bezier(.32,.72,0,1)}',
    // A11y: OS-level "less transparency" preference gets solid glass.
    '@media (prefers-reduced-transparency:reduce){body>div,body>main,body>header,body>footer,body>nav,body>section,body>article,body>aside{background-color:#12141c!important;backdrop-filter:none;-webkit-backdrop-filter:none}}',
  ].join('')
}

/**
 * Builds the full CSS for a GlobalSettings. Defensive clamping is repeated
 * here on purpose: normalizeSettings already clamps, but this function may
 * be fed values from anywhere, and CSS-injection must never trust input.
 */
export function buildThemeCss(g: GlobalSettings): string | null {
  const rules: string[] = []

  if (g.theme === 'glass') {
    rules.push(buildGlassCss())
  } else if (g.theme !== 'auto') {
    const p = PALETTES[g.theme]
    rules.push(`:root{--tp-bg:${p.bg};--tp-fg:${p.fg}}`)
    rules.push('html,body{background-color:var(--tp-bg)!important;color:var(--tp-fg)!important}')
    rules.push(`html{color-scheme:${p.scheme}}`)
  }

  if (g.fontSize !== 100) {
    // Two-pronged: `:root` scales rem-based sites; `body !important` scales
    // sites that size text in px but inherit body's font-size. Neither
    // approach catches every site — the remaining gap is per-site rules (M2).
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
