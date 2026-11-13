/**
 * Ambient glare resolution — pure functions, no DOM, no chrome.
 *
 * External light reflecting off a glossy panel adds a veil of light on top
 * of the rendered page. Software cannot remove that reflection (that is a
 * matte coating), but it can keep content legible through it by raising or
 * lowering the luminance of text and hairlines against the true-black
 * background. This module maps the two available signals to one level:
 *
 * - Real illuminance in lux from the AmbientLightSensor API, when the
 *   browser exposes it (Chrome/Edge on some devices; Brave on Linux
 *   usually does not).
 * - Local time of day as the fallback — coarse, but better than assuming
 *   it is always noon or always midnight.
 *
 * The thresholds are conventional illuminance bands: a dark room is well
 * under 50 lux, ordinary indoor lighting is a few hundred lux, and
 * daylight hitting the screen is 1000 lux and up.
 */

import type { GlareMode, ResolvedGlare } from './schema'

/** Below this many lux the room is dark: dim text to avoid halation. */
export const LUX_NIGHT_MAX = 50

/** Once at night, stay night until the room is clearly brighter. */
export const LUX_NIGHT_EXIT = 70

/** At or above this many lux the screen is fighting daylight. */
export const LUX_SUNLIGHT_MIN = 1000

/** Once in sunlight, stay there until the light clearly drops. */
export const LUX_SUNLIGHT_EXIT = 800

/** Consecutive readings a new level must hold before it is applied. */
export const GLARE_STABLE_SAMPLES = 3

/** Maps a measured illuminance (lux) to a glare level. */
export function glareFromLux(lux: number): ResolvedGlare {
  // Sensor garbage or a negative reading: stay neutral rather than guess.
  if (!Number.isFinite(lux) || lux < 0) return 'indoor'
  if (lux < LUX_NIGHT_MAX) return 'night'
  if (lux < LUX_SUNLIGHT_MIN) return 'indoor'
  return 'sunlight'
}

/**
 * Time-of-day fallback when no sensor exists. Deliberately simple:
 * 09:00–17:00 daylight, 07:00–09:00 and 17:00–20:00 ordinary indoor
 * light, everything else night. Manual override always wins.
 */
export function glareFromHour(hour: number): ResolvedGlare {
  if (!Number.isFinite(hour)) return 'indoor'
  const h = ((Math.floor(hour) % 24) + 24) % 24
  if (h >= 9 && h < 17) return 'sunlight'
  if (h >= 7 && h < 20) return 'indoor'
  return 'night'
}

/**
 * Resolves the user's glare setting to the level compiled into CSS.
 * Manual modes ignore the environment entirely; `auto` prefers a real lux
 * reading and falls back to the clock when the sensor is unavailable.
 */
export function resolveGlare(mode: GlareMode, lux: number | null, hour: number): ResolvedGlare {
  if (mode !== 'auto') return mode
  return lux === null ? glareFromHour(hour) : glareFromLux(lux)
}

/**
 * Hysteresis for live sensor readings: the light must move clearly past a
 * boundary before the level flips. A cloud drifting over the window should
 * not make the whole page flicker between indoor and sunlight.
 */
export function nextGlare(prev: ResolvedGlare, lux: number): ResolvedGlare {
  if (!Number.isFinite(lux) || lux < 0) return prev
  if (prev === 'night') {
    if (lux < LUX_NIGHT_EXIT) return 'night'
    return lux >= LUX_SUNLIGHT_MIN ? 'sunlight' : 'indoor'
  }
  if (prev === 'sunlight') {
    if (lux > LUX_SUNLIGHT_EXIT) return 'sunlight'
    return lux < LUX_NIGHT_MAX ? 'night' : 'indoor'
  }
  // indoor
  if (lux < LUX_NIGHT_MAX) return 'night'
  return lux >= LUX_SUNLIGHT_MIN ? 'sunlight' : 'indoor'
}

export interface GlareState {
  /** Level currently applied to the page. */
  level: ResolvedGlare
  /** Level that is trying to take over. */
  candidate: ResolvedGlare | null
  /** Consecutive readings the candidate has held. */
  samples: number
}

/**
 * Requires a new level to hold for several consecutive readings before it
 * becomes the applied level. Identical repeats of the current level clear
 * the candidate, so isolated spikes never reach the page.
 */
export function settleGlare(
  state: GlareState,
  target: ResolvedGlare,
  samples: number = GLARE_STABLE_SAMPLES,
): GlareState {
  if (target === state.level) return { level: state.level, candidate: null, samples: 0 }
  if (target === state.candidate) {
    const count = state.samples + 1
    if (count >= samples) return { level: target, candidate: null, samples: 0 }
    return { level: state.level, candidate: target, samples: count }
  }
  return { level: state.level, candidate: target, samples: 1 }
}
