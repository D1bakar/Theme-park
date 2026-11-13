/**
 * Popup logic. Contains NO business rules: switch/steppers only transform
 * values with UI-constant steps and hand them to the settings store, which
 * normalizes + clamps (schema is the single source of truth).
 *
 * The product is ONE theme: AMOLED anti-reflective. The popup is a power
 * switch + comfort controls. Nothing else.
 */

import type { GlareMode, Settings } from '@/shared/schema'
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

const pwToggle = $('pw-toggle')
const pwValue = $<HTMLElement>('pw-value')
const fsValue = $<HTMLElement>('fs-value')
const lhValue = $<HTMLElement>('lh-value')
const mwValue = $<HTMLElement>('mw-value')
const dmToggle = $('dm-toggle')
const dmValue = $<HTMLElement>('dm-value')
const anToggle = $('an-toggle')
const anValue = $<HTMLElement>('an-value')
const glareButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-glare]'))
const glareGroup = document.querySelector<HTMLElement>('[role="radiogroup"]')
const warning = $('warning')
const restrictedNotice = $('restricted-notice')

let current: Settings | null = null

function renderPower(g: Settings['global']) {
  const on = g.theme === 'amoled'
  pwToggle.setAttribute('aria-checked', String(on))
  pwValue.textContent = on ? 'On' : 'Off'
}

function renderGlareMode(g: Settings['global']) {
  for (const button of glareButtons) {
    const selected = button.dataset.glare === g.glare
    button.setAttribute('aria-checked', String(selected))
    // Roving tabindex: one stop for the whole radiogroup (a11y).
    button.tabIndex = selected ? 0 : -1
  }
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

function renderGlare(g: Settings['global']) {
  dmToggle.setAttribute('aria-checked', String(g.dimImages))
  dmValue.textContent = g.dimImages ? 'Dim' : 'Full'
  anToggle.setAttribute('aria-checked', String(g.animations === 'off'))
  anValue.textContent = g.animations === 'off' ? 'Off' : 'Normal'
}

function render(s: Settings) {
  current = s
  renderPower(s.global)
  renderGlareMode(s.global)
  renderTypography(s.global)
  renderGlare(s.global)
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

// — power switch (AMOLED on / site's own scheme) —
pwToggle.addEventListener('click', () =>
  apply((s) => {
    s.global.theme = s.global.theme === 'amoled' ? 'auto' : 'amoled'
  }),
)

// — glare compensation: auto / night / indoor / sunlight —
for (const button of glareButtons) {
  button.addEventListener('click', () => {
    const mode = button.dataset.glare as GlareMode | undefined
    if (mode === undefined) return
    apply((s) => {
      s.global.glare = mode
    })
  })
}

// Radio-group keyboard contract: arrows move + select, Home/End jump.
glareGroup?.addEventListener('keydown', (event) => {
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
  if (!keys.includes(event.key)) return
  const index = glareButtons.indexOf(document.activeElement as HTMLButtonElement)
  if (index === -1) return
  event.preventDefault()
  let next = index
  if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = glareButtons.length - 1
  else {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
    next = (index + step + glareButtons.length) % glareButtons.length
  }
  const target = glareButtons[next]
  if (target === undefined) return
  target.focus()
  target.click() // selection follows focus, standard radio behavior
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

// — dim images switch (the antireflective in antireflective) —
dmToggle.addEventListener('click', () =>
  apply((s) => {
    s.global.dimImages = !s.global.dimImages
  }),
)

// — animations switch —
anToggle.addEventListener('click', () =>
  apply((s) => {
    s.global.animations = s.global.animations === 'off' ? 'default' : 'off'
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
