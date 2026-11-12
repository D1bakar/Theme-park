import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from './schema'
import { createSettingsStore, type StorageAdapter } from './storage'

/** In-memory adapter mirroring chrome.storage semantics for tests. */
function makeFakeAdapter() {
  const data = new Map<string, unknown>()
  const watchers = new Set<(key: string, value: unknown) => void>()
  const adapter: StorageAdapter = {
    async get(key) {
      return data.get(key)
    },
    async set(key, value) {
      data.set(key, value)
      for (const w of watchers) w(key, value)
    },
    watch(callback) {
      watchers.add(callback)
      return () => watchers.delete(callback)
    },
  }
  return { adapter, data }
}

const sample: Settings = {
  version: 1,
  global: {
    theme: 'dark',
    fontSize: 120,
    lineHeight: 0,
    maxWidthCh: 0,
    animations: 'default',
    smoothScroll: false,
  },
  sites: { 'example.com': { enabled: true, theme: 'light' } },
}

describe('createSettingsStore', () => {
  it('load returns defaults when nothing is stored', async () => {
    const { adapter } = makeFakeAdapter()
    const store = createSettingsStore(adapter)
    await expect(store.load()).resolves.toEqual(DEFAULT_SETTINGS)
  })

  it('save → load round-trips valid settings', async () => {
    const { adapter } = makeFakeAdapter()
    const store = createSettingsStore(adapter)
    await store.save(sample)
    await expect(store.load()).resolves.toEqual(sample)
  })

  it('load normalizes corrupt storage instead of crashing', async () => {
    const { adapter } = makeFakeAdapter()
    adapter.set('settings', { global: { fontSize: 'ninety', theme: 7 }, sites: 'nope' })
    const store = createSettingsStore(adapter)
    await expect(store.load()).resolves.toEqual(DEFAULT_SETTINGS)
  })

  it('save normalizes before persisting, so storage never holds garbage', async () => {
    const { adapter, data } = makeFakeAdapter()
    const store = createSettingsStore(adapter)
    await store.save({ ...sample, global: { ...sample.global, fontSize: 999 } })
    const persisted = normalizeSettings(data.get('settings'))
    expect(persisted.global.fontSize).toBe(200)
  })

  it('watch fires with normalized settings on every save', async () => {
    const { adapter } = makeFakeAdapter()
    const store = createSettingsStore(adapter)
    const seen: Settings[] = []
    store.watch((s) => seen.push(s))
    await store.save(sample)
    await store.save({ ...sample, global: { ...sample.global, theme: 'amoled', fontSize: 250 } })
    expect(seen).toHaveLength(2)
    expect(seen[0]).toEqual(sample)
    expect(seen[1]?.global.theme).toBe('amoled')
    expect(seen[1]?.global.fontSize).toBe(200) // clamped by watch-side normalize
  })

  it('watch ignores changes to other keys', async () => {
    const { adapter } = makeFakeAdapter()
    const store = createSettingsStore(adapter)
    const cb = vi.fn()
    store.watch(cb)
    await adapter.set('unrelated', { x: 1 })
    expect(cb).not.toHaveBeenCalled()
  })

  it('unsubscribing stops the callbacks', async () => {
    const { adapter } = makeFakeAdapter()
    const store = createSettingsStore(adapter)
    const cb = vi.fn()
    const un = store.watch(cb)
    un()
    await store.save(sample)
    expect(cb).not.toHaveBeenCalled()
  })
})
