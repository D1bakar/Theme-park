/**
 * Theme CSS compiler — settings → one CSS string (or null for "inject
 * nothing"). Pure function: no DOM, no chrome, fully unit-testable.
 *
 * Contract (AGENTS.md): the content script injects the result as exactly
 * ONE <style> tag, never per-element styles.
 *
 * The product is ONE theme — AMOLED anti-reflective dark. There are no
 * other themes to compile. `auto` (power switch off) injects nothing:
 * the site's own scheme wins.
 */

import type { GlobalSettings, ResolvedGlare } from './schema'

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

/** CSS-friendly number: 0.82 → ".82" (shorter, matches the sheet budget). */
const cssNum = (n: number): string => String(n).replace(/^0\./, '.')

/**
 * Luminance set for one glare level. Backgrounds are ALWAYS true #000000 —
 * external light only changes how bright the content is allowed to be:
 *
 * - night: dimmer text/hairlines (less emitted light, no halation in a
 *   dark room), images dimmed hardest.
 * - indoor: the neutral tuning the theme shipped with.
 * - sunlight: brighter text, links and hairlines so content punches through
 *   the reflective veil; images dimmed least because emitted light is what
 *   makes them visible against daylight.
 *
 * All text tones stay below pure white: #f5f5f5 at the brightest, because
 * pure white on OLED blooms and reads as glare itself.
 */
export interface GlareTone {
  /** Body text luminance. */
  fg: string
  /** Link accent tuned for the same ambient level. */
  link: string
  /** Borders/hairlines — dark, but more visible under daylight. */
  hairline: string
  /** Selection background. */
  selectionBg: string
  /** Selection text. */
  selectionFg: string
  /** Image brightness factor (0–1) when dimImages is on. */
  imageBrightness: number
  /** SVG opacity (0–1) when dimImages is on. */
  svgOpacity: number
}

export const GLARE_TONES: Record<ResolvedGlare, GlareTone> = {
  night: {
    fg: '#b4b4b8',
    link: '#8fa8dd',
    hairline: '#141414',
    selectionBg: '#14284a',
    selectionFg: '#d4d4d4',
    imageBrightness: 0.75,
    svgOpacity: 0.75,
  },
  indoor: {
    fg: '#d4d4d4',
    link: '#86a8ff',
    hairline: '#1f1f1f',
    selectionBg: '#1a3a6a',
    selectionFg: '#e8e8e8',
    imageBrightness: 0.82,
    svgOpacity: 0.82,
  },
  sunlight: {
    fg: '#f5f5f5',
    link: '#a9c8ff',
    hairline: '#333333',
    selectionBg: '#22477f',
    selectionFg: '#f5f5f5',
    imageBrightness: 0.9,
    svgOpacity: 0.9,
  },
}

/**
 * AMOLED anti-reflective dark — the one theme. TOTAL antireflection:
 * the whole screen goes matte, not just some surfaces.
 *
 * Anti-reflective = every glare source removed, like a matte screen:
 * - True #000000 EVERYWHERE: a blanket background-color takeover kills every
 *   light surface (buttons, cards, table cells, inline styles) — not just
 *   known panels. Blanket *plain-color* rules are compositor-cheap; the
 *   perf ban (AGENTS.md) is on blanket backdrop-filter, still enforced.
 * - Text at the glare level's luminance: dim in the dark, bright in
 *   daylight — the software answer to a reflective veil.
 * - Glow removal: box-shadow and text-shadow blanketed away; hairlines
 *   forced dark instead of light.
 * - Native glare sources: Chrome's pale-blue autofill box is forced black
 *   with an inset shadow; file-picker buttons get the same tones.
 * - Images (and svg artwork) pulled down to the level's brightness when
 *   dimImages is on.
 *
 * Known boundary (honest): a photo painted via `background-image` cannot be
 * selectively dimmed — CSS has no selector for "element that has one".
 * img/video-adjacent content dims; CSS-background photos stay full-bright.
 *
 * Solid colors only: no backdrop-filter, no JS color rewriting, no loops.
 */
export function buildAmoledCss(glare: ResolvedGlare = 'indoor'): string {
  const t = GLARE_TONES[glare]
  return [
    `:root{--tp-bg:#000000;--tp-fg:${t.fg}}`,
    `html,body{background-color:#000000!important;color:${t.fg}!important}`,
    'html{color-scheme:dark}',
    // The blanket takeover — every surface, pseudo-element included.
    `*,*::before,*::after{background-color:#000000!important;color:${t.fg}!important;border-color:${t.hairline}!important;box-shadow:none!important;text-shadow:none!important}`,
    // Links keep one accent (specificity beats the blanket `*` naturally).
    `a{color:${t.link}!important}`,
    // Inputs' caret stays visible on black.
    `input,textarea{caret-color:${t.fg}!important}`,
    // Chrome/WebKit autofill paints a pale-blue box that survives ordinary
    // background rules. A huge inset shadow forces it black; the pseudo-class
    // rule outranks the blanket `*` on specificity.
    `input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus{box-shadow:0 0 0 1000px #000000 inset!important;-webkit-text-fill-color:${t.fg}!important;caret-color:${t.fg}!important}`,
    // Native file pickers draw their own button widget.
    `input::file-selector-button{background-color:#000000!important;color:${t.fg}!important;border-color:${t.hairline}!important}`,
    `::selection{background:${t.selectionBg}!important;color:${t.selectionFg}}`,
  ].join('')
}

/**
 * Builds the full CSS for a GlobalSettings. Defensive clamping is repeated
 * here on purpose: normalizeSettings already clamps, but this function may
 * be fed values from anywhere, and CSS-injection must never trust input.
 *
 * `glare` is the already-resolved level (sensor/clock). Omit it and a
 * manual setting is honored directly; `auto` falls back to the neutral
 * indoor tuning because this pure function has no environment to read.
 */
export function buildThemeCss(g: GlobalSettings, glare?: ResolvedGlare): string | null {
  const rules: string[] = []
  const level: ResolvedGlare = glare ?? (g.glare === 'auto' ? 'indoor' : g.glare)

  if (g.theme === 'amoled') {
    rules.push(buildAmoledCss(level))
    if (g.dimImages) {
      // The anti-glare of antireflective: bright photos are the biggest
      // glare source on OLED in the dark. Images only — filters on video
      // cost composite layers for little gain (perf budget).
      const tone = GLARE_TONES[level]
      rules.push(`img{filter:brightness(${cssNum(tone.imageBrightness)})!important}`)
      // White-filled SVG artwork (icons, logos) glares the same way.
      rules.push(`svg{opacity:${cssNum(tone.svgOpacity)}!important}`)
    }
  }

  if (g.fontSize !== 100) {
    // Two-pronged: `:root` scales rem-based sites; `body !important` scales
    // sites that size text in px but inherit body's font-size.
    rules.push(`html{font-size:${clamp(g.fontSize, 80, 200)}%}`)
    rules.push(`body{font-size:${clamp(g.fontSize, 80, 200)}%!important}`)
  }

  if (g.lineHeight !== 0) {
    rules.push(`body{line-height:${clamp(g.lineHeight, 1, 2)}!important}`)
  }

  if (g.maxWidthCh !== 0) {
    rules.push(`body{max-width:${clamp(g.maxWidthCh, 40, 100)}ch;margin-inline:auto}`)
  }

  if (g.animations === 'off') {
    rules.push('*,*::before,*::after{animation:none!important;transition:none!important}')
    rules.push('html{scroll-behavior:auto!important}')
  }

  if (g.smoothScroll && g.animations !== 'off') {
    rules.push('html{scroll-behavior:smooth}')
  }

  if (rules.length === 0) return null
  return rules.join('')
}
