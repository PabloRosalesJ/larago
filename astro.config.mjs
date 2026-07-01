// @ts-check

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://pablorosalesj.github.io',
  base: '/larago',
  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react()],
});