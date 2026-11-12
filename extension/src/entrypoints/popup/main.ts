/**
 * Popup logic. Contains NO business rules: steppers/segments only transform
 * values with UI-constant steps and hand them to the settings store, which
 * normalizes + clamps (schema is the single source of truth).
 */

import type { Settings, ThemeMode } from '@/shared/schema'
import { getSettingsStore } from '@/shared/storage'

const FS_STEP = 5
const LH_STEP = 0.1
const MW_STEP = 5

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id)
  if (el === null) throw new Error(`popup: missing #${id}`)
  return el as T
}

const round1 = (n: number): number => Math.round(n * 10) / 10

const RESTRICTED_PREFIXES = [
  'chrome://',
  'edge://',
  'brave://',
  'about:',
  'chrome-extension://',
  'https://chrome.google.com/webstore',
  'https://chromewebstore.google.com',
]

const themeButtons = document.querySelectorAll<HTMLButtonElement>('#theme-segments button')
const fsValue = $<HTMLElement>('fs-value')
const lhValue = $<HTMLElement>('lh-value')
const mwValue = $<HTMLElement>('mw-value')
const anToggle = $('an-toggle')
const anValue = $<HTMLElement>('an-value')
const ftToggle = $('ft-toggle')
const ftValue = $<HTMLElement>('ft-value')
const warning = $('warning')
const restrictedNotice = $('restricted-notice')

let current: Settings | null = null

function renderTheme(theme: ThemeMode) {
  themeButtons.forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.theme === theme))
  })
}

function renderTypography(g: Settings['global']) {
  fsValue.textContent = `${g.fontSize}%`
  lhValue.textContent = g.lineHeight === 0 ? 'Site default' : String(round1(g.lineHeight))
  mwValue.textContent = g.maxWidthCh === 0 ? 'Off' : `${g.maxWidthCh}ch`
  $('fs-dec').toggleAttribute('disabled', g.fontSize <= 80)
  $('fs-inc').toggleAttribute('disabled', g.fontSize >= 200)
  $('lh-dec').toggleAttribute('disabled', g.lineHeight <= 1.1 && g.lineHeight !== 0)
  $('lh-inc').toggleAttribute('disabled', g.lineHeight >= 2)
  $('mw-dec').toggleAttribute('disabled', g.maxWidthCh <= 45 && g.maxWidthCh !== 0)
  $('mw-inc').toggleAttribute('disabled', g.maxWidthCh >= 100)
}

function renderAnimations(g: Settings['global']) {
  anToggle.setAttribute('aria-checked', String(g.animations === 'off'))
  anValue.textContent = g.animations === 'off' ? 'Off' : 'Normal'
}

function renderFont(g: Settings['global']) {
  ftToggle.setAttribute('aria-checked', String(g.font === 'mac'))
  ftValue.textContent = g.font === 'mac' ? 'Inter' : 'Site'
}

function render(s: Settings) {
  current = s
  renderTheme(s.global.theme)
  renderTypography(s.global)
  renderAnimations(s.global)
  renderFont(s.global)
}

async function apply(mutate: (s: Settings) => void) {
  if (current === null) return
  const next = structuredClone(current)
  mutate(next)
  try {
    await getSettingsStore().save(next)
    render(next) // optimistic; watch() reconciles if another writer exists
  } catch (error) {
    warning.hidden = false
    warning.textContent = 'Could not save settings — is storage available?'
    console.warn('[ThemePark] popup save failed:', error)
  }
}

// — segments —
themeButtons.forEach((btn) => {
  btn.addEventListener('click', () =>
    apply((s) => {
      s.global.theme = btn.dataset.theme as ThemeMode
    }),
  )
})

// — steppers —
$('fs-dec').addEventListener('click', () =>
  apply((s) => {
    s.global.fontSize = Math.max(80, s.global.fontSize - FS_STEP)
  }),
)
$('fs-inc').addEventListener('click', () =>
  apply((s) => {
    s.global.fontSize = Math.min(200, s.global.fontSize + FS_STEP)
  }),
)
$('lh-dec').addEventListener('click', () =>
  apply((s) => {
    s.global.lineHeight =
      s.global.lineHeight === 0 ? 1 : Math.max(1, round1(s.global.lineHeight - LH_STEP))
  }),
)
$('lh-inc').addEventListener('click', () =>
  apply((s) => {
    s.global.lineHeight =
      s.global.lineHeight === 0 ? 1.5 : Math.min(2, round1(s.global.lineHeight + LH_STEP))
  }),
)
$('mw-dec').addEventListener('click', () =>
  apply((s) => {
    s.global.maxWidthCh =
      s.global.maxWidthCh === 0 ? 70 : Math.max(40, s.global.maxWidthCh - MW_STEP)
  }),
)
$('mw-inc').addEventListener('click', () =>
  apply((s) => {
    s.global.maxWidthCh =
      s.global.maxWidthCh === 0 ? 70 : Math.min(100, s.global.maxWidthCh + MW_STEP)
  }),
)

// — animations switch —
anToggle.addEventListener('click', () =>
  apply((s) => {
    s.global.animations = s.global.animations === 'off' ? 'default' : 'off'
  }),
)

// — macOS font switch —
ftToggle.addEventListener('click', () =>
  apply((s) => {
    s.global.font = s.global.font === 'mac' ? 'site' : 'mac'
  }),
)

// — storage watch: reconcile if settings change elsewhere (options page later) —
getSettingsStore().watch((s) => {
  // Only re-render if a value actually differs — avoids fighting the
  // optimistic render and pointless DOM churn while the popup is open.
  if (current === null || JSON.stringify(current.global) !== JSON.stringify(s.global)) render(s)
})

// — init —
async function init() {
  try {
    const [settings] = await Promise.all([getSettingsStore().load()])
    render(settings)

    // Restricted-page notice. url is readable thanks to <all_urls> host
    // permission; no "tabs" permission needed.
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const url = tab?.url ?? ''
    if (RESTRICTED_PREFIXES.some((p) => url.startsWith(p))) {
      restrictedNotice.hidden = false
    }
  } catch (error) {
    warning.hidden = false
    warning.textContent = 'Could not load settings — defaults shown.'
    console.warn('[ThemePark] popup init failed:', error)
  }
}

void init()
