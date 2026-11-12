# ThemePark — Liquid Glass (browser theme pack)

Manifest-only Chrome theme that styles the **browser chrome** (tabs, toolbar,
omnibox, bookmarks bar, new-tab page) to match the extension's glass mode.

## Why a separate package

Per AGENTS.md platform truth: browser UI cannot be scripted by extensions.
The only sanctioned mechanism is a theme manifest — no JS allowed, so the
pack is static. The extension cannot install or switch themes
programmatically; the user loads this pack once.

## Colors

Same palette as the extension's glass mode: deep gradient base
(`#0a0e18 → #141b2e → #1b1030`), translucent white surfaces (8% alpha on
toolbar/omnibox/buttons where the browser supports RGBA theme colors),
high-luminance `#f5f5f7` text.

## Install

`chrome://extensions` → Developer mode → **Load unpacked** → select this
folder. (Or via the zipped release asset once published.)

## Icons

Toolbar icons are **tinted** (`tints.buttons`), not replaced — no API exists
to swap browser icon artwork. That is a platform limit, documented here and
in the store listing, not a TODO.
