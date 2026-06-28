import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist/public',
      emptyOutDir: true,
      // Enable source maps only in dev
      sourcemap: false,
      // Increase chunk warning limit (recharts is big)
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          // Manual chunking — split heavy libs into separate cacheable files
          manualChunks: {
            // React core — rarely changes, long cache
            'vendor-react': ['react', 'react-dom'],
            // Charts lib — heavy, split separately
            'vendor-charts': ['recharts'],
            // Icons — large set, split separately
            'vendor-icons': ['lucide-react'],
            // Animation lib
            'vendor-motion': ['motion'],
          },
        },
      },
      // Use esbuild for faster minification
      minify: 'esbuild',
      target: 'es2020',
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    // Optimize deps pre-bundling
    optimizeDeps: {
      include: ['react', 'react-dom', 'lucide-react', 'recharts'],
    },
  };
});
