import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'epubjs': resolve(__dirname, 'node_modules/epubjs/dist/epub.js'),
    },
  },
  base: '/EpubWebReader/',
  build: {
    outDir: 'docs',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          epub: ['epubjs'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['epubjs'],
  },
  server: {
    port: 3000,
    open: true,
  },
});
