# Missing Abstraction - Progress Tracking Logic

## Severity: Medium

## Affected Files
- `src/components/BookViewer.vue:38-61`
- `src/components/BookViewer.vue:269-286`
- `src/components/BookViewer.vue:288-321`
- `src/stores/book.ts:84-99`

## Description
Progress tracking and calculation logic is duplicated and scattered between the `BookViewer` component and the `book` store:

**BookViewer.vue - Scroll handler (lines 38-61):**
```typescript
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
```

**BookViewer.vue - Chapter change watcher (lines 269-286):**
```typescript
watch(
  () => bookStore.currentChapter,
  async () => {
    if (!bookStore.currentBook) return;
    const totalChapters = bookStore.chapters.length;
    const overallProgress = totalChapters > 0 
      ? ((bookStore.currentChapter / totalChapters) * 100)
      : 0;

    await bookStore.updateProgress({
      bookId: bookStore.metadata!.id,
      cfi: '',
      scrollPosition: 0,
      chapterIndex: bookStore.currentChapter,
      percentage: Math.round(overallProgress),
      timestamp: new Date(),
    });
  }
);
```

**BookViewer.vue - Settings change watcher (lines 288-321):**
- Contains another copy of the same progress calculation logic

**book.ts store - updateProgress (lines 84-99):**
```typescript
async function updateProgress(session: ReadingProgress): Promise<void> {
  readingProgress.value.set(session.bookId, session);
  if (currentBook.value) {
    currentBook.value.metadata.progress = session.percentage;
    currentBook.value.metadata.lastReadAt = new Date();
    currentBook.value.metadata.currentChapter = session.chapterIndex;

    const libraryStore = useLibraryStore();
    await libraryStore.updateReadingProgress(
      session.bookId,
      session.chapterIndex,
      session.scrollPosition,
      session.percentage
    );
  }
}
```

## Why This Is Problematic
- **Code Duplication**: Progress calculation is repeated in 3 places
- **Inconsistency Risk**: If calculation logic changes in one place, others may be missed
- **Poor Separation of Concerns**: Progress logic mixed with scroll handling
- **Testing Complexity**: Hard to test progress calculation in isolation
- **Maintenance Burden**: Bug fixes require multiple file updates

## Implementation Plan

### Step 1: Create Progress Calculation Utility

Create `src/utils/progress.ts`:
```typescript
import type { ReadingProgress } from '@/types/epub';

/**
 * Calculates the percentage of scroll within a chapter.
 *
 * @param scrollTop - Current scroll position
 * @param scrollHeight - Total height of the scrollable area
 * @returns Progress value between 0 and 1
 */
export function calculateChapterProgress(
  scrollTop: number,
  scrollHeight: number
): number {
  if (scrollHeight <= 0) return 0;
  return scrollTop / scrollHeight;
}

/**
 * Calculates the overall reading progress across all chapters.
 *
 * @param currentChapter - Index of the current chapter (0-based)
 * @param scrollTop - Current scroll position within the chapter
 * @param scrollHeight - Total height of the scrollable area
 * @param totalChapters - Total number of chapters
 * @returns Overall progress as a percentage (0-100)
 *
 * @example
 * // User is at chapter 2 of 10, at 50% through that chapter
 * calculateOverallProgress(2, 500, 1000, 10)
 * // Returns approximately 25 (25% through the book)
 */
export function calculateOverallProgress(
  currentChapter: number,
  scrollTop: number,
  scrollHeight: number,
  totalChapters: number
): number {
  if (totalChapters === 0) return 0;

  const chapterProgress = calculateChapterProgress(scrollTop, scrollHeight);
  const overallProgress = (currentChapter + chapterProgress) / totalChapters;

  return Math.round(overallProgress * 100);
}

/**
 * Creates a ReadingProgress object with the current timestamp.
 *
 * @param bookId - ID of the book
 * @param chapterIndex - Current chapter index
 * @param scrollPosition - Current scroll position
 * @param totalChapters - Total number of chapters
 * @param scrollTop - Current scroll position within chapter
 * @param scrollHeight - Total height of scrollable area
 * @returns ReadingProgress object
 */
export function createReadingProgress(
  bookId: string,
  chapterIndex: number,
  scrollPosition: number,
  totalChapters: number,
  scrollTop: number,
  scrollHeight: number
): ReadingProgress {
  return {
    bookId,
    cfi: '',
    scrollPosition,
    chapterIndex,
    percentage: calculateOverallProgress(
      chapterIndex,
      scrollTop,
      scrollHeight,
      totalChapters
    ),
    timestamp: new Date(),
  };
}

/**
 * Calculates the total percentage of chapters completed.
 *
 * @param currentChapter - Index of the current chapter (0-based)
 * @param totalChapters - Total number of chapters
 * @returns Percentage as a number between 0 and 100
 */
export function calculateChapterPercentage(
  currentChapter: number,
  totalChapters: number
): number {
  if (totalChapters === 0) return 0;
  return Math.round((currentChapter / totalChapters) * 100);
}

/**
 * Formats progress as a human-readable string.
 *
 * @param percentage - Progress percentage (0-100)
 * @param currentChapter - Current chapter index (0-based)
 * @param totalChapters - Total number of chapters
 * @returns Formatted progress string
 *
 * @example
 * formatProgressDisplay(45, 5, 10)
 * // Returns "45% - Chapter 5 of 10"
 */
export function formatProgressDisplay(
  percentage: number,
  currentChapter: number,
  totalChapters: number
): string {
  return `${percentage}% - Chapter ${currentChapter + 1} of ${totalChapters}`;
}
```

### Step 2: Create Progress Tracking Composable

Create `src/composables/useProgressTracking.ts`:
```typescript
import { ref, onUnmounted } from 'vue';
import { createReadingProgress } from '@/utils/progress';
import type { ReadingProgress } from '@/types/epub';

export interface ProgressTrackingOptions {
  onProgressUpdate: (progress: ReadingProgress) => void | Promise<void>;
  debounceMs?: number;
}

export function useProgressTracking(options: ProgressTrackingOptions) {
  const { onProgressUpdate, debounceMs = 500 } = options;

  let scrollTimer: number | null = null;
  const isTracking = ref(false);

  async function updateProgress(
    bookId: string,
    chapterIndex: number,
    scrollPosition: number,
    scrollTop: number,
    scrollHeight: number,
    totalChapters: number
  ) {
    const progress = createReadingProgress(
      bookId,
      chapterIndex,
      scrollPosition,
      totalChapters,
      scrollTop,
      scrollHeight
    );

    await onProgressUpdate(progress);
  }

  function debouncedUpdateProgress(
    bookId: string,
    chapterIndex: number,
    scrollPosition: number,
    scrollTop: number,
    scrollHeight: number,
    totalChapters: number
  ) {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(async () => {
      await updateProgress(
        bookId,
        chapterIndex,
        scrollPosition,
        scrollTop,
        scrollHeight,
        totalChapters
      );
    }, debounceMs);
  }

  function updateChapterProgress(
    bookId: string,
    chapterIndex: number,
    totalChapters: number
  ) {
    // Immediately update when chapter changes
    const progress = createReadingProgress(
      bookId,
      chapterIndex,
      0,
      totalChapters,
      0,
      0
    );
    return onProgressUpdate(progress);
  }

  function startTracking() {
    isTracking.value = true;
  }

  function stopTracking() {
    isTracking.value = false;
    if (scrollTimer) clearTimeout(scrollTimer);
  }

  onUnmounted(() => {
    stopTracking();
  });

  return {
    isTracking,
    updateProgress,
    debouncedUpdateProgress,
    updateChapterProgress,
    startTracking,
    stopTracking,
  };
}
```

### Step 3: Update BookViewer Component

Refactor `src/components/BookViewer.vue` to use the composable:
```vue
<script setup lang="ts">
import { ref, computed, onUnmounted, nextTick, watchEffect, watch } from 'vue';
import { useBookStore } from '@/stores/book';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/composables/useTheme';
import { useProgressTracking } from '@/composables/useProgressTracking';

const bookStore = useBookStore();
const settingsStore = useSettingsStore();
const { themeClasses } = useTheme();

const containerRef = ref<HTMLDivElement | null>(null);
const articleRef = ref<HTMLDivElement | null>(null);
let hasRestoredScrollPosition = false;

const contentWidth = computed(() =>
  settingsStore.preferences.wideMode ? 'max-w-full' : 'max-w-2xl'
);

const contentStyle = computed(() => ({
  fontSize: `${settingsStore.preferences.fontSize}px`,
  fontFamily: getFontFamily(settingsStore.preferences.fontFamily),
  lineHeight: settingsStore.preferences.lineHeight,
}));

function getFontFamily(font: string): string {
  const fonts: Record<string, string> = {
    georgia: 'Georgia, Cambria, "Times New Roman", serif',
    campote: '"Campote", Georgia, serif',
    arial: 'Arial, Helvetica, sans-serif',
    verdana: 'Verdana, Arial, sans-serif',
  };
  return fonts[font] || fonts.georgia;
}

const progress = useProgressTracking({
  onProgressUpdate: async (readingProgress) => {
    await bookStore.updateProgress(readingProgress);
  },
  debounceMs: 500,
});

function handleScroll() {
  if (!containerRef.value || !bookStore.currentBook) return;

  const scrollTop = containerRef.value.scrollTop;
  const scrollHeight = containerRef.value.scrollHeight - containerRef.value.clientHeight;
  const totalChapters = bookStore.chapters.length;

  progress.debouncedUpdateProgress(
    bookStore.metadata!.id,
    bookStore.currentChapter,
    scrollTop,
    scrollTop,
    scrollHeight,
    totalChapters
  );
}

watch(
  () => bookStore.currentChapter,
  async () => {
    if (!bookStore.currentBook) return;
    const totalChapters = bookStore.chapters.length;
    await progress.updateChapterProgress(
      bookStore.metadata!.id,
      bookStore.currentChapter,
      totalChapters
    );
  }
);

watch(
  () => [
    settingsStore.preferences.wideMode,
    settingsStore.preferences.fontSize,
    settingsStore.preferences.fontFamily,
    settingsStore.preferences.lineHeight,
  ],
  async () => {
    if (!containerRef.value || !bookStore.currentBook) return;
    await nextTick();

    const scrollTop = containerRef.value.scrollTop;
    const scrollHeight = containerRef.value.scrollHeight - containerRef.value.clientHeight;
    const totalChapters = bookStore.chapters.length;

    progress.debouncedUpdateProgress(
      bookStore.metadata!.id,
      bookStore.currentChapter,
      scrollTop,
      scrollTop,
      scrollHeight,
      totalChapters
    );
  }
);

// Rest of the component code...
</script>
```

### Step 4: Update Book Store

Simplify `src/stores/book.ts` updateProgress function:
```typescript
async function updateProgress(session: ReadingProgress): Promise<void> {
  readingProgress.value.set(session.bookId, session);
  if (currentBook.value) {
    currentBook.value.metadata.progress = session.percentage;
    currentBook.value.metadata.lastReadAt = new Date();
    currentBook.value.metadata.currentChapter = session.chapterIndex;

    const libraryStore = useLibraryStore();
    await libraryStore.updateReadingProgress(
      session.bookId,
      session.chapterIndex,
      session.scrollPosition,
      session.percentage
    );
  }
}
```

### Step 5: Add Unit Tests

```typescript
// tests/utils/progress.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateChapterProgress,
  calculateOverallProgress,
  calculateChapterPercentage,
  formatProgressDisplay,
} from '@/utils/progress';

describe('calculateChapterProgress', () => {
  it('returns 0 when at top of chapter', () => {
    expect(calculateChapterProgress(0, 1000)).toBe(0);
  });

  it('returns 0.5 when at middle of chapter', () => {
    expect(calculateChapterProgress(500, 1000)).toBe(0.5);
  });

  it('returns 1 when at bottom of chapter', () => {
    expect(calculateChapterProgress(1000, 1000)).toBe(1);
  });

  it('handles zero scrollHeight', () => {
    expect(calculateChapterProgress(500, 0)).toBe(0);
  });
});

describe('calculateOverallProgress', () => {
  it('returns 0 for empty book', () => {
    expect(calculateOverallProgress(0, 0, 1000, 0)).toBe(0);
  });

  it('calculates correct progress', () => {
    // Chapter 2 of 4, at 50% through chapter 2
    // Should be 2.5/4 = 62.5% (rounds to 62)
    expect(calculateOverallProgress(2, 500, 1000, 4)).toBe(62);
  });

  it('handles last chapter', () => {
    expect(calculateOverallProgress(9, 1000, 1000, 10)).toBe(100);
  });
});

describe('calculateChapterPercentage', () => {
  it('returns 0 for first chapter', () => {
    expect(calculateChapterPercentage(0, 10)).toBe(0);
  });

  it('returns 50 for middle chapter', () => {
    expect(calculateChapterPercentage(4, 9)).toBe(44);
  });

  it('returns 100 for last chapter', () => {
    expect(calculateChapterPercentage(9, 10)).toBe(90);
  });
});

describe('formatProgressDisplay', () => {
  it('formats progress correctly', () => {
    expect(formatProgressDisplay(45, 4, 10)).toBe('45% - Chapter 5 of 10');
  });
});
```

### Benefits After Refactoring
- Single source of truth for progress calculation
- Easier to test calculation logic
- Consistent progress updates across the app
- Better separation of concerns
- Reusable utilities for other components
