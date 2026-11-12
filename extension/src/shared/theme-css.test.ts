import { describe, expect, it } from 'vitest'

import type { GlobalSettings } from './schema'
import { buildThemeCss } from './theme-css'

const base: GlobalSettings = {
  theme: 'auto',
  fontSize: 100,
  lineHeight: 0,
  maxWidthCh: 0,
  animations: 'default',
  smoothScroll: false,
}

describe('buildThemeCss', () => {
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
