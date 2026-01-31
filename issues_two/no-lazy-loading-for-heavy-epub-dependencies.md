# No Lazy Loading for Heavy EPUB Dependencies

## Severity
Medium

## Affected Files
- `src/composables/useEpub.ts:8-28`
- `src/composables/useEpub.ts:64-73`

## Description
Heavy dependencies (JSZip and epub.js) are loaded synchronously and eagerly when the app starts or when loading a book, blocking the UI:

```typescript
// src/composables/useEpub.ts
let jsZipReady: Promise<void> | null = null;

async function ensureJsZipLoaded(): Promise<void> {
  if (typeof (globalThis as any).JSZip === 'function') {
    return;
  }

  if (!jsZipReady) {
    jsZipReady = (async () => {
      try {
        const module = await import('jszip');  // Dynamic import, but blocks first use
        const JSZip =
          (module as any).default || (module as any).JSZip || (module as any).jszip || module;
        (globalThis as any).JSZip = JSZip;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to load JSZip dependency: ${message}`);
      }
    })();
  }

  await jsZipReady;
}

async function getEpub(): Promise<EpubFactory> {
  await ensureJsZipLoaded();  // Blocks until JSZip is loaded

  if (!ePub) {
    const module = await import('epubjs');  // Blocks until epub.js is loaded
    ePub = resolveEpubFactory(module);
  }

  return ePub;
}
```

The `useEpub()` composable is imported at the module level in several components:
- `src/components/BookViewer.vue:6` - imports `epub`
- `src/stores/book.ts:27` - imports `epub`

These imports cause the dependencies to be loaded even if the user never opens a book.

## Impact on User Experience
- Slow initial page load (downloading heavy JS files)
- Large initial bundle size (JSZip ~400KB, epub.js ~200KB minified)
- UI freezes while dependencies parse
- Users on slow connections wait unnecessarily
- Memory allocated even if book reading isn't used
- Poor First Contentful Paint (FCP) and Time to Interactive (TTI)

## Implementation Plan

### Fix 1: Load Dependencies On-Demand Only

```typescript
// src/composables/useEpub.ts
type EpubFactory = (input: ArrayBuffer | string | Blob) => any;

let ePub: EpubFactory | null = null;
let jsZipReady: Promise<void> | null = null;

async function ensureJsZipLoaded(): Promise<void> {
  if (typeof (globalThis as any).JSZip === 'function') {
    return;
  }

  if (!jsZipReady) {
    jsZipReady = (async () => {
      try {
        const module = await import('jszip');
        const JSZip =
          (module as any).default || (module as any).JSZip || (module as any).jszip || module;
        (globalThis as any).JSZip = JSZip;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to load JSZip dependency: ${message}`);
      }
    })();
  }

  await jsZipReady;
}

function resolveEpubFactory(module: unknown): EpubFactory {
  const candidates: unknown[] = [];

  candidates.push(module);
  if (module && typeof module === 'object') {
    const record = module as Record<string, unknown>;
    candidates.push(record.ePub);
    candidates.push(record.default);

    const defaultValue = record.default;
    if (defaultValue && typeof defaultValue === 'object') {
      const defaultRecord = defaultValue as Record<string, unknown>;
      candidates.push(defaultRecord.ePub);
      candidates.push(defaultRecord.default);
    }
  }

  candidates.push((globalThis as any).ePub);

  const factory = candidates.find(value => typeof value === 'function');
  if (typeof factory === 'function') {
    return factory as EpubFactory;
  }

  const keys = module && typeof module === 'object' ? Object.keys(module as object).join(', ') : '';
  const globalType = typeof (globalThis as any).ePub;
  throw new TypeError(
    `Unable to resolve epubjs factory function. Module keys: ${keys || '(none)'} ` +
      `and typeof module is ${typeof module}. globalThis.ePub is ${globalType}.`,
  );
}

async function getEpub(): Promise<EpubFactory> {
  await ensureJsZipLoaded();

  if (!ePub) {
    const module = await import('epubjs');
    ePub = resolveEpubFactory(module);
  }

  return ePub;
}

// Don't export at module level - only when needed
export function useEpub() {
  return {
    loadEpub: async (file: File, existingBookId?: string) => {
      const ePubFactory = await getEpub();
      // ... rest of loadEpub implementation
    },
    loadChapterByHref: async (href: string) => {
      // Ensure dependencies are loaded
      await getEpub();
      // ... rest of implementation
    },
  };
}

// Remove module-level export
// export const epub = useEpub();  // REMOVE THIS LINE
```

### Fix 2: Code Split EPUB Dependencies

Update `vite.config.ts` to properly code split the dependencies:

```typescript
// vite.config.ts
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
          'epub-deps': ['epubjs', 'jszip'],  // Group EPUB dependencies together
          'vue-vendor': ['vue', 'pinia'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['epubjs', 'jszip'],  // Don't pre-bundle these - load on demand
  },
  server: {
    port: 3000,
    open: true,
  },
});
```

### Fix 3: Show Loading State During Dependency Load

```typescript
// src/components/BookViewer.vue or BookStore
const isLoadingDependencies = ref(false);

async function loadBook(file: File, shouldCache: boolean = true, existingBookId?: string): Promise<void> {
  isLoading.value = true;
  isLoadingDependencies.value = true;  // New loading state

  try {
    const { useEpub } = await import('@/composables/useEpub');  // Import dynamically
    const epub = useEpub();
    const book = await epub.loadEpub(file, existingBookId);

    isLoadingDependencies.value = false;
    // ... rest of loading logic
  } catch (err) {
    error.value = err instanceof Error ? err : new Error('Failed to load book');
    throw err;
  } finally {
    isLoading.value = false;
    isLoadingDependencies.value = false;
  }
}
```

In template:
```html
<div v-if="isLoadingDependencies" class="loading-dependencies">
  <p>Loading EPUB reader...</p>
</div>
```

### Fix 4: Preload Dependencies with Low Priority

```typescript
// Preload dependencies in background when app loads
function preloadEpubDependencies() {
  // Use requestIdleCallback or setTimeout to load in background
  setTimeout(() => {
    import('jszip').catch(() => {});
    import('epubjs').catch(() => {});
  }, 2000);  // Start loading after 2 seconds
}

// Call in main.ts or App.vue onMounted
preloadEpubDependencies();
```

### Fix 5: Use Web Workers for Heavy Parsing

```typescript
// Offload EPUB parsing to a Web Worker
// workers/epubParser.worker.ts
importScripts('/node_modules/jszip/dist/jszip.min.js');
importScripts('/node_modules/epubjs/dist/epub.min.js');

self.onmessage = async (e) => {
  const { fileData, options } = e.data;

  try {
    const book = ePub(fileData);
    await book.ready;

    const metadata = await book.loaded.metadata;
    const navigation = await book.loaded.navigation;

    // ... parse book

    self.postMessage({
      success: true,
      metadata,
      navigation,
    });
  } catch (error) {
    self.postMessage({
      success: false,
      error: error.message,
    });
  }
};
```

Usage:
```typescript
async function loadBookWithWorker(file: File): Promise<EpubBook> {
  const fileData = await file.arrayBuffer();

  return new Promise((resolve, reject) => {
    const worker = new Worker('/workers/epubParser.worker.js');

    worker.onmessage = (e) => {
      if (e.data.success) {
        resolve(e.data);
      } else {
        reject(new Error(e.data.error));
      }
      worker.terminate();
    };

    worker.onerror = (error) => {
      reject(error);
      worker.terminate();
    };

    worker.postMessage({ fileData });
  });
}
```

## Additional Optimizations
1. Add Service Worker caching for EPUB dependencies
2. Use HTTP/2 push for critical resources
3. Implement progressive loading (show first chapter while parsing rest)
4. Add user preference to preload books
5. Use compression for downloaded dependencies (gzip, brotli)
6. Consider tree-shaking if using a modular EPUB library
7. Implement CDN with edge caching for dependencies
8. Add loading progress indicator for dependency download
9. Use prefetch link tags for faster loading
10. Consider using a lighter-weight EPUB parser for simple books
