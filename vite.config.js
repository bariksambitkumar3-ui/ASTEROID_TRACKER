import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { geminiProxyPlugin } from './vite-plugin-gemini-proxy.js';
import { emailPlugin } from './vite-plugin-email.js';

export default defineConfig(({ mode }) => {
  // Load all environment variables (including non-VITE_ keys) into process.env for server-side plugins
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [
      react(),
      geminiProxyPlugin(),  // Gemini AI proxy — API key stays on server
      emailPlugin(),        // Email OTP verification — EmailJS keys stay on server
    ],
    server: {
      port: 3000,
      strictPort: true,
      open: false,
    },
  };
});
