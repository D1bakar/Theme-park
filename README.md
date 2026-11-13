# ThemePark

**AMOLED antireflective theme — one extension, one theme, total browsing antireflection.**

ThemePark gives you a single AMOLED antireflective theme that maximizes legibility through external-light reflections:

- **True #000000 everywhere** — buttons, cards, table cells, inline styles, scrollbars. No light surfaces survive.
- **Adaptive glare** — text luminance follows the light around you (night → indoor → sunlight) so content is legible in any condition.
- **Per-site profiles** — fine-grained control over font size, line height, reading width, and animations — globally or per site.
- **Privacy-first** — zero network requests. No analytics. No accounts. All settings live in your browser.

> **Privacy:** no analytics, no accounts, no network requests. See the [privacy page](https://themepark-site-jet.vercel.app/privacy/) — and since the code is public, verify it yourself.

[![CI](https://github.com/D1bakar/Theme-park/actions/workflows/ci.yml/badge.svg)](https://github.com/D1bakar/Theme-park/actions/workflows/ci.yml)

## Install

**From the website (easiest):** [themepark-site-jet.vercel.app](https://themepark-site-jet.vercel.app) → click **Install ThemePark** → unzip → load unpacked (3 steps on the page).

**Direct:** [latest release zip](https://github.com/D1bakar/Theme-park/releases/latest/download/ThemePark-chrome.zip).

## How it works

### AMOLED antireflective

True #000000 EVERYWHERE — a blanket background-color takeover kills every light surface (buttons, cards, table cells, inline styles) — not just known panels. This is the software answer to a reflective veil: the OLED panel emits nothing, so external reflections are the only source of glare.

### Adaptive glare

Text luminance moves with the light around you:

- **Night:** dim text to avoid OLED halation in a dark room. Images dimmed hardest.
- **Indoor:** neutral tuning for ordinary indoor lighting. The default setting.
- **Sunlight:** pure white text for maximum contrast through the reflective veil. Links and hairlines brighten.

AmbientLightSensor reads the light around your screen (when available), and local time is the fallback. Hysteresis and a three-sample debounce prevent clouds and passing shadows from flickering the page.

### Per-site profiles

Fine-grained control over:

- Font size, line height, reading width (comfort controls)
- Animation smoothness (smooth scroll, reduced motion)
- Per-site profiles (save presets for different sites)

### Privacy-first

ThemePark has no servers, no analytics, no accounts, and makes no network requests. Everything it does — themes, fonts, animation settings, per-site profiles — is computed and stored locally in your browser using Chrome's storage APIs.

The extension reads the pages you visit only to apply the visual settings you chose (colors, fonts, motion). It never sends page content, URLs, or usage data anywhere.

## Known limits

ThemePark is software-only: it maximizes legibility through external-light reflections, but it cannot remove physical reflections or apply a matte coating. Known limitations:

- **Photos via background-image** — CSS has no selector for "element that has one", so photos painted this way stay full-bright. Gradient-only backgrounds are neutralised.
- **Closed shadow DOM** — styles inside shadow trees are not reachable.
- **Video and canvas** — these are rendered by the page, not by CSS.
- **Chrome:// pages, PDF viewer, and other restricted pages** — these are out of scope for this extension.

## License

MIT

## Links

- [Website](https://themepark-site-jet.vercel.app)
- [GitHub](https://github.com/D1bakar/Theme-park)
- [Privacy Policy](https://themepark-site-jet.vercel.app/privacy)
- [Release Downloads](https://github.com/D1bakar/Theme-park/releases)
