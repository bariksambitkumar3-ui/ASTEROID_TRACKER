import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { geminiProxyPlugin } from './vite-plugin-gemini-proxy.js';

export default defineConfig({
  plugins: [
    react(),
    geminiProxyPlugin(), // server-side only — API key never touches the browser
  ],
  server: {
    port: 3000,
    strictPort: true,
    open: false,
  },
});
