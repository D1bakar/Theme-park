import { describe, expect, it } from 'vitest'

import {
  glareFromHour,
  glareFromLux,
  LUX_NIGHT_MAX,
  LUX_SUNLIGHT_MIN,
  nextGlare,
  resolveGlare,
  settleGlare,
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

describe('nextGlare — hysteresis', () => {
  it('does not leave night until the room is clearly brighter', () => {
    expect(nextGlare('night', 40)).toBe('night')
    expect(nextGlare('night', 69)).toBe('night')
    expect(nextGlare('night', 70)).toBe('indoor')
    expect(nextGlare('night', 500)).toBe('indoor')
    expect(nextGlare('night', 1500)).toBe('sunlight')
  })

  it('does not leave sunlight until the light clearly drops', () => {
    expect(nextGlare('sunlight', 5000)).toBe('sunlight')
    expect(nextGlare('sunlight', 900)).toBe('sunlight')
    expect(nextGlare('sunlight', 801)).toBe('sunlight')
    expect(nextGlare('sunlight', 800)).toBe('indoor')
    expect(nextGlare('sunlight', 40)).toBe('night')
  })

  it('indoor crosses the entry thresholds normally', () => {
    expect(nextGlare('indoor', 49)).toBe('night')
    expect(nextGlare('indoor', 50)).toBe('indoor')
    expect(nextGlare('indoor', 999)).toBe('indoor')
    expect(nextGlare('indoor', 1000)).toBe('sunlight')
  })

  it('garbage readings keep the current level', () => {
    expect(nextGlare('sunlight', Number.NaN)).toBe('sunlight')
    expect(nextGlare('night', -1)).toBe('night')
  })
})

describe('settleGlare — debounce', () => {
  const start = { level: 'indoor' as const, candidate: null, samples: 0 }

  it('requires three consecutive readings before switching', () => {
    let state = settleGlare(start, 'sunlight')
    expect(state.level).toBe('indoor')
    expect(state.samples).toBe(1)
    state = settleGlare(state, 'sunlight')
    expect(state.level).toBe('indoor')
    expect(state.samples).toBe(2)
    state = settleGlare(state, 'sunlight')
    expect(state.level).toBe('sunlight')
    expect(state.candidate).toBeNull()
  })

  it('a reading back at the current level kills the candidate', () => {
    let state = settleGlare(start, 'sunlight')
    state = settleGlare(state, 'sunlight')
    state = settleGlare(state, 'indoor')
    expect(state.level).toBe('indoor')
    expect(state.candidate).toBeNull()
    expect(state.samples).toBe(0)
  })

  it('a different candidate restarts the count', () => {
    let state = settleGlare(start, 'sunlight')
    state = settleGlare(state, 'night')
    expect(state.level).toBe('indoor')
    expect(state.candidate).toBe('night')
    expect(state.samples).toBe(1)
  })
})
