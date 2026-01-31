# Missing Import Optimization for Large Bundle Size

## Severity
Low

## Affected Files
- `src/App.vue:1-11`
- `src/components/*.vue` (various)
- `package.json:18-24`

## Description
The application doesn't use import optimizations for large libraries, leading to unnecessarily large bundle sizes:

1. **epubjs** is imported at module level in multiple files
2. **No code splitting** - all dependencies bundled together
3. **Tree shaking** may not be effective due to how dependencies are imported
4. **JSZip** is bundled even though epub.js might include it

Current imports:
```typescript
// src/components/BookViewer.vue:6
import { epub } from '@/composables/useEpub';

// src/stores/book.ts:27
const { epub } = await import('@/composables/useEpub');

// src/composables/useEpub.ts:1-566 (exports epub at module level)
export const epub = useEpub();  // This causes immediate import!
```

This causes all EPUB-related code to be included in the initial bundle even though:
- User may never open a book
- EPUB parsing is only needed when loading a book
- Large portions of the app work without EPUB functionality

## Impact on User Experience
- Slower initial page load
- Larger download size for users who never use the reader
- Poor First Contentful Paint (FCP)
- Poor Time to Interactive (TTI)
- Higher data usage for mobile users
- Longer parsing time for large JavaScript bundles

## Implementation Plan

### Fix 1: Remove Module-Level Export

```typescript
// src/composables/useEpub.ts
// REMOVE this line:
// export const epub = useEpub();

// Instead, export the function only
export function useEpub() {
  // ... existing implementation
}

// Then import dynamically where needed
```

### Fix 2: Dynamic Import for EPUB Functionality

```typescript
// src/components/BookViewer.vue
// Instead of:
// import { epub } from '@/composables/useEpub';

// Use dynamic import:
const epub = ref<Awaited<ReturnType<typeof import('@/composables/useEpub').useEpub>> | null>(null);

async function loadEpubDependencies() {
  const module = await import('@/composables/useEpub');
  epub.value = module.epub();
}
```

Or better, load only when needed:
```typescript
async function renderCurrentChapter() {
  if (!articleRef.value) return;

  // Load epub.js only if needed
  if (!epub.value) {
    const module = await import('@/composables/useEpub');
    epub.value = module.epub();
  }

  // ... rest of rendering
}
```

### Fix 3: Separate EPUB Chunk in Vite Config

```typescript
// vite.config.ts
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
        manualChunks: (id) => {
          // Create separate chunk for EPUB-related code
          if (id.includes('epub') || id.includes('useEpub') || id.includes('jszip')) {
            return 'epub-deps';
          }

          // Separate vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('vue')) {
              return 'vue-vendor';
            }
            if (id.includes('pinia')) {
              return 'pinia-vendor';
            }
            return 'vendor';
          }
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['epubjs', 'jszip'],
  },
});
```

### Fix 4: Use Dynamic Import in Book Store

```typescript
// src/stores/book.ts
export const useBookStore = defineStore('book', () => {
  const currentBook = ref<EpubBook | null>(null);

  async function loadBook(file: File, shouldCache: boolean = true, existingBookId?: string): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      // Dynamic import only when loading a book
      const module = await import('@/composables/useEpub');
      const epub = module.epub();
      const book = await epub.loadEpub(file, existingBookId);

      // ... rest of implementation
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Failed to load book');
      throw err;
    } finally {
      isLoading.value = false;
    }
  }
});
```

### Fix 5: Use Vue's Async Component Pattern

```typescript
// Create an async component wrapper for BookViewer
// src/components/BookViewerAsync.vue
import { defineAsyncComponent } from 'vue';

export const BookViewerAsync = defineAsyncComponent({
  loader: () => import('./BookViewer.vue'),
  loadingComponent: {
    template: '<div class="loading">Loading reader...</div>',
  },
  errorComponent: {
    template: '<div class="error">Failed to load reader</div>',
  },
  delay: 200,
  timeout: 3000,
});
```

In App.vue:
```typescript
import { BookViewerAsync } from '@/components/BookViewerAsync.vue';

// Use BookViewerAsync instead of BookViewer
```

### Fix 6: Use route-based code splitting

If using Vue Router (not currently used but could be added):
```typescript
const routes = [
  {
    path: '/',
    component: () => import('./views/HomeScreen.vue'),
  },
  {
    path: '/book/:id',
    component: () => import('./views/BookView.vue'),  // Book view loads EPUB dependencies
  },
];
```

### Fix 7: Lazy Load Tailwind CSS

```typescript
// vite.config.ts
export default defineConfig({
  css: {
    modules: {
      tailwindcss: {
        // Use CSS modules for selective imports
        ...(process.env.NODE_ENV === 'production' && {
          purge: ['./src/**/*.{vue,js,ts,jsx,tsx}'],
        }),
      },
    },
  },
});
```

### Fix 8: Optimize package.json dependencies

Check if dependencies are actually needed:

```json
{
  "dependencies": {
    "@vueuse/core": "^10.9.0",
    "epubjs": "^0.3.93",
    "idb": "^8.0.0",
    "jszip": "^3.10.1",  // Check if epub.js already includes this
    "pinia": "^2.1.7",
    "vue": "^3.4.21"
  }
}
```

Check if `jszip` is actually needed or if epub.js bundles it:
```bash
npm ls jszip
```

If not needed, remove it and import from epub.js:
```typescript
// In useEpub.ts
// Instead of:
// import('jszip')

// Use from epub.js:
const JSZip = (await import('epubjs')).default?.JSZip || window.JSZip;
```

### Fix 9: Use Bundle Analyzer

Add bundle analyzer to identify large chunks:

```bash
npm install rollup-plugin-visualizer -D
```

```typescript
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    vue(),
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
      filename: 'stats.html',
    }),
  ],
  // ... rest of config
});
```

### Fix 10: Add Prefetch/Prefetch Links

```html
<!-- In index.html -->
<head>
  <!-- Prefetch only when user might need EPUB functionality -->
  <link rel="prefetch" href="/epub-deps.js" as="script">
</head>
```

Or in components:
```typescript
function prefetchEpubDeps() {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = '/epub-deps.js';
  link.as = 'script';
  document.head.appendChild(link);
}

// Call when user is likely to open a book (e.g., mouse hover on "Open Book" button)
```

## Additional Optimizations
1. Use compression (gzip/brotli) on server
2. Implement HTTP/2 or HTTP/3
3. Use CDN for serving static assets
4. Enable asset hashing for better caching
5. Use `import.meta.glob` for dynamic imports
6. Implement service worker for offline caching
7. Use `modulepreload` for critical modules
8. Consider using a lighter EPUB parser for simple cases
9. Implement code splitting by feature
10. Use `vite-plugin-checker` for faster type checking
