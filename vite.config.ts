import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base: the same build runs at a root domain (Cloudflare, Hugging Face)
  // and under /pickdot/ (GitHub Pages).
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  // Polling: file-change events are unreliable inside OneDrive folders.
  server: { port: 5288, strictPort: true, watch: { usePolling: true, interval: 300 } },
});