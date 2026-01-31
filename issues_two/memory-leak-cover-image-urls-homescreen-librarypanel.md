# Memory Leak in Cover Image URLs

## Severity
Medium

## Affected Files
- `src/components/HomeScreen.vue:24-28`
- `src/components/LibraryPanel.vue:26-31`

## Description
When components load book covers, they create `blob:` URLs using `URL.createObjectURL()` but the cleanup in `onUnmounted` only revokes URLs that are currently in the map. However, if a book's cover changes or if a book is removed and then reloaded during the component's lifecycle, the old blob URL may leak.

```javascript
// HomeScreen.vue
onUnmounted(() => {
  coverUrls.value.forEach((url) => {
    URL.revokeObjectURL(url);
  });
  coverUrls.value.clear();
});

// LibraryPanel.vue  
onUnmounted(() => {
  coverUrls.value.forEach((url) => {
    URL.revokeObjectURL(url);
  });
  coverUrls.value.clear();
});
```

## Why This Is A Problem

1. **Double URL creation**: If `loadCovers()` is called multiple times (e.g., after library changes), it may create new blob URLs for the same book without revoking old ones. The old URLs remain in memory until component unmounts.

2. **Library updates**: When a new book is added to library, existing components may trigger reloads, creating additional blob URLs for existing books.

3. **Book removal**: When a book is removed from library while viewing library panel, the old blob URL is not immediately revoked - it waits until component unmounts.

4. **Memory growth**: Each blob URL represents an image in memory (potentially several hundred KB to several MB). With multiple books and frequent updates, memory usage can grow significantly.

5. **Browser limits**: Browsers have limits on the number of concurrent blob URLs. Exceeding these limits can cause new `createObjectURL` calls to fail.

The current cleanup only happens in `onUnmounted`, which means:
- URLs created during component lifetime stay in memory until component unmounts
- If component stays mounted for long time, memory accumulates
- Any URL created for a book that gets replaced/updated during component lifetime leaks

## Implementation Plan

1. Revoke old URL before creating new one in `loadCovers`:

```javascript
async function loadCovers() {
  for (const book of libraryStore.books) {
    // Revoke existing URL for this book if present
    if (coverUrls.value.has(book.id)) {
      URL.revokeObjectURL(coverUrls.value.get(book.id)!);
    }
    
    const cover = await libraryStore.getCoverImage(book.id);
    if (cover) {
      const url = URL.createObjectURL(cover);
      coverUrls.value.set(book.id, url);
    } else {
      coverUrls.value.delete(book.id);
    }
  }
}
```

2. Use a custom composable to manage blob URLs with automatic cleanup:

```javascript
// composables/useBlobUrl.ts
import { ref, onUnmounted } from 'vue';

export function useBlobUrl() {
  const urls = ref<Map<string, string>>(new Map());

  function set(id: string, blob: Blob): string {
    // Revoke old URL if exists
    if (urls.value.has(id)) {
      URL.revokeObjectURL(urls.value.get(id)!);
    }
    
    const url = URL.createObjectURL(blob);
    urls.value.set(id, url);
    return url;
  }

  function revoke(id: string): void {
    if (urls.value.has(id)) {
      URL.revokeObjectURL(urls.value.get(id)!);
      urls.value.delete(id);
    }
  }

  function revokeAll(): void {
    urls.value.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    urls.value.clear();
  }

  function has(id: string): boolean {
    return urls.value.has(id);
  }

  function get(id: string): string | undefined {
    return urls.value.get(id);
  }

  onUnmounted(() => {
    revokeAll();
  });

  return {
    set,
    revoke,
    revokeAll,
    has,
    get,
    urls,
  };
}
```

3. Update HomeScreen and LibraryPanel to use the composable:

```javascript
// HomeScreen.vue
import { useBlobUrl } from '@/composables/useBlobUrl';

const { set: setCoverUrl, has: hasCover, get: getCoverUrl, urls: coverUrls } = useBlobUrl();

async function loadCovers() {
  for (const book of libraryStore.books) {
    const cover = await libraryStore.getCoverImage(book.id);
    if (cover) {
      setCoverUrl(book.id, cover);
    }
  }
}

async function removeBook(id: string) {
  await libraryStore.removeBook(id);
  if (bookStore.metadata?.id === id) {
    bookStore.clearBook();
  }
  // Explicitly revoke URL for removed book
  if (hasCover(id)) {
    setCoverUrl.revoke(id);
  }
}
```

4. Add cleanup when book is updated/replaced in library:

```javascript
async function removeBook(id: string) {
  await libraryStore.removeBook(id);
  if (bookStore.metadata?.id === id) {
    bookStore.clearBook();
  }
  // Explicitly revoke URL when book is removed
  if (coverUrls.value.has(id)) {
    URL.revokeObjectURL(coverUrls.value.get(id)!);
    coverUrls.value.delete(id);
  }
}
```

5. Optionally, add a maximum age or size limit for blob URLs:

```javascript
const MAX_BLOB_AGE = 5 * 60 * 1000; // 5 minutes
const MAX_BLOB_SIZE = 50 * 1024 * 1024; // 50 MB

interface BlobInfo {
  url: string;
  createdAt: number;
  size: number;
}

const blobs = ref<Map<string, BlobInfo>>(new Map());

function set(id: string, blob: Blob): string {
  // Revoke old URL
  if (blobs.value.has(id)) {
    URL.revokeObjectURL(blobs.value.get(id)!.url);
  }
  
  // Check size limit
  if (blob.size > MAX_BLOB_SIZE) {
    console.warn(`Blob size ${blob.size} exceeds limit for ${id}`);
    throw new Error('Blob too large');
  }
  
  const url = URL.createObjectURL(blob);
  blobs.value.set(id, {
    url,
    createdAt: Date.now(),
    size: blob.size,
  });
  
  // Clean up old blobs
  cleanOldBlobs();
  
  return url;
}

function cleanOldBlobs() {
  const now = Date.now();
  let totalSize = 0;
  
  // Calculate total size and mark old ones
  const toRemove: string[] = [];
  for (const [id, info] of blobs.value.entries()) {
    if (now - info.createdAt > MAX_BLOB_AGE) {
      toRemove.push(id);
    } else {
      totalSize += info.size;
    }
  }
  
  // Remove old blobs if approaching limit
  if (totalSize > MAX_BLOB_SIZE * 0.9) {
    const sorted = [...blobs.value.entries()]
      .sort((a, b) => a[1].createdAt - b[1].createdAt);
    
    while (totalSize > MAX_BLOB_SIZE * 0.7 && sorted.length > 0) {
      const [id, info] = sorted.shift()!;
      if (!toRemove.includes(id)) {
        toRemove.push(id);
        totalSize -= info.size;
      }
    }
  }
  
  // Actually remove
  for (const id of toRemove) {
    const info = blobs.value.get(id);
    if (info) {
      URL.revokeObjectURL(info.url);
      blobs.value.delete(id);
    }
  }
}
```

6. For production, consider adding performance monitoring to track blob URL usage:

```javascript
function getBlobStats() {
  const urls = blobs.value.values();
  const totalSize = Array.from(urls).reduce((sum, info) => sum + info.size, 0);
  const count = blobs.value.size;
  
  return { count, totalSize, avgSize: count > 0 ? totalSize / count : 0 };
}

// Log stats periodically
setInterval(() => {
  const stats = getBlobStats();
  if (stats.count > 10 || stats.totalSize > 10 * 1024 * 1024) {
    console.warn('High blob URL usage:', stats);
  }
}, 30000);
```
