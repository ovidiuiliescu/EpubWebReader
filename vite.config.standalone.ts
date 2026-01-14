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
  base: './',
  build: {
    outDir: 'docs',
    sourcemap: false,
    target: 'es2015',
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'bundle.js',
        chunkFileNames: 'bundle.js',
        assetFileNames: '[name].[ext]',
        manualChunks: undefined,
      },
    },
  },
  optimizeDeps: {
    exclude: ['epubjs'],
  },
});
