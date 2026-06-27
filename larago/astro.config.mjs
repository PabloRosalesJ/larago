import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

export default defineConfig({
  site: 'https://larago.dev',
  trailingSlash: 'always',

  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react()],
});