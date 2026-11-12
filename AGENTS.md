# AGENTS.md — ThemePark

Rules for AI agents (and humans) working in this repository. Read this before
touching any file. Violating these rules is a bug, no matter how good the code is.

## The contract

1. **No vibe coding.** Every change maps to a GitHub issue. Every issue is
   understood before coding starts. If an agent cannot explain *why* a change
   is needed in one sentence, it does not make the change.
2. **Permission per step.** Agents work in small, explainable increments. Each
   step is described before it is executed. No multi-file mystery commits.
3. **Trunk-based, PR-gated.** `main` is always shippable. All changes land via
   squash-merged PRs referencing their issue (`Closes #N`). No direct pushes
   to `main`, ever — not even by the owner without a PR.
4. **Conventional Commits, scoped.** Format: `type(scope): message`.
   - Scopes: `ext` (extension), `site` (website), `themes` (theme packs),
     `shared` (monorepo-wide), `ci`, `docs`.
   - Types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`.
   - Example: `feat(ext): per-site profile lookup on navigation`.
5. **One concern per branch.** Branches: `feat/…`, `fix/…`, `chore/…`,
   `docs/…` + short slug. If a PR review comment says "this is two PRs", it
   is two PRs.

## Platform truth (do not hallucinate)

- Target: Chrome & Brave, **Manifest V3 only**. No MV2 fallbacks.
- Background is a **service worker** — no DOM, no persistent memory. State
  lives in `chrome.storage`, never in module-level variables that must survive.
- **No inline scripts, no `eval`.** MV3 CSP forbids them. All JS is files.
- Content scripts run in an isolated world. They style pages; they do not
  re-engineer them. Styling = one injected `<style>` tag, not per-element loops.
- **Cannot script:** `chrome://*`, `about:*`, Chrome Web Store, PDF viewer,
  other extensions' pages, and (by default) `file://`. The extension must fail
  gracefully on these — detect and show a friendly message, never throw.
- Browser UI (tabs, toolbar) is styled **only** via a separate theme package
  (`manifest.theme`, no JS allowed in themes). The extension never pretends
  it can modify native UI directly.

## Product rules

- **Privacy is a feature:** zero network requests. No analytics, no CDNs, no
  remote fonts in the extension. All assets bundled. Any PR adding a network
  call is rejected by default.
- **Least privilege:** permissions only grow with a written justification in
  the PR body. `<all_urls>` host permission is required for the product to
  work; nothing beyond that.
- **Accessibility is not optional:** honor `prefers-reduced-motion`; keyboard
  navigable popup/options; WCAG AA contrast for user-facing UI; label
  everything. A perf improvement that breaks a11y is not an improvement.
- **Performance budget:** content-script injection < ~100 ms; popup open
  < 50 ms. Anything touching the injection path must state its perf impact
  in the PR body.

## Engineering

- TypeScript strict. The settings schema in `extension/src/shared/schema.ts`
  is the single source of truth — never duplicate it.
- Commits reference issues; issues live on the GitHub Project board
  (Backlog → Ready → In Progress → In Review → Done).
- Irreversible decisions get an ADR in `docs/adr/NNN-title.md` before the PR
  that implements them.
- Tests: unit (Vitest) for schema, CSS compiler, theme generator; e2e
  (Playwright) for injection, popup, shortcuts. New features ship with tests
  or a stated reason why they can't be tested.
- Dependencies: add only when the need is real. Justify each new dependency
  in the PR body. No dependencies in the extension runtime beyond what WXT
  requires.

## Definition of done (per PR)

- [ ] CI green (lint, typecheck, unit, build, zip artifact)
- [ ] Works without errors on restricted pages (graceful degradation)
- [ ] `prefers-reduced-motion` respected
- [ ] No new permissions without justification
- [ ] No network calls added
- [ ] Tested manually on Chrome, described in the PR body
