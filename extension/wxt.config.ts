import { defineConfig } from 'wxt'

// The generated manifest. WXT fills in version, icons and entrypoint
// wiring automatically; we only declare product identity and permissions.
// Least privilege (AGENTS.md): storage only, for as long as that is enough.
export default defineConfig({
  srcDir: 'src',
  // Visible output dir — CI artifact upload globs can't match hidden
  // directories like the default `.output`, and non-hidden paths are
  // friendlier to tooling everywhere.
  outDir: 'build',
  manifest: {
    name: 'ThemePark',
    short_name: 'ThemePark',
    description:
      'Fine-grained control of site appearance, smoothness and readability — themes, fonts, animations, per-site profiles. All local, no data leaves your device.',
    permissions: ['storage'],
    // Host permission justification (AGENTS.md requires written rationale):
    // the product applies user-chosen styling to pages the user visits, and
    // content scripts cannot match <all_urls> without the equivalent host
    // permission. No other host access exists: no fetches, no webRequest,
    // no data leaves the device. Rationale: docs/adr/0001-host-permissions.md.
    host_permissions: ['<all_urls>'],
  },
})
