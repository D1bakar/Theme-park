# ThemePark

**Total browsing customization for Chrome & Brave — one extension.**

ThemePark gives you fine-grained control over how the web looks, feels and reads:
site appearance (dark / light / AMOLED themes with your own accents), smoothness
(animation control that honors reduced motion), and readability (font, size,
line-height, reading width) — globally or per site, with presets, per-site
profiles and keyboard shortcuts. Everything runs locally.

> **Privacy:** no analytics, no accounts, no network requests. All settings live
> in your browser. See the [privacy page](https://themepark-site-jet.vercel.app/privacy/)
> — and since the code is public, verify it yourself.

[![CI](https://github.com/D1bakar/Theme-park/actions/workflows/ci.yml/badge.svg)](https://github.com/D1bakar/Theme-park/actions/workflows/ci.yml)

## Install

**From the website (easiest):** [themepark-site-jet.vercel.app](https://themepark-site-jet.vercel.app)
→ click **Install ThemePark** → unzip → load unpacked (3 steps on the page).

**Direct:** [latest release zip](https://github.com/D1bakar/Theme-park/releases/latest/download/ThemePark-chrome.zip)
→ unzip → `chrome://extensions` → Developer mode → **Load unpacked** → pick the folder.

**Chrome Web Store:** planned — the store build is the same zip, review pending.

Works on Chrome and Brave (any Chromium browser, MV3). Not on Firefox or Safari.

## Status

| Milestone | Scope | State |
|---|---|---|
| M0 — infra | repo, CI, releases, website, governance | ✅ done |
| M1 — core | schema → storage → theme engine → popup + glass mode | ✅ done |
| Theme packs | browser-chrome themes (Liquid Glass shipped, more planned) | 🚧 partial |
| M2 — per-site profiles | hostname overrides, options page | planned |
| M3 — smoothness + readability | animation control, font/width engine polish | planned |
| M4 — presets + shortcuts | named presets, `commands` API | planned |
| M5 — more theme packs | remaining packs + in-extension switching | planned |
| M6 — store | Web Store listing and submission | planned |

## Repository layout

```
extension/   MV3 extension (WXT + TypeScript) — the product
site/        Astro website — install hub, themes, privacy
themes/      Companion browser-chrome theme packs (manifest-only)
docs/        Architecture decisions (ADRs) and engineering docs
```

## Development

```bash
pnpm install          # once, at the repo root (workspace: extension, site, themes/*)
pnpm ext:dev          # extension dev mode (loads into your browser with HMR)
pnpm ext:build        # production build → extension/build/chrome-mv3
pnpm site:dev         # website dev server
pnpm lint             # biome check (format + lint, whole monorepo)
pnpm --filter extension test   # unit tests (vitest)
```

Requires Node ≥ 22.12 and pnpm ≥ 12.

## Contributing

See [AGENTS.md](AGENTS.md) — the engineering contract: conventional commits,
trunk-based with PR-gated `main`, least-privilege permissions, zero network
calls, accessibility is not optional. CI enforces it.

## License

[MIT](LICENSE)
