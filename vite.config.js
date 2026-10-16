import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the build works under a GitHub Pages subpath.
  base: './',
  // Models are copied to the site root as-is.
  publicDir: 'js/public',
});
