import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173,
    strictPort: true,
    hmr: {
      clientPort: 5173, // Ensure HMR uses the forwarded port
    },
  },
  build: {
    chunkSizeWarningLimit: 1500, // Phaser is ~1.2MB, adjust threshold to suppress warning
  },
});
