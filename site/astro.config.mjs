// @ts-check
import { defineConfig } from 'astro/config';

// Static site. `site` gets set when the production URL is known (before
// adding sitemap). Theme toggle is a tiny inline script in the layout —
// zero framework JS shipped to visitors.
export default defineConfig({
  prefetch: { defaultStrategy: 'hover' },
  build: {
    inlineStylesheets: 'always',
  },
});
