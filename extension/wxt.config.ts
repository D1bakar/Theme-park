import { defineConfig } from 'wxt';

// The generated manifest. WXT fills in version, icons and entrypoint
// wiring automatically; we only declare product identity and permissions.
// Least privilege (AGENTS.md): storage only, for as long as that is enough.
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'ThemePark',
    short_name: 'ThemePark',
    description:
      'Fine-grained control of site appearance, smoothness and readability — themes, fonts, animations, per-site profiles. All local, no data leaves your device.',
    permissions: ['storage'],
  },
});
