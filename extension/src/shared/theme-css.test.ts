import { describe, expect, it } from 'vitest'

import type { GlobalSettings } from './schema'
import {
  buildAmoledCss,
  buildFontCss,
  buildGlassCss,
  buildThemeCss,
  GLASS_CHROME,
  GLASS_CONTAINERS,
} from './theme-css'

const base: GlobalSettings = {
  theme: 'auto',
  fontSize: 100,
  lineHeight: 0,
  maxWidthCh: 0,
  animations: 'default',
  smoothScroll: false,
  font: 'site',
}

const FONTS = {
  w400: 'data:font/woff2;base64,AAAA',
  w500: 'data:font/woff2;base64,BBBB',
  w600: 'data:font/woff2;base64,CCCC',
}

describe('buildGlassCss — designed, not sprayed (v3)', () => {
  const css = buildGlassCss()

  it('sets a fixed gradient wallpaper via body::before', () => {
    expect(css).toContain('body::before{content:"";position:fixed;inset:0;z-index:-2')
    expect(css).toContain('linear-gradient')
    expect(css).toContain('radial-gradient')
    // Sonoma palette, not the old cold near-black.
    expect(css).toContain('#22456e')
    expect(css).toContain('#9a5b80')
  })

  it('containers get a tint ONLY — no blur, no borders, no radius', () => {
    // The v0.3 slop was blur+borders on every big container. The container
    // rule must be exactly one property.
    expect(css).toContain(`${GLASS_CONTAINERS}{background-color:var(--tp-glass)!important}`)
    expect(css).not.toMatch(/body>div[^{]*\{[^}]*backdrop-filter/)
    expect(css).not.toMatch(/body>div[^{]*\{[^}]*border/)
  })

  it('vibrancy is reserved for chrome-like surfaces only', () => {
    expect(css).toContain(
      `${GLASS_CHROME}{background-color:rgba(24,30,52,.55)!important;backdrop-filter:blur(20px) saturate(1.4)`,
    )
    // Still never a blanket selector (perf guard).
    expect(css).not.toMatch(/\*,[^{]*\{[^}]*backdrop-filter/)
  })

  it('hairlines exist only where glass meets content', () => {
    expect(css).toContain(
      ':is(body,body>#root,body>#app,body>#__next,body>#___gatsby)>header{border-bottom:1px solid rgba(255,255,255,.10)!important}',
    )
    // Border-radius appears exactly once (sidebars) — no radius spray.
    expect(css.match(/border-radius/g)).toHaveLength(1)
  })

  it('falls back to solid chrome under prefers-reduced-transparency', () => {
    expect(css).toContain('prefers-reduced-transparency:reduce')
    expect(css).toContain('backdrop-filter:none')
    expect(css).toContain('background-color:#262a44!important')
  })

  it('adds buttery color transitions (composited-friendly properties only)', () => {
    expect(css).toContain('transition:background-color .35s')
    expect(css).not.toMatch(/transition:[^}]*\b(width|height|top|left)\b/)
  })

  it('stays small — the whole glass sheet must remain under ~2KB', () => {
    expect(new TextEncoder().encode(css).length).toBeLessThan(2048)
  })
})

describe('buildAmoledCss — anti-reflective dark (flagship)', () => {
  const css = buildAmoledCss()

  it('true #000000 on root and bounded panels — no gray glow', () => {
    expect(css).toContain('--tp-bg:#000000')
    expect(css).toContain('background-color:#000000!important')
    expect(css).toContain('body>#root')
    expect(css).toContain('body>#__next>div')
  })

  it('text luminance tuned to cut halation — not pure white', () => {
    expect(css).toContain('--tp-fg:#d4d4d4')
    expect(css).not.toContain('#f0f0f0')
  })

  it('dimmed link tone and tuned selection color', () => {
    expect(css).toContain('a{color:#86a8ff!important}')
    expect(css).toContain('::selection{background:#1a3a6a')
  })

  it('solid colors only — no blur, no blanket selectors (no weird behaviour)', () => {
    expect(css).not.toContain('backdrop-filter')
    expect(css).not.toMatch(/\*[,{}]/)
  })

  it('declares dark color-scheme for form controls and scrollbars', () => {
    expect(css).toContain('color-scheme:dark')
  })
})

describe('buildFontCss', () => {
  it('emits one @font-face per provided asset, all weights', () => {
    const css = buildFontCss(FONTS)
    expect(css.match(/@font-face/g)).toHaveLength(3)
    expect(css).toContain('font-weight:400')
    expect(css).toContain('font-weight:500')
    expect(css).toContain('font-weight:600')
    expect(css).toContain("src:url(data:font/woff2;base64,AAAA) format('woff2')")
  })

  it('family stack is emitted even with no assets (graceful system fallback)', () => {
    const css = buildFontCss(undefined)
    expect(css).not.toContain('@font-face')
    expect(css).toContain("'Inter',-apple-system")
  })

  it('covers form controls, not just body', () => {
    const css = buildFontCss(FONTS)
    expect(css).toContain('body,input,button,select,textarea{')
    expect(css).toContain('!important')
  })
})

describe('buildThemeCss — original contract', () => {
  it('returns null for untouched defaults — inject nothing', () => {
    expect(buildThemeCss(base)).toBeNull()
  })

  it('auto mode injects no colors — the site keeps its own scheme', () => {
    const css = buildThemeCss({ ...base, fontSize: 120 })
    expect(css).not.toContain('--tp-bg')
    expect(css).not.toContain('background-color')
    expect(css).toContain('font-size:120%')
  })

  it('dark mode emits palette vars, root colors and dark color-scheme', () => {
    const css = buildThemeCss({ ...base, theme: 'dark' }) ?? ''
    expect(css).toContain('--tp-bg:#121212')
    expect(css).toContain('--tp-fg:#e8e8e8')
    expect(css).toContain('background-color:var(--tp-bg)!important')
    expect(css).toContain('color-scheme:dark')
  })

  it('amoled mode is pure black', () => {
    const css = buildThemeCss({ ...base, theme: 'amoled' }) ?? ''
    expect(css).toContain('--tp-bg:#000000')
    expect(css).toContain('color-scheme:dark')
  })

  it('light mode declares light color-scheme', () => {
    const css = buildThemeCss({ ...base, theme: 'light' }) ?? ''
    expect(css).toContain('color-scheme:light')
  })

  it('zero values mean "leave the site alone" — no rule emitted', () => {
    const css = buildThemeCss({ ...base, theme: 'dark' }) ?? ''
    expect(css).not.toContain('line-height')
    expect(css).not.toContain('max-width')
  })

  it('non-default typography is emitted and clamped', () => {
    const css =
      buildThemeCss({
        ...base,
        fontSize: 999, // hostile input — compiler clamps regardless
        lineHeight: 50,
        maxWidthCh: -10,
      }) ?? ''
    expect(css).toContain('font-size:200%')
    expect(css).toContain('line-height:2')
    expect(css).toContain('max-width:40ch')
    expect(css).toContain('margin-inline:auto')
  })

  it('animations off kills all animation/transition and any smooth scroll', () => {
    const css =
      buildThemeCss({
        ...base,
        theme: 'dark',
        animations: 'off',
        smoothScroll: true,
      }) ?? ''
    expect(css).toContain('animation:none!important')
    expect(css).toContain('transition:none!important')
    expect(css).toContain('scroll-behavior:auto!important')
    expect(css).not.toContain('scroll-behavior:smooth')
  })

  it('smooth scroll emits scroll-behavior:smooth when animations are on', () => {
    const css = buildThemeCss({ ...base, smoothScroll: true }) ?? ''
    expect(css).toContain('scroll-behavior:smooth')
  })

  it('always returns ONE string — the single style tag contract', () => {
    const css = buildThemeCss({ ...base, theme: 'dark', fontSize: 120, smoothScroll: true })
    expect(typeof css).toBe('string')
  })
})

describe('buildThemeCss — font mode', () => {
  it("font 'mac' emits faces + family stack even in auto mode", () => {
    const css = buildThemeCss({ ...base, font: 'mac' }, FONTS) ?? ''
    expect(css.match(/@font-face/g)).toHaveLength(3)
    expect(css).toContain('font-family:')
    expect(css).not.toContain('--tp-bg')
  })

  it("font 'site' never emits font rules — even when assets are passed", () => {
    const css = buildThemeCss({ ...base, font: 'site' }, FONTS)
    expect(css).toBeNull()
  })

  it('mac font + glass stack together in the single string', () => {
    const css = buildThemeCss({ ...base, theme: 'glass', font: 'mac' }, FONTS) ?? ''
    expect(css).toContain('body::before')
    expect(css.match(/@font-face/g)).toHaveLength(3)
  })

  it('mac font without assets still emits the family stack (no faces)', () => {
    const css = buildThemeCss({ ...base, font: 'mac' }) ?? ''
    expect(css).not.toContain('@font-face')
    expect(css).toContain("'Inter',-apple-system")
  })
})

describe('buildThemeCss — stronger typography', () => {
  it('font size hits BOTH :root (rem sites) and body !important (inherit sites)', () => {
    const css = buildThemeCss({ ...base, fontSize: 120 }) ?? ''
    expect(css).toContain('html{font-size:120%}')
    expect(css).toContain('body{font-size:120%!important}')
  })

  it('line-height is emitted with !important so site CSS cannot silently win', () => {
    const css = buildThemeCss({ ...base, lineHeight: 1.7 }) ?? ''
    expect(css).toContain('body{line-height:1.7!important}')
  })

  it('normal modes still behave as before (no glass leakage)', () => {
    const css = buildThemeCss({ ...base, theme: 'dark', fontSize: 110 }) ?? ''
    expect(css).toContain('--tp-bg:#121212')
    expect(css).not.toContain('body::before')
    expect(css).toContain('body{font-size:110%!important}')
  })
})
