// ThemePark service worker (MV3 background).
//
// Platform rules (AGENTS.md): no DOM access, no persistent module state,
// no inline scripts. All state lives in chrome.storage. This file starts
// as a lifecycle stub so the build pipeline is proven before any feature
// code lands.
export default defineBackground(() => {
  // eslint-disable-next-line no-console
  console.log('[ThemePark] service worker started');
});
