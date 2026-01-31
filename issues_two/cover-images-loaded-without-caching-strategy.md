# Cover Images Loaded Without Caching Strategy

## Severity
Medium

## Affected Files
- `src/components/HomeScreen.vue:31-39`
- `src/components/LibraryPanel.vue:33-41`

## Description
Cover images are loaded without any caching strategy, memory management, or virtualization. Both HomeScreen and LibraryPanel load all cover images simultaneously in the `loadCovers` function:

```typescript
// src/components/HomeScreen.vue
async function loadCovers() {
  for (const book of libraryStore.books) {
    const cover = await libraryStore.getCoverImage(book.id);
    if (cover) {
      const url = URL.createObjectURL(cover);
      coverUrls.value.set(book.id, url);
    }
  }
}

onMounted(async () => {
  await libraryStore.init();
  await loadCovers(); // Loads all covers at once!
});
```

Issues:
1. All cover images are loaded simultaneously on mount
2. Blob URLs are created for every cover without cleanup until unmount
3. No lazy loading - covers for off-screen images are loaded immediately
4. No virtualization for large libraries (50+ books)
5. No memory limit - can cause OOM with large libraries
6. Duplicate loading - both HomeScreen and LibraryPanel load covers independently
7. No error handling for failed cover loads
8. No placeholder/low-res version loading

## Impact on User Experience
- Slow initial load for large libraries
- High memory consumption (each cover image is a blob in memory)
- Browser slowdowns or crashes with many books
- Unnecessary network/storage I/O
- Poor performance on mobile devices
- Flickering/loading states while covers load

## Implementation Plan

### Fix 1: Centralized Cover Cache

```typescript
// Create a new composable: composables/useCoverCache.ts
import { ref } from 'vue';

interface CoverCacheEntry {
  url: string;
  timestamp: number;
  size: number;
}

const coverCache = new Map<string, CoverCacheEntry>();
const MAX_CACHE_SIZE = 50; // Maximum number of covers to cache
const MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutes

export function useCoverCache() {
  async function getCoverUrl(bookId: string, getCover: () => Promise<Blob | null>): Promise<string | null> {
    const cached = coverCache.get(bookId);

    if (cached && Date.now() - cached.timestamp < MAX_CACHE_AGE) {
      return cached.url;
    }

    const cover = await getCover();
    if (!cover) return null;

    // Evict old entries if cache is full
    if (coverCache.size >= MAX_CACHE_SIZE) {
      evictOldestEntry();
    }

    const url = URL.createObjectURL(cover);
    coverCache.set(bookId, {
      url,
      timestamp: Date.now(),
      size: cover.size,
    });

    return url;
  }

  function evictOldestEntry() {
    let oldestId: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [id, entry] of coverCache) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestId = id;
      }
    }

    if (oldestId) {
      const entry = coverCache.get(oldestId);
      URL.revokeObjectURL(entry!.url);
      coverCache.delete(oldestId);
    }
  }

  function clearCache() {
    for (const entry of coverCache.values()) {
      URL.revokeObjectURL(entry.url);
    }
    coverCache.clear();
  }

  return { getCoverUrl, clearCache };
}
```

### Fix 2: Lazy Loading with Intersection Observer

```typescript
// src/components/LibraryPanel.vue
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { useBookStore } from '@/stores/book';
import { useTheme } from '@/composables/useTheme';
import { useCoverCache } from '@/composables/useCoverCache';

const libraryStore = useLibraryStore();
const bookStore = useBookStore();
const { themeClasses } = useTheme();
const { getCoverUrl } = useCoverCache();

const fileInput = ref<HTMLInputElement | null>(null);
const coverUrls = ref<Map<string, string>>(new Map());
const isDragging = ref(false);
const loadingCovers = ref<Set<string>>(new Set());

let intersectionObserver: IntersectionObserver | null = null;

onMounted(async () => {
  if (!libraryStore.isInitialized) {
    await libraryStore.init();
  }

  // Don't load all covers immediately - wait for intersection observer
  nextTick(() => {
    setupIntersectionObserver();
  });
});

onUnmounted(() => {
  coverUrls.value.forEach((url) => {
    URL.revokeObjectURL(url);
  });
  coverUrls.value.clear();

  if (intersectionObserver) {
    intersectionObserver.disconnect();
  }
});

function setupIntersectionObserver() {
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(async (entry) => {
        if (entry.isIntersecting) {
          const bookId = entry.target.getAttribute('data-book-id');
          if (bookId && !coverUrls.value.has(bookId) && !loadingCovers.value.has(bookId)) {
            await loadCover(bookId);
          }
        }
      });
    },
    {
      rootMargin: '100px', // Start loading 100px before element enters viewport
      threshold: 0.01,
    }
  );

  // Observe all book elements
  document.querySelectorAll('[data-book-id]').forEach(el => {
    intersectionObserver?.observe(el);
  });
}

async function loadCover(bookId: string) {
  loadingCovers.value.add(bookId);

  try {
    const url = await getCoverUrl(bookId, () => libraryStore.getCoverImage(bookId));
    if (url) {
      coverUrls.value.set(bookId, url);
    }
  } finally {
    loadingCovers.value.delete(bookId);
  }
}
```

### Fix 3: Virtual Scrolling for Large Libraries

```typescript
// Use vue-virtual-scroller or similar library for large lists
import { RecycleScroller } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';

// In template:
<RecycleScroller
  class="h-full"
  :items="libraryStore.books"
  :item-size="100"
  key-field="id"
  v-slot="{ item }"
>
  <div :data-book-id="item.id" class="book-item">
    <!-- Cover image with lazy loading -->
    <img
      v-if="coverUrls.has(item.id)"
      :src="coverUrls.get(item.id)"
      :alt="item.title"
      class="book-cover"
    />
    <div v-else class="book-cover-placeholder">
      Loading...
    </div>
  </div>
</RecycleScroller>
```

### Fix 4: Progressive Image Loading

```typescript
// Load low-res thumbnail first, then high-res image
async function loadCoverProgressive(bookId: string) {
  // Load low-res placeholder
  const lowRes = await getCoverUrl(bookId, () => libraryStore.getLowResCover(bookId));
  coverUrls.value.set(`${bookId}-low`, lowRes);

  // Then load high-res in background
  const highRes = await getCoverUrl(bookId, () => libraryStore.getCoverImage(bookId));
  coverUrls.value.set(bookId, highRes);
}
```

### Fix 5: Memory Budget Management

```typescript
// Monitor memory usage and evict covers if needed
const MAX_COVER_MEMORY = 50 * 1024 * 1024; // 50MB
let totalCoverMemory = 0;

async function getCoverUrlWithMemoryLimit(bookId: string, getCover: () => Promise<Blob | null>): Promise<string | null> {
  const cover = await getCover();
  if (!cover) return null;

  // Evict covers if over memory budget
  while (totalCoverMemory + cover.size > MAX_COVER_MEMORY && coverCache.size > 0) {
    evictOldestEntry();
  }

  const url = URL.createObjectURL(cover);
  totalCoverMemory += cover.size;

  return url;
}

function evictOldestEntry() {
  // ... eviction logic
  totalCoverMemory -= evictedSize;
}
```

## Additional Optimizations
1. Add placeholder/skeleton loading states
2. Implement error retry for failed cover loads
3. Use WebP format if supported
4. Add blur-up technique (load tiny blurry image first)
5. Implement cover preloading on hover for better UX
6. Use background loading for covers that are about to enter viewport
7. Add option to disable cover loading for battery/data saving
8. Cache covers in IndexedDB for faster subsequent loads
9. Use Service Worker to cache cover images for offline use
10. Implement cover deduplication (same cover across different book formats)
