import { describe, expect, it } from 'vitest'

import type { GlobalSettings } from './schema'
import { buildGlassCss, buildThemeCss } from './theme-css'

const base: GlobalSettings = {
  theme: 'auto',
  fontSize: 100,
  lineHeight: 0,
  maxWidthCh: 0,
  animations: 'default',
  smoothScroll: false,
}

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

describe('buildGlassCss', () => {
  const css = buildGlassCss()

  it('sets a fixed gradient wallpaper via body::before', () => {
    expect(css).toContain('body::before{content:"";position:fixed;inset:0;z-index:-2')
    expect(css).toContain('linear-gradient')
  })

  it('frosts only body direct children and landmarks — never a blanket selector', () => {
    // The perf guard: every backdrop-filter rule must be scoped to the
    // bounded selector set. `*{...backdrop-filter` is the forbidden shape.
    expect(css).not.toMatch(/\*,[^{]*\{[^}]*backdrop-filter/)
    expect(css).toContain('body>div,body>main,body>header,body>footer,body>nav')
    expect(css).toContain('backdrop-filter:blur(22px)')
  })

  it('includes specular highlight and glass border tokens', () => {
    expect(css).toContain('inset 0 1px rgba(255,255,255,.28)')
    expect(css).toContain('border-radius:18px')
  })

  it('falls back to solid surfaces under prefers-reduced-transparency', () => {
    expect(css).toContain('prefers-reduced-transparency:reduce')
    expect(css).toContain('backdrop-filter:none')
  })

  it('adds buttery color transitions (composited-friendly properties only)', () => {
    expect(css).toContain('transition:background-color .35s')
    expect(css).not.toMatch(/transition:[^}]*\b(width|height|top|left)\b/)
  })
})

describe('buildThemeCss — glass integration', () => {
  it('glass mode emits glass CSS and dark color-scheme, no solid palette vars', () => {
    const css = buildThemeCss({ ...base, theme: 'glass' }) ?? ''
    expect(css).toContain('body::before')
    expect(css).toContain('color-scheme:dark')
    expect(css).not.toContain('--tp-bg:')
  })

  it('glass + typography stack correctly (single string, all rules)', () => {
    const css = buildThemeCss({ ...base, theme: 'glass', fontSize: 130, lineHeight: 1.6 }) ?? ''
    expect(css).toContain('font-size:130%')
    expect(css).toContain('line-height:1.6!important')
    expect(css).toContain('body::before')
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
