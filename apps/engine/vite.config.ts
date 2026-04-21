import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 1024 * 1024,
  },
  server: {
    port: 4173,
  },
});
