/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages base path. Served from https://<user>.github.io/experience_cycle/
export default defineConfig({
  base: '/experience_cycle/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: '経験学習サイクル',
        short_name: '経験学習',
        description: 'コルブの経験学習サイクルを毎日記録するアプリ',
        lang: 'ja',
        theme_color: '#4f7cff',
        background_color: '#f6f7fb',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/experience_cycle/',
        start_url: '/experience_cycle/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
