/**
 * ThemePark settings schema — THE single source of truth (AGENTS.md).
 *
 * Rules for this file:
 * - Pure TypeScript, zero imports, zero side effects. Must be importable
 *   from the service worker, content scripts, popup and options page alike.
 * - Every field here has an entry in normalizeSettings(). Unknown/stale
 *   storage data must never crash the extension — it normalizes instead.
 * - Never duplicate these types elsewhere. Import from here.
 */

/** User-facing theme mode. `auto` follows prefers-color-scheme. */
export type ThemeMode = 'auto' | 'light' | 'dark' | 'amoled' | 'glass'

/** Animation control. `default` = touch nothing; `off` = kill all. */
export type AnimationMode = 'default' | 'off'

export interface GlobalSettings {
  /** Global color scheme applied to every page without a site profile. */
  theme: ThemeMode
  /** Base font size for body text, in percent of the site's own. 80–200. */
  fontSize: number
  /** Line-height for body text. 1.0–2.0. */
  lineHeight: number
  /** Max reading width in ch units. 0 = leave sites alone. 40–100. */
  maxWidthCh: number
  /** Kill-switch for CSS animations/transitions on all pages. */
  animations: AnimationMode
  /** Force scroll-behavior: smooth on the document element. */
  smoothScroll: boolean
}

/**
 * Per-site profile. Every field is optional — a profile stores only what
 * the user changed (differential override of GlobalSettings).
 */
export type SiteProfile = Partial<GlobalSettings> & {
  /** Master switch for the profile without deleting the user's values. */
  enabled: boolean
}

export interface Settings {
  /** Schema version, for future migrations. Bump when shape changes. */
  version: 1
  global: GlobalSettings
  /** Keyed by hostname (e.g. 'example.com'). */
  sites: Record<string, SiteProfile>
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  theme: 'auto',
  fontSize: 100,
  lineHeight: 0, // 0 = leave site's own line-height alone
  maxWidthCh: 0, // 0 = leave site's own width alone
  animations: 'default',
  smoothScroll: false,
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  global: DEFAULT_GLOBAL_SETTINGS,
  sites: {},
}

const THEME_MODES: ThemeMode[] = ['auto', 'light', 'dark', 'amoled', 'glass']
const ANIMATION_MODES: AnimationMode[] = ['default', 'off']

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

const oneOf = <T extends string>(value: unknown, allowed: T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

/**
 * Normalizes unknown input (storage reads, imports, legacy data) into a
 * valid Settings object. Unknown fields are dropped, out-of-range numbers
 * are clamped, garbage falls back to defaults. Never throws.
 */
export function normalizeSettings(input: unknown): Settings {
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
  const global = (
    typeof raw.global === 'object' && raw.global !== null ? raw.global : {}
  ) as Record<string, unknown>

  const fontSize =
    typeof global.fontSize === 'number'
      ? clamp(global.fontSize, 80, 200)
      : DEFAULT_GLOBAL_SETTINGS.fontSize
  const lineHeight =
    typeof global.lineHeight === 'number' && global.lineHeight !== 0
      ? clamp(global.lineHeight, 1.0, 2.0)
      : DEFAULT_GLOBAL_SETTINGS.lineHeight
  const maxWidthCh =
    typeof global.maxWidthCh === 'number' && global.maxWidthCh !== 0
      ? clamp(global.maxWidthCh, 40, 100)
      : DEFAULT_GLOBAL_SETTINGS.maxWidthCh

  const sites: Record<string, SiteProfile> = {}
  if (typeof raw.sites === 'object' && raw.sites !== null) {
    for (const [host, value] of Object.entries(raw.sites as Record<string, unknown>)) {
      // Hostname key sanity: reject anything that doesn't look like a host.
      if (!/^[a-z0-9.-]+$/i.test(host) || typeof value !== 'object' || value === null) continue
      const p = value as Record<string, unknown>
      const profile: SiteProfile = {
        enabled: p.enabled === true,
      }
      if (typeof p.theme === 'string') profile.theme = oneOf(p.theme, THEME_MODES, 'auto')
      if (typeof p.fontSize === 'number') profile.fontSize = clamp(p.fontSize, 80, 200)
      if (typeof p.lineHeight === 'number' && p.lineHeight !== 0)
        profile.lineHeight = clamp(p.lineHeight, 1.0, 2.0)
      if (typeof p.maxWidthCh === 'number' && p.maxWidthCh !== 0)
        profile.maxWidthCh = clamp(p.maxWidthCh, 40, 100)
      if (typeof p.animations === 'string')
        profile.animations = oneOf(p.animations, ANIMATION_MODES, 'default')
      if (typeof p.smoothScroll === 'boolean') profile.smoothScroll = p.smoothScroll
      sites[host] = profile
    }
  }

  return {
    version: 1,
    global: {
      theme: typeof global.theme === 'string' ? oneOf(global.theme, THEME_MODES, 'auto') : 'auto',
      fontSize,
      lineHeight,
      maxWidthCh,
      animations:
        typeof global.animations === 'string'
          ? oneOf(global.animations, ANIMATION_MODES, 'default')
          : 'default',
      smoothScroll: global.smoothScroll === true,
    },
    sites,
  }
}
