import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    }
  },

  server: {
    host: true,
    port: 5174,
    allowedHosts: [
    ],
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:8081',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, res) => {
            // Manejar la espera de arranque o recarga del backend sin volcar el stacktrace en la consola
            const code = (err as any).code;
            if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'EPIPE') {
              if (res && 'writeHead' in res && !(res as any).headersSent) {
                (res as any).writeHead(503, { 'Content-Type': 'application/json' });
                (res as any).end(JSON.stringify({ detail: 'El servicio no está disponible momentáneamente. Por favor, intente de nuevo en unos instantes.' }));
              }
              return;
            }
            console.error('[vite proxy error]:', err.message);
          });
        },
      },
      '/media': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:8081',
        changeOrigin: true,
      },
    }
  },

})
