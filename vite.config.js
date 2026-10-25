// Builds dist/index.html: the page, its styles and scripts in one self-contained file (for GitHub Pages, or any host).
import {defineConfig} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {viteSingleFile} from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',
  plugins: [svelte(), viteSingleFile()],
});
