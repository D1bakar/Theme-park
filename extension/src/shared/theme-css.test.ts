import { describe, expect, it } from 'vitest'

import type { GlobalSettings } from './schema'
import { buildAmoledCss, buildThemeCss, PANEL_CONTAINERS } from './theme-css'

const base: GlobalSettings = {
  theme: 'auto', // power switch off — inject nothing
  fontSize: 100,
  lineHeight: 0,
  maxWidthCh: 0,
  animations: 'default',
  smoothScroll: false,
  dimImages: true,
}

describe('buildAmoledCss — the one theme (antireflective)', () => {
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

  it('stays tiny — solid-color sheet must remain under 1KB', () => {
    expect(new TextEncoder().encode(css).length).toBeLessThan(1024)
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
    // The panel rule is exactly one property.
    expect(css).toContain(`${PANEL_CONTAINERS}{background-color:#000000!important}`)
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
