# Library Data Not Memoized on Multiple Access

## Severity
Medium

## Affected Files
- `src/stores/library.ts:45-52`
- `src/stores/library.ts:82-107`
- `src/stores/library.ts:126-136`

## Description
The library store repeatedly loads books from IndexedDB without memoization, causing unnecessary I/O operations:

```typescript
// src/stores/library.ts
async function cacheBook(
  metadata: BookMetadata,
  epubBlob: Blob,
  coverImage?: Blob
): Promise<void> {
  // ... code ...

  await db.value.add('books', {
    id: metadata.id,
    metadata,
    epubBlob,
    coverImage,
    addedAt: new Date(),
  });

  await loadBooks(); // Loads all books from DB again!
}

async function updateReadingProgress(
  bookId: string,
  chapterIndex: number,
  scrollPosition: number,
  percentage: number
): Promise<void> {
  // ... code ...
  await db.value.put('books', existing);
  await loadBooks(); // Loads all books from DB again!
}
```

Every operation that modifies a book triggers `loadBooks()` which:
1. Queries IndexedDB for all books (expensive)
2. Re-sorts the entire array
3. Replaces the entire `books.value` array (triggers all watchers)

Additionally, functions like `getBookBlob` and `getCoverImage` query IndexedDB individually without any caching:

```typescript
async function getBookBlob(id: string): Promise<Blob | null> {
  if (!db.value) return null;
  const book = await db.value.get('books', id); // No cache!
  return book?.epubBlob || null;
}

async function getCoverImage(id: string): Promise<Blob | null> {
  if (!db.value) return null;
  const book = await db.value.get('books', id); // No cache!
  return book?.coverImage || null;
}
```

## Impact on User Experience
- Slow operations when adding/updating books
- Unnecessary IndexedDB queries
- UI lag during library updates
- Excessive disk I/O
- Poor performance on mobile devices
- Battery drain from constant disk access

## Implementation Plan

### Fix 1: In-Memory Cache for Book Data

```typescript
// src/stores/library.ts
export const useLibraryStore = defineStore('library', () => {
  const books = ref<BookMetadata[]>([]);
  const db = ref<IDBPDatabase<{ books: CachedBook }> | null>(null);
  const isInitialized = ref(false);

  // Add in-memory cache for book blobs and covers
  const bookBlobCache = ref<Map<string, Blob>>(new Map());
  const coverImageCache = ref<Map<string, Blob>>(new Map());

  async function init(): Promise<void> {
    if (isInitialized.value) return;

    db.value = await openDB<{ books: CachedBook }>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('books')) {
          const store = database.createObjectStore('books', { keyPath: 'id' });
          store.createIndex('addedAt', 'addedAt');
        }
      },
    });

    await loadBooks();
    isInitialized.value = true;
  }

  async function loadBooks(): Promise<void> {
    if (!db.value) return;

    const cached = await db.value.getAll('books');
    books.value = cached
      .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
      .map(book => book.metadata);
  }

  async function cacheBook(
    metadata: BookMetadata,
    epubBlob: Blob,
    coverImage?: Blob
  ): Promise<void> {
    if (!db.value) return;

    const existing = await db.value.get('books', metadata.id);
    if (existing) {
      await db.value.put('books', {
        ...existing,
        metadata,
        coverImage,
      });
    } else {
      await checkCacheLimit();
      await db.value.add('books', {
        id: metadata.id,
        metadata,
        epubBlob,
        coverImage,
        addedAt: new Date(),
      });
    }

    // Update in-memory cache
    bookBlobCache.value.set(metadata.id, epubBlob);
    if (coverImage) {
      coverImageCache.value.set(metadata.id, coverImage);
    }

    // Update books array efficiently
    await loadBooks();
  }

  async function updateReadingProgress(
    bookId: string,
    chapterIndex: number,
    scrollPosition: number,
    percentage: number
  ): Promise<void> {
    if (!db.value) return;

    const existing = await db.value.get('books', bookId);
    if (existing) {
      existing.metadata = {
        ...existing.metadata,
        progress: percentage,
        currentChapter: chapterIndex,
        lastReadAt: new Date(),
      };
      existing.readingProgress = {
        chapterIndex,
        scrollPosition,
        percentage,
        timestamp: new Date(),
      };
      await db.value.put('books', existing);

      // Update books array directly without loading all books
      const index = books.value.findIndex(b => b.id === bookId);
      if (index !== -1) {
        books.value[index] = { ...existing.metadata };
      }
    }
  }

  // Cache book blobs in memory
  async function getBookBlob(id: string): Promise<Blob | null> {
    if (!db.value) return null;

    // Check cache first
    if (bookBlobCache.value.has(id)) {
      return bookBlobCache.value.get(id)!;
    }

    const book = await db.value.get('books', id);
    const blob = book?.epubBlob || null;

    if (blob) {
      bookBlobCache.value.set(id, blob);
    }

    return blob;
  }

  // Cache cover images in memory
  async function getCoverImage(id: string): Promise<Blob | null> {
    if (!db.value) return null;

    // Check cache first
    if (coverImageCache.value.has(id)) {
      return coverImageCache.value.get(id)!;
    }

    const book = await db.value.get('books', id);
    const cover = book?.coverImage || null;

    if (cover) {
      coverImageCache.value.set(id, cover);
    }

    return cover;
  }

  async function removeBook(id: string): Promise<void> {
    if (!db.value) return;

    await db.value.delete('books', id);

    // Clear cache
    bookBlobCache.value.delete(id);
    coverImageCache.value.delete(id);

    // Remove from books array directly
    const index = books.value.findIndex(b => b.id === id);
    if (index !== -1) {
      books.value.splice(index, 1);
    }
  }

  async function clearLibrary(): Promise<void> {
    if (!db.value) return;
    await db.value.clear('books');

    // Clear all caches
    books.value = [];
    bookBlobCache.value.clear();
    coverImageCache.value.clear();
  }

  return {
    books,
    isInitialized,
    init,
    cacheBook,
    removeBook,
    getBookBlob,
    getCoverImage,
    exportBook,
    clearLibrary,
    updateReadingProgress,
    getReadingProgress,
  };
});
```

### Fix 2: Use shalldowRef for Cache Maps

```typescript
// Use shallowRef to avoid deep reactivity on cache maps
const bookBlobCache = shallowRef<Map<string, Blob>>(new Map());
const coverImageCache = shallowRef<Map<string, Blob>>(new Map());

// When adding to cache, create new Map reference
if (blob) {
  const newCache = new Map(bookBlobCache.value);
  newCache.set(id, blob);
  bookBlobCache.value = newCache;
}
```

### Fix 3: Batch Updates

```typescript
// For multiple updates, batch them to reduce writes
async function batchUpdateProgress(updates: Array<{
  bookId: string;
  chapterIndex: number;
  scrollPosition: number;
  percentage: number;
}>) {
  if (!db.value) return;

  const tx = db.value.transaction('books', 'readwrite');
  const store = tx.objectStore('books');

  for (const update of updates) {
    const existing = await store.get(update.bookId);
    if (existing) {
      existing.metadata = {
        ...existing.metadata,
        progress: update.percentage,
        currentChapter: update.chapterIndex,
        lastReadAt: new Date(),
      };
      await store.put(existing);
    }
  }

  await tx.done;
  await loadBooks();
}
```

### Fix 4: Debounce loadBooks Calls

```typescript
import { useDebounceFn } from '@vueuse/core';

const loadBooksDebounced = useDebounceFn(loadBooks, 100);

async function cacheBook(...) {
  // ... code ...
  await db.value.add('books', bookData);

  // Debounce the loadBooks call
  await loadBooksDebounced();
}
```

## Additional Optimizations
1. Implement LRU cache with size limits for blobs
2. Use `markRaw` for Blob objects to avoid proxy overhead
3. Preload frequently accessed books into cache
4. Implement cache warming on app startup
5. Add cache size monitoring and automatic eviction
6. Use IndexedDB's getAll with a limit for pagination
7. Implement virtual scrolling for large libraries
8. Add cache hit/miss metrics for monitoring
9. Implement cache invalidation strategy
10. Use Service Worker for offline caching
