/**
 * Generates the Liquid Glass theme pack's PNG assets — the macOS Sonoma-style
 * wallpaper and window frame strips.
 *
 * Zero dependencies, zero network: PNG is hand-assembled (RGB8, zlib deflate,
 * manual CRC32) so this runs on any stock Node. Outputs are committed, so the
 * script only needs re-running when the gradient design changes.
 *
 * Usage: node scripts/gen-theme-assets.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'themes', 'liquid-glass', 'assets')

// ---- Gradient definition (must visually match extension glass wallpaper) ----
// Diagonal base gradient, same stops as buildGlassCss().
const STOPS = [
  { u: 0.0, c: [34, 69, 110] }, // #22456e deep blue
  { u: 0.38, c: [60, 58, 114] }, // #3c3a72 indigo
  { u: 0.68, c: [111, 74, 126] }, // #6f4a7e violet
  { u: 1.0, c: [154, 91, 128] }, // #9a5b80 rose
]
// Soft light glows: [x, y, radius(fraction of diag), color, alpha]
const GLOWS = [
  [0.12, 0.08, 0.75, [96, 148, 224], 0.42], // cool blue, top-left
  [0.88, 0.92, 0.7, [236, 124, 180], 0.3], // warm pink, bottom-right
]

const lerp = (a, b, t) => a + (b - a) * t

function baseColor(u) {
  let a = STOPS[0]
  let b = STOPS[STOPS.length - 1]
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (u >= STOPS[i].u && u <= STOPS[i + 1].u) {
      a = STOPS[i]
      b = STOPS[i + 1]
      break
    }
  }
  const t = (u - a.u) / (b.u - a.u || 1)
  return [lerp(a.c[0], b.c[0], t), lerp(a.c[1], b.c[1], t), lerp(a.c[2], b.c[2], t)]
}

// Deterministic dither noise — kills gradient banding, keeps builds reproducible.
let seed = 0x9e3779b9
function noise() {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return (seed / 0xffffffff) * 2 - 1
}

function renderPixel(x, y, w, h) {
  const u = 0.42 * (x / w) + 0.58 * (y / h)
  let [r, g, b] = baseColor(Math.min(1, Math.max(0, u)))

  const diag = Math.hypot(w, h)
  for (const [gx, gy, gr, gc, ga] of GLOWS) {
    const d = Math.hypot((x / w - gx) * (w / diag), (y / h - gy) * (h / diag)) / gr
    if (d < 1) {
      const fall = (1 - d) * (1 - d) * ga
      r = lerp(r, gc[0], fall)
      g = lerp(g, gc[1], fall)
      b = lerp(b, gc[2], fall)
    }
  }
  const n = noise()
  return [
    Math.min(255, Math.max(0, Math.round(r + n))),
    Math.min(255, Math.max(0, Math.round(g + n))),
    Math.min(255, Math.max(0, Math.round(b + n))),
  ]
}

// ---- Minimal PNG encoder (RGB8, no filter = fast and simple) ----
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
function crc32(buf) {
  let c = -1
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function encodePng(w, h, rgb) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor RGB
  const raw = Buffer.alloc(h * (w * 3 + 1))
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0 // filter: none
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function renderImage(name, w, h, { uFrom = 0, uTo = 1, uXWeight = 0.42, brightness = 1 } = {}) {
  const rgb = Buffer.alloc(w * h * 3)
  const [gx, gy, gr, gc, ga] = GLOWS[0]
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = uFrom + (uTo - uFrom) * (uXWeight * (x / w) + (1 - uXWeight) * (y / h))
      const [br, bg, bb] = baseColor(Math.min(1, Math.max(0, u)))
      // Top-left blue glow, in normalized image space (same shape as wallpaper).
      const d = Math.hypot(x / w - gx, y / h - gy) / gr
      const fall = d < 1 ? (1 - d) * (1 - d) * ga : 0
      const r = lerp(br, gc[0], fall)
      const g = lerp(bg, gc[1], fall)
      const b = lerp(bb, gc[2], fall)
      const i = (y * w + x) * 3
      rgb[i] = Math.min(255, Math.max(0, Math.round(r * brightness)))
      rgb[i + 1] = Math.min(255, Math.max(0, Math.round(g * brightness)))
      rgb[i + 2] = Math.min(255, Math.max(0, Math.round(b * brightness)))
    }
  }
  const png = encodePng(w, h, rgb)
  writeFileSync(join(OUT, name), png)
  console.log(`wrote ${name} ${w}x${h} (${(png.length / 1024).toFixed(0)} KB)`)
}

mkdirSync(OUT, { recursive: true })
// New-tab wallpaper: covers the viewport at any reasonable window size.
renderImage('wallpaper.png', 2400, 1500)
// Window frame strip: top band of the same gradient, left → right.
renderImage('frame.png', 2000, 96, { uFrom: 0, uTo: 0.45, uXWeight: 0.95 })
renderImage('frame-inactive.png', 2000, 96, {
  uFrom: 0,
  uTo: 0.45,
  uXWeight: 0.95,
  brightness: 0.82,
})
