import { describe, expect, it } from 'vitest'

import type { GlobalSettings } from './schema'
import { buildAmoledCss, buildThemeCss } from './theme-css'

const base: GlobalSettings = {
  theme: 'auto', // power switch off — inject nothing
  fontSize: 100,
  lineHeight: 0,
  maxWidthCh: 0,
  animations: 'default',
  smoothScroll: false,
  dimImages: true,
}

describe('buildAmoledCss — the one theme (total antireflection)', () => {
  const css = buildAmoledCss()

  it('BLANKET takeover: every surface goes #000 — no shiny elements survive', () => {
    // The whole-screen antireflection contract: blanket background-color,
    // pseudo-elements included. Explicit light backgrounds (buttons, cards,
    // inline styles) cannot survive this.
    expect(css).toContain(
      '*,*::before,*::after{background-color:#000000!important;color:#d4d4d4!important;border-color:#1f1f1f!important;box-shadow:none!important;text-shadow:none!important}',
    )
    expect(css).toContain('html,body{background-color:#000000!important')
  })

  it('uniform anti-halation text — every glyph at ~83%, never pure white', () => {
    expect(css).toContain('--tp-fg:#d4d4d4')
    expect(css).not.toContain('#f0f0f0')
    expect(css).not.toMatch(/color:#f{3,}/)
  })

  it('glow sources removed: box-shadow and text-shadow blanketed away', () => {
    expect(css).toContain('box-shadow:none!important')
    expect(css).toContain('text-shadow:none!important')
  })

  it('links keep one dim accent; caret visible; selection tuned', () => {
    expect(css).toContain('a{color:#86a8ff!important}')
    expect(css).toContain('input,textarea{caret-color:#d4d4d4!important}')
    expect(css).toContain('::selection{background:#1a3a6a')
  })

  it('never uses backdrop-filter — the blanket ban is filters, not colors', () => {
    expect(css).not.toContain('backdrop-filter')
  })

  it('declares dark color-scheme for form controls and scrollbars', () => {
    expect(css).toContain('color-scheme:dark')
  })

  it('stays small — the whole blackout sheet must remain under ~1.5KB', () => {
    expect(new TextEncoder().encode(css).length).toBeLessThan(1536)
  })
})

describe('buildThemeCss — single-theme contract', () => {
  it('power off (auto) with untouched comfort controls → inject NOTHING', () => {
    expect(buildThemeCss(base)).toBeNull()
  })

  it('power on emits the amoled sheet', () => {
    const css = buildThemeCss({ ...base, theme: 'amoled' }) ?? ''
    expect(css).toContain('--tp-bg:#000000')
    expect(css).toContain('color-scheme:dark')
  })

  it('dim images (default on) adds the anti-glare image rule', () => {
    const css = buildThemeCss({ ...base, theme: 'amoled' }) ?? ''
    expect(css).toContain('img{filter:brightness(.82)!important}')
  })

  it('dim images off removes the image rule — theme otherwise identical', () => {
    const css = buildThemeCss({ ...base, theme: 'amoled', dimImages: false }) ?? ''
    expect(css).not.toContain('filter:')
    expect(css).toContain('--tp-bg:#000000')
  })

  it('dim images never applies when power is off', () => {
    expect(buildThemeCss(base)).toBeNull()
  })

  it('panels never get blur or borders — the slop guard, kept forever', () => {
    const css = buildThemeCss({ ...base, theme: 'amoled', dimImages: true }) ?? ''
    expect(css).not.toContain('backdrop-filter')
    expect(css).not.toContain('border-radius')
  })

  it('svg artwork dims with images when dim images is on', () => {
    const css = buildThemeCss({ ...base, theme: 'amoled' }) ?? ''
    expect(css).toContain('img{filter:brightness(.82)!important}')
    expect(css).toContain('svg{opacity:.82!important}')
  })

  it('svg dim removed together with the img dim when off', () => {
    const css = buildThemeCss({ ...base, theme: 'amoled', dimImages: false }) ?? ''
    expect(css).not.toContain('filter:')
    expect(css).not.toContain('svg{')
  })
})

describe('buildThemeCss — comfort controls', () => {
  it('font size hits BOTH :root (rem sites) and body !important (inherit sites)', () => {
    const css = buildThemeCss({ ...base, fontSize: 120 }) ?? ''
    expect(css).toContain('html{font-size:120%}')
    expect(css).toContain('body{font-size:120%!important}')
  })

  it('font size is clamped even with hostile input', () => {
    const css = buildThemeCss({ ...base, fontSize: 999, lineHeight: 50, maxWidthCh: -10 }) ?? ''
    expect(css).toContain('font-size:200%')
    expect(css).toContain('line-height:2')
    expect(css).toContain('max-width:40ch')
    expect(css).toContain('margin-inline:auto')
  })

  it('line-height is emitted with !important so site CSS cannot silently win', () => {
    const css = buildThemeCss({ ...base, lineHeight: 1.7 }) ?? ''
    expect(css).toContain('body{line-height:1.7!important}')
  })

  it('zero values mean "leave the site alone" — no rule emitted', () => {
    const css = buildThemeCss({ ...base, theme: 'amoled' }) ?? ''
    expect(css).not.toContain('line-height')
    expect(css).not.toContain('max-width')
    expect(css).not.toContain('font-size')
  })

  it('animations off kills all animation/transition and any smooth scroll', () => {
    const css =
      buildThemeCss({
        ...base,
        theme: 'amoled',
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
    const css = buildThemeCss({ ...base, theme: 'amoled', fontSize: 120, smoothScroll: true })
    expect(typeof css).toBe('string')
  })
})
