import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build also runs from a GitHub Pages subpath.
  base: './',
  // The .glb models are copied to the site root as-is.
  publicDir: 'js/public',
});
