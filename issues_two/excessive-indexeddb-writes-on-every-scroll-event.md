# Excessive IndexedDB Writes on Every Scroll Event

## Severity
Medium

## Affected Files
- `src/components/BookViewer.vue:38-61`
- `src/components/BookViewer.vue:269-286`
- `src/components/BookViewer.vue:288-321`

## Description
The application writes to IndexedDB on every scroll event and on every settings change, causing excessive I/O operations:

1. **Scroll Handler (lines 38-61)**: Every scroll event triggers `bookStore.updateProgress()` which writes to IndexedDB. With a 500ms debounce, this still means writes on every scroll interaction.

2. **Chapter Change Handler (lines 269-286)**: Changing chapters triggers an immediate write.

3. **Settings Change Handler (lines 288-321)**: Every settings change (font size, theme, etc.) triggers a write to IndexedDB.

```typescript
watch(
  () => [
    settingsStore.preferences.wideMode,
    settingsStore.preferences.fontSize,
    settingsStore.preferences.fontFamily,
    settingsStore.preferences.lineHeight,
  ],
  () => {
    if (settingsTimer) clearTimeout(settingsTimer);
    settingsTimer = window.setTimeout(async () => {
      if (!containerRef.value || !bookStore.currentBook) return;

      // This writes to IndexedDB!
      await bookStore.updateProgress({
        bookId: bookStore.metadata!.id,
        cfi: '',
        scrollPosition: scrollTop,
        chapterIndex: bookStore.currentChapter,
        percentage: Math.round(overallProgress),
        timestamp: new Date(),
      });
    }, 500);
  }
);
```

In `book.ts` store:
```typescript
async function updateProgress(session: ReadingProgress): Promise<void> {
  readingProgress.value.set(session.bookId, session);
  if (currentBook.value) {
    currentBook.value.metadata.progress = session.percentage;
    currentBook.value.metadata.lastReadAt = new Date();
    currentBook.value.metadata.currentChapter = session.chapterIndex;

    const libraryStore = useLibraryStore();
    await libraryStore.updateReadingProgress( // IndexedDB write!
      session.bookId,
      session.chapterIndex,
      session.scrollPosition,
      session.percentage
    );
  }
}
```

## Impact on User Experience
- Unnecessary disk I/O slowing down the browser
- Potential performance degradation on systems with slow storage
- IndexedDB transactions can block the main thread
- Excessive storage wear
- Battery drain on mobile devices
- Settings changes feel sluggish

## Implementation Plan

### Fix 1: Separate In-Memory Storage from Persistent Storage

```typescript
// src/stores/book.ts
export const useBookStore = defineStore('book', () => {
  const currentBook = ref<EpubBook | null>(null);
  const currentChapter = ref<number>(0);
  const currentScrollPosition = ref<number>(0);
  const isLoading = ref(false);
  const error = ref<Error | null>(null);
  const readingProgress = ref<Map<string, ReadingProgress>>(new Map());
  const searchHighlight = ref<SearchHighlight | null>(null);

  // Don't write to IndexedDB here - just update in-memory state
  async function updateProgress(session: ReadingProgress): Promise<void> {
    readingProgress.value.set(session.bookId, session);
    if (currentBook.value) {
      currentBook.value.metadata.progress = session.percentage;
      currentBook.value.metadata.lastReadAt = new Date();
      currentBook.value.metadata.currentChapter = session.chapterIndex;
    }
  }

  // Separate function for saving to IndexedDB
  async function saveProgressToLibrary(): Promise<void> {
    if (!currentBook.value) return;

    const session = readingProgress.value.get(currentBook.value.metadata.id);
    if (!session) return;

    const libraryStore = useLibraryStore();
    await libraryStore.updateReadingProgress(
      session.bookId,
      session.chapterIndex,
      session.scrollPosition,
      session.percentage
    );
  }

  return {
    // ...
    updateProgress,
    saveProgressToLibrary,
  };
});
```

### Fix 2: Debounce IndexedDB Writes Separately

```typescript
// src/components/BookViewer.vue
import { ref, computed, onUnmounted, nextTick, watchEffect, watch } from 'vue';
import { useDebounceFn } from '@vueuse/core';

// ... existing code

// Create debounced version of saveProgressToLibrary
const saveProgressDebounced = useDebounceFn(async () => {
  if (!bookStore.currentBook) return;
  await bookStore.saveProgressToLibrary();
}, 2000); // Save every 2 seconds instead of on every scroll

function handleScroll() {
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = window.setTimeout(async () => {
    if (!containerRef.value || !bookStore.currentBook) return;

    const scrollTop = containerRef.value.scrollTop;
    const scrollHeight = containerRef.value.scrollHeight - containerRef.value.clientHeight;
    const currentChapterProgress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
    const totalChapters = bookStore.chapters.length;

    const overallProgress = totalChapters > 0
      ? ((bookStore.currentChapter + currentChapterProgress) / totalChapters) * 100
      : 0;

    // Update in-memory progress (fast)
    await bookStore.updateProgress({
      bookId: bookStore.metadata!.id,
      cfi: '',
      scrollPosition: scrollTop,
      chapterIndex: bookStore.currentChapter,
      percentage: Math.round(overallProgress),
      timestamp: new Date(),
    });

    // Save to IndexedDB with debounce
    saveProgressDebounced();
  }, 500);
}
```

### Fix 3: Save on Significant Progress Changes Only

```typescript
// Only save if progress changes by more than 1% or chapter changes
let lastSavedProgress = 0;
let lastSavedChapter = -1;

async function handleScroll() {
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = window.setTimeout(async () => {
    if (!containerRef.value || !bookStore.currentBook) return;

    const scrollTop = containerRef.value.scrollTop;
    const scrollHeight = containerRef.value.scrollHeight - containerRef.value.clientHeight;
    const currentChapterProgress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
    const totalChapters = bookStore.chapters.length;

    const overallProgress = totalChapters > 0
      ? ((bookStore.currentChapter + currentChapterProgress) / totalChapters) * 100
      : 0;
    const roundedProgress = Math.round(overallProgress);

    await bookStore.updateProgress({
      bookId: bookStore.metadata!.id,
      cfi: '',
      scrollPosition: scrollTop,
      chapterIndex: bookStore.currentChapter,
      percentage: roundedProgress,
      timestamp: new Date(),
    });

    // Only save to IndexedDB on significant changes
    if (Math.abs(roundedProgress - lastSavedProgress) >= 1 ||
        bookStore.currentChapter !== lastSavedChapter) {
      lastSavedProgress = roundedProgress;
      lastSavedChapter = bookStore.currentChapter;
      await bookStore.saveProgressToLibrary();
    }
  }, 500);
}
```

### Fix 4: Save on Lifecycle Events

```typescript
// Save progress when user leaves or closes the tab
onUnmounted(async () => {
  if (bookStore.currentBook) {
    await bookStore.saveProgressToLibrary();
  }
});

// Also save before unloading the page
window.addEventListener('beforeunload', async () => {
  if (bookStore.currentBook) {
    navigator.sendBeacon('/api/save-progress', JSON.stringify({
      bookId: bookStore.metadata?.id,
      chapterIndex: bookStore.currentChapter,
      scrollPosition: containerRef.value?.scrollTop || 0,
    }));
  }
});
```

### Fix 5: Remove Settings-Related Progress Writes

```typescript
// Don't update reading progress when settings change
watch(
  () => [
    settingsStore.preferences.wideMode,
    settingsStore.preferences.fontSize,
    settingsStore.preferences.fontFamily,
    settingsStore.preferences.lineHeight,
  ],
  () => {
    // Remove the progress update logic - settings changes shouldn't affect reading progress
    // Just update scroll position if needed
    if (settingsTimer) clearTimeout(settingsTimer);
    settingsTimer = window.setTimeout(() => {
      // Recalculate and save scroll position only if needed
    }, 500);
  }
);
```

## Additional Optimizations
1. Use `navigator.sendBeacon` for more reliable saves on page unload
2. Implement batched writes for multiple updates
3. Add a "Save" button for manual save
4. Show save status indicator (e.g., "Last saved 2 minutes ago")
5. Implement offline-first approach with background sync
6. Use Service Worker for background sync when offline
7. Add option to disable auto-save for battery saving
8. Compress progress data before storing
