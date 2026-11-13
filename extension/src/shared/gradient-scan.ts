/**
 * Gradient-background neutraliser.
 *
 * Runs only while the AMOLED theme is on. It finds gradient-only surfaces in
 * the document (stylesheet rules + inline styles), verifies the computed
 * value, and removes the paint with an inline `background-image:none`.
 * Everything is restored when the theme is turned off.
 *
 * Why a scan instead of a CSS rule: `background-color:#000` cannot remove
 * `background-image`, and a blanket `background-image:none` would kill icon
 * sprites, logos and gradient text. Safety rules live in `backgrounds.ts`.
 *
 * Bounded work: candidate elements are drained in ~8 ms slices; DOM changes
 * rescan after a debounce. Cross-origin stylesheets are unreadable by design
 * — their gradients stay until an inline value gives them away.
 */

import { isGradientSurface } from './backgrounds'

interface SavedBackground {
  value: string
  priority: string
}

export interface GradientNeutralizer {
  enable(): void
  disable(): void
}

const SCAN_DEBOUNCE_MS = 500
const DRAIN_SLICE_MS = 8
const DRAIN_DELAY_MS = 16

export function createGradientNeutralizer(doc: Document): GradientNeutralizer {
  const view = doc.defaultView
  if (view === null) return { enable() {}, disable() {} }

  const saved = new Map<HTMLElement, SavedBackground>()
  const queue: HTMLElement[] = []
  const queued = new Set<HTMLElement>()
  let enabled = false
  let observer: MutationObserver | null = null
  let scanTimer: number | undefined
  let drainTimer: number | undefined

  const neutralise = (el: HTMLElement) => {
    if (saved.has(el)) return
    const computed = view.getComputedStyle(el)
    const clip =
      `${computed.backgroundClip} ` +
      `${(computed as CSSStyleDeclaration & { webkitBackgroundClip?: string }).webkitBackgroundClip ?? ''}`
    const probe = {
      backgroundImage: computed.backgroundImage,
      backgroundClip: clip,
      width: el.offsetWidth,
      height: el.offsetHeight,
    }
    if (!isGradientSurface(probe)) return

    saved.set(el, {
      value: el.style.getPropertyValue('background-image'),
      priority: el.style.getPropertyPriority('background-image'),
    })
    el.style.setProperty('background-image', 'none', 'important')
  }

  const enqueue = (el: Element) => {
    if (!(el instanceof HTMLElement)) return
    if (el.tagName === 'HTML' || el.tagName === 'BODY') return
    if (saved.has(el) || queued.has(el)) return
    queued.add(el)
    queue.push(el)
  }

  const scheduleDrain = () => {
    if (drainTimer !== undefined) return
    drainTimer = view.setTimeout(drain, DRAIN_DELAY_MS)
  }

  const drain = () => {
    drainTimer = undefined
    if (!enabled) {
      queue.length = 0
      queued.clear()
      return
    }
    const start = view.performance.now()
    while (queue.length > 0 && view.performance.now() - start < DRAIN_SLICE_MS) {
      const el = queue.shift()
      if (el === undefined) break
      queued.delete(el)
      neutralise(el)
    }
    if (queue.length > 0) scheduleDrain()
  }

  /** Collects selectors from rules that paint a gradient. Unreadable sheets
   *  (cross-origin) are skipped; nothing here throws into the page. */
  const collectSelectors = (): string[] => {
    const selectors = new Set<string>()
    const visit = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if (rule.type === 1) {
          const style = (rule as CSSStyleRule).style
          const paint = `${style.backgroundImage} ${style.getPropertyValue('background')}`
          if (paint.includes('gradient(')) {
            const selector = (rule as CSSStyleRule).selectorText
            // Pseudo-elements can't be neutralised through the host element.
            if (selector !== undefined && !selector.includes('::')) selectors.add(selector)
          }
        } else if ('cssRules' in rule) {
          try {
            visit((rule as CSSGroupingRule).cssRules)
          } catch {
            // Malformed conditional rule — skip it.
          }
        }
      }
    }

    for (const sheet of Array.from(doc.styleSheets)) {
      try {
        if (sheet.cssRules !== null) visit(sheet.cssRules)
      } catch {
        // Cross-origin stylesheet: CSSOM access is forbidden, by design.
      }
    }
    for (const sheet of Array.from(doc.adoptedStyleSheets ?? [])) {
      try {
        visit(sheet.cssRules)
      } catch {
        // Ignore malformed constructable sheets.
      }
    }
    return [...selectors]
  }

  const scan = () => {
    if (!enabled) return
    for (const selector of collectSelectors()) {
      try {
        doc.querySelectorAll(selector).forEach(enqueue)
      } catch {
        // Selector not queryable (browser-specific syntax) — skip.
      }
    }
    try {
      doc.querySelectorAll('[style*="gradient"]').forEach(enqueue)
    } catch {
      // Attribute selector unsupported — impossible in practice.
    }
    scheduleDrain()
  }

  const scheduleScan = () => {
    if (!enabled || scanTimer !== undefined) return
    scanTimer = view.setTimeout(() => {
      scanTimer = undefined
      scan()
    }, SCAN_DEBOUNCE_MS)
  }

  const onDomReady = () => scheduleScan()
  const onLoad = () => scheduleScan()

  const enable = () => {
    if (enabled) return
    enabled = true
    doc.addEventListener('DOMContentLoaded', onDomReady)
    view.addEventListener('load', onLoad)
    observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'childList') return scheduleScan()
        const target = record.target
        if (target instanceof HTMLElement && !saved.has(target)) return scheduleScan()
      }
    })
    observer.observe(doc.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    })
    scheduleScan()
  }

  const disable = () => {
    if (!enabled) return
    enabled = false
    observer?.disconnect()
    observer = null
    if (scanTimer !== undefined) {
      view.clearTimeout(scanTimer)
      scanTimer = undefined
    }
    if (drainTimer !== undefined) {
      view.clearTimeout(drainTimer)
      drainTimer = undefined
    }
    queue.length = 0
    queued.clear()
    doc.removeEventListener('DOMContentLoaded', onDomReady)
    view.removeEventListener('load', onLoad)

    for (const [el, previous] of saved) {
      if (previous.value === '') el.style.removeProperty('background-image')
      else el.style.setProperty('background-image', previous.value, previous.priority)
    }
    saved.clear()
  }

  return { enable, disable }
}
