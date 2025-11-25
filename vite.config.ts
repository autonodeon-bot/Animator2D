import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '.', 
  base: './', // Crucial for WebView2/Electron: makes paths relative (e.g. "assets/script.js" instead of "/assets/script.js")
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});