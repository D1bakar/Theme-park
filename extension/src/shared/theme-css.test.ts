import { describe, expect, it } from 'vitest'

import type { GlobalSettings } from './schema'
import { buildGlassCss, buildThemeCss, GLASS_SURFACES } from './theme-css'

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

  it('wallpaper is Sonoma-style: layered soft glows over a blue→rose gradient', () => {
    expect(css).toContain('radial-gradient')
    // Gradient spans deep blue to warm rose, not the old cold hacker-dark.
    expect(css).toContain('#22456e')
    expect(css).toContain('#9a5b80')
    expect(css).not.toContain('#0a0e18')
  })

  it('frosts only body direct children and landmarks — never a blanket selector', () => {
    // The perf guard: every backdrop-filter rule must be scoped to the
    // bounded selector set. `*{...backdrop-filter` is the forbidden shape.
    expect(css).not.toMatch(/\*,[^{]*\{[^}]*backdrop-filter/)
    expect(css).toContain('body>div,body>main,body>header,body>footer,body>nav')
    expect(css).toContain('backdrop-filter:blur(30px)')
  })

  it('covers framework app roots AND one level inside them', () => {
    // React/Next/Vue/Gatsby bury the visible container under #root/#__next/
    // #app/#___gatsby — this was the "glass half applied" root cause.
    for (const root of ['#root', '#app', '#__next', '#___gatsby']) {
      expect(css).toContain(`body>${root}`)
      expect(css).toContain(`body>${root}>div`)
    }
    // The exported selector constant is used verbatim in the CSS.
    expect(css).toContain(GLASS_SURFACES)
  })

  it('includes softer macOS tokens: 20px radius, whisper border, soft shadow', () => {
    expect(css).toContain('border-radius:20px')
    expect(css).toContain('border:1px solid var(--tp-glass-border)')
    expect(css).toContain('0 8px 32px')
  })

  it('falls back to solid surfaces under prefers-reduced-transparency', () => {
    expect(css).toContain('prefers-reduced-transparency:reduce')
    expect(css).toContain('backdrop-filter:none')
    expect(css).toContain('background-color:#322f4e!important')
  })

  it('adds buttery color transitions (composited-friendly properties only)', () => {
    expect(css).toContain('transition:background-color .35s')
    expect(css).not.toMatch(/transition:[^}]*\b(width|height|top|left)\b/)
  })

  it('stays small — the whole glass sheet must remain under ~2KB', () => {
    // Injection-path perf budget (AGENTS.md): the compiler output is injected
    // as one style tag on every page; runaway growth here is a regression.
    expect(new TextEncoder().encode(css).length).toBeLessThan(2048)
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
