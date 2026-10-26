// Builds each page into one self-contained file (for GitHub Pages, or any host): `vite build` makes dist/index.html, the
// El Niño page; `vite build --mode <case>` makes dist/cases/<case>/index.html from cases/<case>/index.html.
import {defineConfig} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {viteSingleFile} from 'vite-plugin-singlefile';

export default defineConfig(({mode}) => {
  const page = ['production', 'development'].includes(mode) ? null : mode;   // a case, or the El Niño page
  return {
    base: './',
    plugins: [svelte(), viteSingleFile()],
    build: page ? {rollupOptions: {input: `cases/${page}/index.html`}, emptyOutDir: false} : {},
  };
});
