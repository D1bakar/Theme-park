import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS, normalizeSettings } from './schema'

describe('normalizeSettings', () => {
  it('returns defaults for null, undefined and garbage input', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings('garbage')).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings(42)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings({ global: 'not-an-object', sites: ['x'] })).toEqual(DEFAULT_SETTINGS)
  })

  it('preserves valid settings unchanged', () => {
    const input = {
      version: 1,
      global: {
        theme: 'amoled',
        fontSize: 120,
        lineHeight: 1.6,
        maxWidthCh: 70,
        animations: 'off',
        smoothScroll: true,
        dimImages: false,
      },
      sites: {
        'example.com': { enabled: true, theme: 'auto', fontSize: 90 },
      },
    }
    const out = normalizeSettings(input)
    expect(out.global.theme).toBe('amoled')
    expect(out.global.fontSize).toBe(120)
    expect(out.global.lineHeight).toBe(1.6)
    expect(out.global.maxWidthCh).toBe(70)
    expect(out.global.animations).toBe('off')
    expect(out.global.smoothScroll).toBe(true)
    expect(out.global.dimImages).toBe(false)
    expect(out.sites['example.com']).toEqual({ enabled: true, theme: 'auto', fontSize: 90 })
  })

  it('clamps out-of-range numbers instead of rejecting them', () => {
    const out = normalizeSettings({
      global: { fontSize: 500, lineHeight: 9, maxWidthCh: -20 },
      sites: { 'a.com': { fontSize: 1, lineHeight: 50 } },
    })
    expect(out.global.fontSize).toBe(200)
    expect(out.global.lineHeight).toBe(2.0)
    expect(out.global.maxWidthCh).toBe(40)
    expect(out.sites['a.com']?.fontSize).toBe(80)
    expect(out.sites['a.com']?.lineHeight).toBe(2.0)
  })

  it('coerces invalid enum values to defaults, not to adjacent modes', () => {
    const out = normalizeSettings({
      global: { theme: 'neon-pink', animations: 'sometimes' },
    })
    expect(out.global.theme).toBe('amoled') // default, not adjacent mode
    expect(out.global.animations).toBe('default')
  })

  it('legacy theme modes normalize to the single-theme default', () => {
    // Pre-pivot storage may hold glass/light/dark — those modes no longer
    // exist, so they normalize to the product's one theme.
    const legacy = normalizeSettings({ global: { theme: 'glass' } })
    expect(legacy.global.theme).toBe('amoled')
  })

  it('amoled is the default theme for fresh installs and garbage input', () => {
    expect(normalizeSettings(null).global.theme).toBe('amoled')
    expect(DEFAULT_SETTINGS.global.theme).toBe('amoled')
    // Profiles fall back to the same default.
    const profiled = normalizeSettings({ sites: { 'a.com': { enabled: true, theme: 'nope' } } })
    expect(profiled.sites['a.com']?.theme).toBe('amoled')
  })

  it('dimImages defaults to ON and only explicit false turns it off', () => {
    expect(normalizeSettings({}).global.dimImages).toBe(true)
    expect(normalizeSettings({ global: { dimImages: 'no' } }).global.dimImages).toBe(true)
    expect(normalizeSettings({ global: { dimImages: false } }).global.dimImages).toBe(false)
  })

  it('unknown legacy fields are dropped silently (font was removed in the pivot)', () => {
    const out = normalizeSettings({ global: { font: 'mac' } })
    expect('font' in out.global).toBe(false)
  })

  it('keeps 0 as the explicit "leave site alone" value', () => {
    // 0 is meaningful (don't override), so clamping must NOT turn it into 40/1.0
    const out = normalizeSettings({ global: { lineHeight: 0, maxWidthCh: 0 } })
    expect(out.global.lineHeight).toBe(0)
    expect(out.global.maxWidthCh).toBe(0)
  })

  it('drops hostile or malformed site keys', () => {
    const out = normalizeSettings({
      sites: {
        'ok.example.com': { enabled: true },
        'not a host with spaces': { enabled: true },
        '../../../etc/passwd': { enabled: true },
        x: 42, // non-object value
      },
    })
    expect(Object.keys(out.sites)).toEqual(['ok.example.com'])
  })

  it('defaults enabled to false when missing or falsy', () => {
    const out = normalizeSettings({ sites: { 'a.com': {}, 'b.com': { enabled: true } } })
    expect(out.sites['a.com']?.enabled).toBe(false)
    expect(out.sites['b.com']?.enabled).toBe(true)
  })

  it('never throws on deeply nested garbage', () => {
    expect(() =>
      normalizeSettings({
        global: { fontSize: { nested: true } },
        sites: { 'a.com': { theme: [] } },
      }),
    ).not.toThrow()
  })
})
