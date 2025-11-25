import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Ensures relative paths for assets (good for Vercel/Static/Electron)
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});