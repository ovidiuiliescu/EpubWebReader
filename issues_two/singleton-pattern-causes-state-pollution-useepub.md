# Singleton Pattern in useEpub Causes State Pollution

## Severity
Medium

## Affected Files
- `src/composables/useEpub.ts:75, 565`

## Description
The `useEpub` composable exports a singleton instance at line 565, which means it's shared across all components. However, it also maintains module-level state (`currentBook`, `currentBaseUrl`) that can become stale when switching between books.

```javascript
let currentBook: any = null;
let currentBaseUrl: string | undefined;

export function useEpub() {
  // ... implementation
  return {
    loadEpub,
    loadChapterByHref,
  };
}

export const epub = useEpub();  // Line 565 - Singleton
```

## Why This Is A Problem

1. **State pollution**: The module-level `currentBook` and `currentBaseUrl` variables are shared across all instances. If multiple books are loaded in succession (e.g., in library view), stale state from previous books can leak into new operations.

2. **Race conditions**: If `loadEpub` is called while another book is loading, the module-level state can be overwritten mid-operation, causing the first load to operate on incorrect data.

3. **No book isolation**: The singleton pattern doesn't support multiple books being loaded simultaneously (e.g., for pre-loading, comparison, or parallel processing).

4. **Testing difficulties**: Tests cannot create isolated instances because the singleton is shared across all tests, requiring manual cleanup between tests.

5. **Unintended coupling**: All components using `epub` are coupled to the same book instance, making it difficult to have independent book viewers or components.

6. **Memory leaks**: When a book is unloaded from `bookStore`, the `currentBook` reference in `useEpub` is not cleared, keeping the potentially large epub.js book object in memory.

7. **Undefined behavior**: If `loadChapterByHref` is called without `loadEpub` being called first, or after `loadEpub` has changed the book, results are undefined.

## Implementation Plan

1. Remove singleton and make useEpub a factory function:

```javascript
export function useEpub() {
  const currentBook = ref<any>(null);
  const currentBaseUrl = ref<string | undefined>(undefined);

  async function loadEpub(file: File, existingBookId?: string): Promise<EpubBook> {
    const ePubFactory = await getEpub();
    const arrayBuffer = await file.arrayBuffer();
    
    // Clear previous book
    if (currentBook.value) {
      try {
        // Try to destroy the epub.js instance if it has a destroy method
        if (typeof currentBook.value.destroy === 'function') {
          await currentBook.value.destroy();
        }
      } catch (err) {
        console.warn('Failed to destroy previous book instance:', err);
      }
    }
    
    currentBook.value = ePubFactory(arrayBuffer);

    await currentBook.value.ready;

    const metadata = await currentBook.value.loaded.metadata;
    const navigation = await currentBook.value.loaded.navigation;

    const bookId = existingBookId || await generateBookId(file);

    const bookMetadata: BookMetadata = {
      id: bookId,
      title: metadata.title || 'Untitled',
      author: metadata.creator || 'Unknown Author',
      coverImage: undefined,
      description: metadata.description,
      publisher: metadata.publisher,
      publishedAt: metadata.publishedAt,
      language: metadata.language,
      addedAt: new Date(),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    };

    const coverBlob = await loadCover(currentBook.value);
    let toc = await loadTocFromNcx(currentBook.value);
    if (toc.length === 0) {
      toc = await loadToc(navigation);
    }

    try {
      const rootfile = await currentBook.value.loaded.rootfile;
      if (rootfile && typeof rootfile === 'object') {
        const rootfileObj = rootfile as Record<string, unknown>;
        const rootPath = (rootfileObj.rootfileUrl || rootfileObj.path || rootfileObj.rootPath) as string | undefined;
        if (rootPath) {
          const lastSlash = rootPath.lastIndexOf('/');
          currentBaseUrl.value = lastSlash >= 0 ? rootPath.substring(0, lastSlash + 1) : '';
        }
      }
    } catch {
      console.warn('Unable to determine base URL from book packaging');
      currentBaseUrl.value = undefined;
    }

    const chapters = await loadChapters(currentBook.value, currentBaseUrl.value, toc);

    (currentBook.value as any).chapters = chapters;

    return {
      metadata: bookMetadata,
      chapters,
      toc,
      coverBlob: coverBlob || undefined,
    };
  }

  async function loadChapterByHref(href: string): Promise<Chapter | null> {
    if (!currentBook.value || !(currentBook.value as any).chapters) return null;

    try {
      // ... rest of implementation using currentBook.value
    } catch (err) {
      console.warn(`Failed to load chapter: ${href}`, err);
      return null;
    }
  }

  function clearBook(): void {
    if (currentBook.value) {
      try {
        if (typeof currentBook.value.destroy === 'function') {
          currentBook.value.destroy();
        }
      } catch (err) {
        console.warn('Failed to destroy book instance:', err);
      }
    }
    currentBook.value = null;
    currentBaseUrl.value = undefined;
  }

  return {
    loadEpub,
    loadChapterByHref,
    clearBook,
    currentBook: readonly(currentBook),
  };
}
```

2. Update `book.ts` store to manage epub instance per book:

```javascript
// stores/book.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useEpub } from '@/composables/useEpub';
import { useLibraryStore } from './library';

export const useBookStore = defineStore('book', () => {
  const currentBook = ref<EpubBook | null>(null);
  const currentChapter = ref<number>(0);
  const currentScrollPosition = ref<number>(0);
  const isLoading = ref(false);
  const error = ref<Error | null>(null);
  const readingProgress = ref<Map<string, ReadingProgress>>(new Map());
  const searchHighlight = ref<SearchHighlight | null>(null);
  
  // Create epub instance per store instance
  const epub = useEpub();

  // ... rest of store implementation

  function clearBook(): void {
    // Clear epub state
    epub.clearBook();
    
    currentBook.value = null;
    currentChapter.value = 0;
    error.value = null;
  }

  return {
    currentBook,
    currentChapter,
    currentScrollPosition,
    isLoading,
    error,
    metadata,
    chapters,
    toc,
    currentChapterData,
    searchHighlight,
    loadBook,
    setChapter,
    nextChapter,
    prevChapter,
    updateProgress,
    clearBook,
    setSearchHighlight,
    addChapter,
  };
});
```

3. Remove the singleton export and update imports:

```javascript
// Remove this line:
// export const epub = useEpub();

// In components, use the store's epub instance or create local instance
// BookViewer.vue:
const bookStore = useBookStore();
// bookStore already manages epub instance internally

// If needed in components, create instance:
import { useEpub } from '@/composables/useEpub';
const epub = useEpub();  // Local instance per component
```

4. Update all components that directly import the singleton:

```javascript
// Before:
import { epub } from '@/composables/useEpub';

// After: Use store methods
const bookStore = useBookStore();
const chapter = await bookStore.loadChapterByHref(href);
```

Or if component needs direct access:

```javascript
import { useEpub } from '@/composables/useEpub';

const epub = useEpub();  // Create local instance
```

5. Add cleanup in store onUnmounted:

```javascript
// For non-singleton usage, clean up when store is no longer needed
// In pinia context, this is handled automatically

// For component-level usage:
export function useBook() {
  const epub = useEpub();
  
  onUnmounted(() => {
    epub.clearBook();
  });
  
  return epub;
}
```

6. Add error handling for destroyed book state:

```javascript
async function loadChapterByHref(href: string): Promise<Chapter | null> {
  if (!currentBook.value) {
    console.warn('No book loaded');
    return null;
  }
  
  if (!(currentBook.value as any).chapters) {
    console.warn('Book chapters not available');
    return null;
  }

  try {
    // ... implementation
  } catch (err) {
    if (err instanceof Error && err.message.includes('destroyed')) {
      console.warn('Book instance was destroyed');
      currentBook.value = null;
      return null;
    }
    throw err;
  }
}
```

7. For library view where multiple books might be previewed:

```javascript
// Create a composable for managing multiple book instances
export function useBookManager() {
  const books = ref<Map<string, any>>(new Map());

  async function loadBook(id: string, file: File): Promise<void> {
    // Remove existing book if present
    if (books.value.has(id)) {
      await unloadBook(id);
    }

    const epub = useEpub();
    const book = await epub.loadEpub(file, id);
    books.value.set(id, { epub, book });
  }

  async function unloadBook(id: string): Promise<void> {
    const entry = books.value.get(id);
    if (entry) {
      entry.epub.clearBook();
      books.value.delete(id);
    }
  }

  async function unloadAll(): Promise<void> {
    for (const [id] of books.value.entries()) {
      await unloadBook(id);
    }
  }

  function getBook(id: string): any {
    return books.value.get(id)?.book;
  }

  onUnmounted(() => {
    unloadAll();
  });

  return {
    loadBook,
    unloadBook,
    unloadAll,
    getBook,
    books,
  };
}
```

8. Update tests to handle non-singleton:

```javascript
// tests/useEpub.test.ts
import { useEpub } from '@/composables/useEpub';

describe('useEpub', () => {
  afterEach(() => {
    // Clean up each instance
    const epub = useEpub();
    epub.clearBook();
  });

  it('should load a book', async () => {
    const epub = useEpub();
    // Each test gets its own instance
  });
});
```
