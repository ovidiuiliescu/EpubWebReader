# Deep Reactivity on Large Objects Causes Performance Degradation

## Severity
High

## Affected Files
- `src/stores/book.ts:7-13`
- `src/stores/library.ts:25`
- `src/stores/settings.ts:27-34`

## Description
Large objects are being made deeply reactive by Pinia/Vue, causing unnecessary tracking overhead and memory usage:

1. **BookStore (book.ts)**: `currentBook` contains the entire EPUB book structure including all chapters with full HTML content. When this is deeply reactive, Vue tracks every change to the chapter content, title, etc.

2. **LibraryStore (library.ts)**: `books` array is deeply reactive, tracking changes to every book's metadata including large cover image blobs.

3. **SettingsStore (settings.ts)**: `preferences` is reactive but doesn't need deep watching - properties can be watched individually.

Deep reactivity means Vue wraps every nested property with Proxies, causing:
- High memory usage (each property gets a Proxy wrapper)
- Slower property access (Proxy overhead)
- Unnecessary reactivity tracking for data that never changes
- Performance degradation when accessing nested properties

## Impact on User Experience
- Slower app startup and book loading
- Increased memory consumption leading to browser slowdowns
- Garbage collection pressure
- Unnecessary component re-renders when unrelated properties change
- Overall sluggishness especially with large EPUBs

## Implementation Plan

### Fix 1: Use shallowRef for Book Store

```typescript
// src/stores/book.ts
import { defineStore } from 'pinia';
import { shallowRef, computed } from 'vue'; // Use shallowRef instead of ref

export const useBookStore = defineStore('book', () => {
  const currentBook = shallowRef<EpubBook | null>(null); // Changed from ref to shallowRef
  const currentChapter = ref<number>(0);
  const currentScrollPosition = ref<number>(0);
  const isLoading = ref(false);
  const error = ref<Error | null>(null);
  const searchHighlight = ref<SearchHighlight | null>(null);

  // Manual updates for book mutations
  function updateBookMetadata(updates: Partial<BookMetadata>) {
    if (currentBook.value) {
      currentBook.value = {
        ...currentBook.value,
        metadata: { ...currentBook.value.metadata, ...updates }
      };
    }
  }

  function addChapter(chapter: Chapter) {
    if (currentBook.value && currentBook.value.chapters) {
      currentBook.value = {
        ...currentBook.value,
        chapters: [...currentBook.value.chapters, chapter]
      };
    }
  }
});
```

### Fix 2: Use shallowReactive or markRaw for Library Store

```typescript
// src/stores/library.ts
import { defineStore } from 'pinia';
import { shallowRef } from 'vue'; // Use shallowRef

export const useLibraryStore = defineStore('library', () => {
  const books = shallowRef<BookMetadata[]>([]); // Changed from ref to shallowRef

  // Update function creates new array reference
  async function cacheBook(metadata: BookMetadata, epubBlob: Blob, coverImage?: Blob) {
    if (!db.value) return;

    const existing = await db.value.get('books', metadata.id);
    if (existing) {
      await db.value.put('books', { ...existing, metadata, coverImage });
    } else {
      await db.value.add('books', { id: metadata.id, metadata, epubBlob, coverImage, addedAt: new Date() });
    }

    await loadBooks();
  }
});
```

### Fix 3: Individual Property Watchers for Settings

```typescript
// src/stores/settings.ts
import { defineStore } from 'pinia';
import { useStorage } from '@vueuse/core';
import { reactive, watchEffect } from 'vue';

export const useSettingsStore = defineStore('settings', () => {
  const storedPrefs = useStorage<StoredPrefs>('reader-preferences', DEFAULT_STORED_PREFS);

  // Use plain reactive object, no deep watch needed
  const preferences = reactive<UserPreferences>({
    theme: storedPrefs.value.theme,
    fontSize: storedPrefs.value.fontSize,
    fontFamily: storedPrefs.value.fontFamily,
    lineHeight: storedPrefs.value.lineHeight,
    padding: storedPrefs.value.padding,
    wideMode: storedPrefs.value.wideMode,
  });

  // Update localStorage only when values actually change
  watchEffect(() => {
    storedPrefs.value = {
      theme: preferences.theme,
      fontSize: preferences.fontSize,
      fontFamily: preferences.fontFamily,
      lineHeight: preferences.lineHeight,
      padding: preferences.padding,
      wideMode: preferences.wideMode,
    };
  });
});
```

### Fix 4: Use markRaw for immutable data

```typescript
// For book cover blobs that never change
import { markRaw } from 'vue';

async function loadCover(book: any): Promise<Blob | null> {
  try {
    const cover = await book.coverUrl();
    if (cover) {
      const response = await fetch(cover);
      const blob = await response.blob();
      return markRaw(blob); // Mark as non-reactive
    }
  } catch (err) {
    console.warn('Failed to load cover image', err);
    return null;
  }
  return null;
}
```

## Additional Optimizations
1. Use `markRaw()` for large objects that never need reactivity (cover images, epub blobs)
2. Implement a computed property pattern for accessing nested data instead of deep reactivity
3. Consider using `shallowReadonly()` for data that should be read-only
4. Profile memory usage with Chrome DevTools to identify the biggest offenders
5. Implement lazy loading for chapter content instead of loading all at once
