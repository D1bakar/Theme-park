/**
 * Background-layer rules — pure, no DOM, unit-testable.
 *
 * `background-color:#000` does not remove `background-image`. Gradients are
 * the biggest remaining bright surface: hero sections, buttons and cards
 * frequently paint `linear-gradient(...)` over the black takeover. The
 * content script neutralises gradient-only backgrounds; these predicates
 * decide which elements are safe to touch.
 *
 * Safety rules (learned from what breaks):
 * - `background-clip: text` gradients ARE the text; removing them makes
 *   headings invisible. Never touch.
 * - Mixed `url(...)` + gradient layers may be a photo with a scrim; leaving
 *   them alone avoids misaligning multi-layer background geometry.
 * - Thin elements are progress bars and skeleton loaders; their gradient is
 *   the content. Size thresholds keep them visible.
 */

/** Ignore anything smaller than this (≈50×50px). */
export const MIN_GRADIENT_AREA = 2500

/** Ignore thin strips — progress bars, skeletons, dividers. */
export const MIN_GRADIENT_HEIGHT = 24

export interface BackgroundProbe {
  /** Computed `background-image`. */
  backgroundImage: string
  /** Computed `background-clip` (standard and/or -webkit-). */
  backgroundClip: string
  /** Rendered box, in CSS pixels. */
  width: number
  height: number
}

/**
 * True when the element's visible background is a gradient-only paint that
 * is large enough to be decorative surface rather than functional content.
 */
export function isGradientSurface(probe: BackgroundProbe): boolean {
  const image = probe.backgroundImage
  if (image === '' || image === 'none') return false
  if (!image.includes('gradient(')) return false
  // A photo behind a gradient scrim: leave the layer stack intact.
  if (image.includes('url(')) return false
  // Gradient text must keep its paint.
  if (probe.backgroundClip.includes('text')) return false
  if (probe.width * probe.height < MIN_GRADIENT_AREA) return false
  if (probe.height < MIN_GRADIENT_HEIGHT) return false
  return true
}
