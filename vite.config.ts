import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import vuetify from 'vite-plugin-vuetify'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vuetify({
      autoImport: true,
      styles: { configFile: 'src/styles/vuetify.scss' },
    }),
    vueDevTools(),
    VitePWA({
      // El manifest ya existe en public/site.webmanifest y está enlazado
      // en index.html, así que el plugin solo genera el service worker.
      manifest: false,
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        // jsPDF/html2canvas son pesados (~800KB entre los dos) y solo se
        // usan al exportar/imprimir el horario — no tiene sentido que el
        // service worker los descargue por adelantado para todo el mundo,
        // igual que se cargan bajo demanda en el código (ver
        // src/utils/exportarHorario.ts). Quedan disponibles igual la
        // primera vez que alguien exporta, solo que se piden en ese
        // momento en vez de precachearse de entrada.
        globIgnores: ['**/jspdf*.js', '**/html2canvas*.js'],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
