import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Empêcher Vite d'obscurcir les erreurs de Rust
  clearScreen: false,
  // Configuration pour Tauri
  server: {
    port: 1420,
    strictPort: true,
  },
  // Ajuster pour le build Tauri
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
  envPrefix: ['VITE_', 'TAURI_'],
});
