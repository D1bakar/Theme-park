import { describe, expect, it } from 'vitest'

import {
  glareFromHour,
  glareFromLux,
  LUX_NIGHT_MAX,
  LUX_SUNLIGHT_MIN,
  resolveGlare,
} from './ambient'

describe('glareFromLux — real ambient readings', () => {
  it('dark room → night', () => {
    expect(glareFromLux(0)).toBe('night')
    expect(glareFromLux(10)).toBe('night')
    expect(glareFromLux(49.9)).toBe('night')
  })

  it('ordinary indoor lighting → indoor', () => {
    expect(glareFromLux(LUX_NIGHT_MAX)).toBe('indoor')
    expect(glareFromLux(300)).toBe('indoor')
    expect(glareFromLux(LUX_SUNLIGHT_MIN - 1)).toBe('indoor')
  })

  it('daylight hitting the screen → sunlight', () => {
    expect(glareFromLux(LUX_SUNLIGHT_MIN)).toBe('sunlight')
    expect(glareFromLux(5000)).toBe('sunlight')
    expect(glareFromLux(100000)).toBe('sunlight')
  })

  it('sensor garbage stays neutral instead of guessing', () => {
    expect(glareFromLux(Number.NaN)).toBe('indoor')
    expect(glareFromLux(Number.POSITIVE_INFINITY)).toBe('indoor')
    expect(glareFromLux(-5)).toBe('indoor')
  })
})

describe('glareFromHour — clock fallback', () => {
  it('night wraps midnight', () => {
    expect(glareFromHour(0)).toBe('night')
    expect(glareFromHour(6)).toBe('night')
    expect(glareFromHour(20)).toBe('night')
    expect(glareFromHour(23)).toBe('night')
  })

  it('morning and evening are ordinary indoor light', () => {
    expect(glareFromHour(7)).toBe('indoor')
    expect(glareFromHour(8)).toBe('indoor')
    expect(glareFromHour(17)).toBe('indoor')
    expect(glareFromHour(19)).toBe('indoor')
  })

  it('working daylight hours are sunlight', () => {
    expect(glareFromHour(9)).toBe('sunlight')
    expect(glareFromHour(12)).toBe('sunlight')
    expect(glareFromHour(16)).toBe('sunlight')
  })

  it('handles fractional, negative and wrapped hours', () => {
    expect(glareFromHour(12.9)).toBe('sunlight')
    expect(glareFromHour(-1)).toBe('night') // -1 → 23:00
    expect(glareFromHour(24)).toBe('night') // 24 → 00:00
    expect(glareFromHour(25)).toBe('night') // 25 → 01:00
    expect(glareFromHour(Number.NaN)).toBe('indoor')
  })
})

describe('resolveGlare — setting + environment', () => {
  it('manual modes ignore sensor and clock entirely', () => {
    expect(resolveGlare('night', 100000, 12)).toBe('night')
    expect(resolveGlare('indoor', 0, 3)).toBe('indoor')
    expect(resolveGlare('sunlight', 5, 23)).toBe('sunlight')
  })

  it('auto prefers a real lux reading over the clock', () => {
    expect(resolveGlare('auto', 20, 12)).toBe('night')
    expect(resolveGlare('auto', 8000, 2)).toBe('sunlight')
  })

  it('auto falls back to the clock when no sensor exists', () => {
    expect(resolveGlare('auto', null, 12)).toBe('sunlight')
    expect(resolveGlare('auto', null, 23)).toBe('night')
  })
})
