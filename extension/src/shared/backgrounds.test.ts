import { describe, expect, it } from 'vitest'

import { isGradientSurface, MIN_GRADIENT_AREA, MIN_GRADIENT_HEIGHT } from './backgrounds'

const big = { width: 320, height: 120 }

describe('isGradientSurface — what is safe to neutralise', () => {
  it('recognises large gradient-only surfaces', () => {
    expect(
      isGradientSurface({
        ...big,
        backgroundImage: 'linear-gradient(90deg, rgb(255, 255, 255), rgb(200, 220, 255))',
        backgroundClip: 'border-box',
      }),
    ).toBe(true)
  })

  it('recognises repeating and radial gradients', () => {
    expect(
      isGradientSurface({
        ...big,
        backgroundImage: 'repeating-linear-gradient(45deg, #fff, #fff 4px, #eee 4px, #eee 8px)',
        backgroundClip: 'border-box',
      }),
    ).toBe(true)
    expect(
      isGradientSurface({
        ...big,
        backgroundImage: 'radial-gradient(circle at center, #fff, #000)',
        backgroundClip: 'border-box',
      }),
    ).toBe(true)
  })

  it('never touches gradient text (background-clip: text)', () => {
    expect(
      isGradientSurface({
        ...big,
        backgroundImage: 'linear-gradient(90deg, #fff, #f0f)',
        backgroundClip: 'text',
      }),
    ).toBe(false)
    expect(
      isGradientSurface({
        ...big,
        backgroundImage: 'linear-gradient(90deg, #fff, #f0f)',
        backgroundClip: '-webkit-text',
      }),
    ).toBe(false)
  })

  it('never touches mixed photo + gradient layers', () => {
    expect(
      isGradientSurface({
        ...big,
        backgroundImage: 'linear-gradient(rgba(0,0,0,.4), rgba(0,0,0,.4)), url("hero.jpg")',
        backgroundClip: 'border-box',
      }),
    ).toBe(false)
  })

  it('ignores thin strips — progress bars and skeletons are content', () => {
    expect(
      isGradientSurface({
        width: 300,
        height: MIN_GRADIENT_HEIGHT - 1,
        backgroundImage: 'linear-gradient(90deg, #0f0, #0a0)',
        backgroundClip: 'border-box',
      }),
    ).toBe(false)
  })

  it('ignores small widgets even when they are tall enough', () => {
    expect(
      isGradientSurface({
        width: 40,
        height: 40,
        backgroundImage: 'linear-gradient(90deg, #fff, #000)',
        backgroundClip: 'border-box',
      }),
    ).toBe(false)
    expect(MIN_GRADIENT_AREA).toBeGreaterThan(40 * 40)
  })

  it('ignores elements with no background image', () => {
    expect(
      isGradientSurface({ ...big, backgroundImage: 'none', backgroundClip: 'border-box' }),
    ).toBe(false)
    expect(isGradientSurface({ ...big, backgroundImage: '', backgroundClip: 'border-box' })).toBe(
      false,
    )
  })

  it('ignores solid-color backgrounds', () => {
    expect(
      isGradientSurface({
        ...big,
        backgroundImage: 'url("icon.png")',
        backgroundClip: 'border-box',
      }),
    ).toBe(false)
  })
})
