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

const PALETTES: Record<Exclude<ThemeMode, 'auto' | 'glass' | 'amoled'>, Palette> = {
  light: { bg: '#ffffff', fg: '#1a1a1a', scheme: 'light' },
  dark: { bg: '#121212', fg: '#e8e8e8', scheme: 'dark' },
}

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

/**
 * Glass-mode CSS v3 — "designed, not sprayed". macOS Sonoma language:
 * a fixed gradient wallpaper, page containers reduced to a whisper of tint
 * (NO blur, NO borders — that was the v0.3 slop), and vibrancy reserved for
 * chrome-like surfaces only (header/nav/aside + ARIA landmarks), which is
 * how macOS itself works: chrome frosts, content stays clean.
 *
 * PERF GUARD: backdrop-filter applies ONLY to the bounded chrome surface
 * set. Never a blanket `*` selector; unbounded backdrop-filter melts
 * complex pages and blows the perf budget (AGENTS.md).
 */
export const GLASS_CONTAINERS =
  'body>div,body>main,body>header,body>footer,body>nav,body>section,body>article,body>aside,' +
  'body>#root,body>#app,body>#__next,body>#___gatsby,' +
  'body>#root>div,body>#app>div,body>#__next>div,body>#___gatsby>div'

export const GLASS_CHROME_ROOTS = 'body,body>#root,body>#app,body>#__next,body>#___gatsby'

export const GLASS_CHROME = `:is(${GLASS_CHROME_ROOTS})>:is(header,nav,aside,[role="banner"],[role="navigation"],[role="complementary"])`

export function buildGlassCss(): string {
  return [
    ':root{--tp-fg:#f5f5f7;--tp-glass:rgba(255,255,255,.04)}',
    'html,body{background:transparent!important;color:var(--tp-fg)!important}',
    'html{color-scheme:dark}',
    // Sonoma wallpaper: base diagonal gradient + two soft light glows.
    'body::before{content:"";position:fixed;inset:0;z-index:-2;background:radial-gradient(120% 90% at 12% 8%,rgba(96,148,224,.42),transparent 60%),radial-gradient(110% 85% at 88% 92%,rgba(236,124,180,.30),transparent 58%),linear-gradient(165deg,#22456e,#3c3a72 38%,#6f4a7e 68%,#9a5b80)}',
    // Containers: a whisper of tint over the wallpaper. No blur, no border,
    // no radius — blur on every panel is what read as slop in v0.3.
    `${GLASS_CONTAINERS}{background-color:var(--tp-glass)!important}`,
    // Chrome surfaces: vibrancy, like macOS frosted bars.
    `${GLASS_CHROME}{background-color:rgba(24,30,52,.55)!important;backdrop-filter:blur(20px) saturate(1.4);-webkit-backdrop-filter:blur(20px) saturate(1.4);box-shadow:inset 0 1px 0 rgba(255,255,255,.10)}`,
    // Hairlines only where glass meets content — never on every element.
    `:is(${GLASS_CHROME_ROOTS})>header{border-bottom:1px solid rgba(255,255,255,.10)!important}`,
    `:is(${GLASS_CHROME_ROOTS})>:is(aside,[role="complementary"]){border:1px solid rgba(255,255,255,.10)!important;border-radius:16px}`,
    // Buttery transitions, composited properties only, chrome surfaces only.
    `${GLASS_CHROME}{transition:background-color .35s cubic-bezier(.32,.72,0,1),color .35s cubic-bezier(.32,.72,0,1)}`,
    // A11y: OS-level "less transparency" preference gets a solid tone
    // matching the wallpaper's mid gradient; hairlines stay (they're opaque).
    `@media (prefers-reduced-transparency:reduce){${GLASS_CHROME}{background-color:#262a44!important;backdrop-filter:none;-webkit-backdrop-filter:none}}`,
  ].join('')
}

/**
 * AMOLED anti-reflective dark — the flagship theme.
 *
 * Anti-reflective = every glow source removed:
 * - True #000000 on the root AND on the bounded panel set (OLED pixels
 *   fully off; panels staying gray is the classic AMOLED-mode failure).
 * - Text luminance ~83% (#d4d4d4): pure white on pure black blooms and
 *   reads as glare on OLED — the standard anti-halation tuning.
 * - Dimmed link tone; tuned selection color.
 *
 * Solid colors only: no backdrop-filter, no blanket `*` selectors —
 * cheap to composite, no weird behaviour (AGENTS.md).
 */
export function buildAmoledCss(): string {
  return [
    ':root{--tp-bg:#000000;--tp-fg:#d4d4d4}',
    'html,body{background-color:var(--tp-bg)!important;color:var(--tp-fg)!important}',
    'html{color-scheme:dark}',
    `${GLASS_CONTAINERS}{background-color:#000000!important}`,
    'a{color:#86a8ff!important}',
    '::selection{background:#1a3a6a!important;color:#e8e8e8}',
  ].join('')
}

/** Base64 data-URI font faces, imported by the content script (?inline). */
export interface FontAssets {
  w400: string
  w500: string
  w600: string
}

const FONT_STACK = `'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif`

/**
 * Font rules for macOS-style typography. @font-face entries are emitted
 * only for assets actually provided; the family stack always degrades
 * gracefully (system fonts) when none are.
 */
export function buildFontCss(assets?: Partial<FontAssets>): string {
  const rules: string[] = []
  const faces: Array<[number, keyof FontAssets]> = [
    [400, 'w400'],
    [500, 'w500'],
    [600, 'w600'],
  ]
  for (const [weight, key] of faces) {
    const url = assets?.[key]
    if (url) {
      rules.push(
        `@font-face{font-family:'Inter';font-style:normal;font-weight:${weight};font-display:swap;src:url(${url}) format('woff2')}`,
      )
    }
  }
  rules.push(`body,input,button,select,textarea{font-family:${FONT_STACK}!important}`)
  return rules.join('')
}

/**
 * Builds the full CSS for a GlobalSettings. Defensive clamping is repeated
 * here on purpose: normalizeSettings already clamps, but this function may
 * be fed values from anywhere, and CSS-injection must never trust input.
 */
export function buildThemeCss(g: GlobalSettings, fonts?: Partial<FontAssets>): string | null {
  const rules: string[] = []

  if (g.theme === 'glass') {
    rules.push(buildGlassCss())
  } else if (g.theme === 'amoled') {
    rules.push(buildAmoledCss())
  } else if (g.theme !== 'auto') {
    const p = PALETTES[g.theme]
    rules.push(`:root{--tp-bg:${p.bg};--tp-fg:${p.fg}}`)
    rules.push('html,body{background-color:var(--tp-bg)!important;color:var(--tp-fg)!important}')
    rules.push(`html{color-scheme:${p.scheme}}`)
  }

  if (g.font === 'mac') {
    rules.push(buildFontCss(fonts))
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
