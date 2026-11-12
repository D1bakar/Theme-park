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

const PALETTES: Record<Exclude<ThemeMode, 'auto'>, Palette> = {
  light: { bg: '#ffffff', fg: '#1a1a1a', scheme: 'light' },
  dark: { bg: '#121212', fg: '#e8e8e8', scheme: 'dark' },
  amoled: { bg: '#000000', fg: '#f0f0f0', scheme: 'dark' },
}

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

/**
 * Builds the full CSS for a GlobalSettings. Defensive clamping is repeated
 * here on purpose: normalizeSettings already clamps, but this function may
 * be fed values from anywhere, and CSS-injection must never trust input.
 */
export function buildThemeCss(g: GlobalSettings): string | null {
  const rules: string[] = []

  if (g.theme !== 'auto') {
    const p = PALETTES[g.theme]
    rules.push(`:root{--tp-bg:${p.bg};--tp-fg:${p.fg}}`)
    rules.push('html,body{background-color:var(--tp-bg)!important;color:var(--tp-fg)!important}')
    rules.push(`html{color-scheme:${p.scheme}}`)
  }

  if (g.fontSize !== 100) {
    rules.push(`html{font-size:${clamp(g.fontSize, 80, 200)}%}`)
  }

  if (g.lineHeight !== 0) {
    rules.push(`body{line-height:${clamp(g.lineHeight, 1, 2)}}`)
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
