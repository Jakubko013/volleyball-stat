/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      // Android (Capacitor) a Windows (Electron) mají soubory v balíčku – service worker by jen držel staré verze.
      // Online náhled (mode demo) service worker nepodporuje.
      disable: mode === 'native' || mode === 'demo',
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Volejbal Statistika',
        short_name: 'Statistika',
        description: 'Záznam volejbalové statistiky zápasu po hráčích.',
        lang: 'cs',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0f172a',
        theme_color: '#1d4ed8',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Proxy na cvf.cz nikdy necachovat – soupiska musí být vždy aktuální.
        navigateFallbackDenylist: [/^\/cvf\//],
      },
    }),
  ],
  server: {
    // Ve vývoji obchází CORS: /cvf/... -> https://www.cvf.cz/...
    proxy: {
      '/cvf': {
        target: 'https://www.cvf.cz',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cvf/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
}));
