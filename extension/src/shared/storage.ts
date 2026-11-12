/**
 * Typed settings storage over chrome.storage (AGENTS.md: state lives in
 * chrome.storage, never in SW module state).
 *
 * Design: the chrome-specific adapter is dependency-injected so this module
 * is pure and unit-testable — chrome is undefined under Vitest. The store
 * never throws: every read passes through normalizeSettings(), so corrupt
 * or partial storage data degrades to defaults, never to a crash.
 */

import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from './schema'

const STORAGE_KEY = 'settings'

/** The slice of chrome.storage our adapter needs. Mirrors the real API. */
export interface StorageAdapter {
  /** Resolves with the stored value for the key, or undefined. */
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  /** Calls back on every change to the area; returns an unsubscribe fn. */
  watch(callback: (key: string, value: unknown) => void): () => void
}

/** Adapter bound to a real chrome.storage area. Sync is the primary area. */
export function createChromeStorageAdapter(area: 'sync' | 'local' = 'sync'): StorageAdapter {
  const storageArea = area === 'local' ? chrome.storage.local : chrome.storage.sync
  return {
    async get(key) {
      const result = await storageArea.get(key)
      return result[key]
    },
    async set(key, value) {
      await storageArea.set({ [key]: value })
    },
    watch(callback) {
      const listener = (changes: Record<string, { newValue?: unknown }>, changedArea: string) => {
        if (changedArea !== area) return
        for (const [key, change] of Object.entries(changes)) callback(key, change.newValue)
      }
      chrome.storage.onChanged.addListener(listener)
      return () => chrome.storage.onChanged.removeListener(listener)
    },
  }
}

export interface SettingsStore {
  /** Loads settings, normalized. Never throws; defaults on any failure. */
  load(): Promise<Settings>
  /** Persists settings. Throws only on storage write failure (rare, real). */
  save(settings: Settings): Promise<void>
  /** Subscribes to settings changes; callback receives normalized settings. */
  watch(callback: (settings: Settings) => void): () => void
}

export function createSettingsStore(adapter: StorageAdapter): SettingsStore {
  return {
    async load() {
      try {
        const value = await adapter.get(STORAGE_KEY)
        return value === undefined ? DEFAULT_SETTINGS : normalizeSettings(value)
      } catch {
        // Storage read failures (e.g. unavailable area) must not crash the
        // extension — run on defaults and let the UI warn instead.
        return DEFAULT_SETTINGS
      }
    },
    async save(settings) {
      await adapter.set(STORAGE_KEY, normalizeSettings(settings))
    },
    watch(callback) {
      return adapter.watch((key, value) => {
        if (key === STORAGE_KEY) callback(normalizeSettings(value))
      })
    },
  }
}

/**
 * Lazily-initialized default store for production use (chrome.storage.sync).
 * Lazy on purpose: module-eval must not touch `chrome`, so this module stays
 * importable in plain unit tests.
 */
let defaultStore: SettingsStore | null = null
export function getSettingsStore(): SettingsStore {
  defaultStore ??= createSettingsStore(createChromeStorageAdapter('sync'))
  return defaultStore
}
