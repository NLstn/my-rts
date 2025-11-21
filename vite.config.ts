import { defineConfig } from 'vite';

export default defineConfig({
  base: '/my-rts/',
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173,
    strictPort: true,
    hmr: {
      clientPort: 5173, // Ensure HMR uses the forwarded port
    },
  },
});
