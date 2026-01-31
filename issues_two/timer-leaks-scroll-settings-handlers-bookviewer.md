# Timer Leaks in BookViewer Scroll and Settings Handlers

## Severity
Medium

## Affected Files
- `src/components/BookViewer.vue:38-61, 268-321`

## Description
The `handleScroll` function and the settings watcher use `window.setTimeout` to debounce operations. While timers are stored and cleared in `onUnmounted`, there are scenarios where timers can leak or create race conditions.

```javascript
let scrollTimer: number | null = null;
let settingsTimer: number | null = null;

function handleScroll() {
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = window.setTimeout(async () => {
    // ... async operations
  }, 500);
}

watch(
  () => [settings...],
  () => {
    if (settingsTimer) clearTimeout(settingsTimer);
    settingsTimer = window.setTimeout(async () => {
      // ... async operations
    }, 500);
  }
);

onUnmounted(() => {
  if (scrollTimer) clearTimeout(scrollTimer);
  if (settingsTimer) clearTimeout(settingsTimer);
});
```

## Why This Is A Problem

1. **Async timer operations**: The timer callbacks contain async operations (`await bookStore.updateProgress()`). If the component unmounts while an async operation is in progress, the cleanup in `onUnmounted` clears the timer ID but doesn't cancel the in-flight async operation. The operation may still complete and attempt to update state on an unmounted component.

2. **Stale state updates**: After component unmounts, if the async `updateProgress` call completes, it might try to access `containerRef.value` which is now null, causing errors.

3. **No cancellation**: There's no way to cancel an in-flight progress update when the component unmounts or when a new update is triggered.

4. **Timer ID type**: Using `number` for timer IDs is correct for browser environments, but the code doesn't account for Node.js environments where timers are objects. However, since this is a browser-only app, this is less critical.

5. **Race condition between scroll and settings updates**: If both timers fire around the same time, they could both call `updateProgress` with conflicting values.

6. **No debouncing for watchEffect**: The watchEffect at line 253-257 doesn't have any debouncing, so it could fire rapidly during rapid state changes.

## Implementation Plan

1. Use a ref for tracking mounted state:

```javascript
const isMounted = ref(true);

onUnmounted(() => {
  isMounted.value = false;
  if (scrollTimer) clearTimeout(scrollTimer);
  if (settingsTimer) clearTimeout(settingsTimer);
});
```

2. Update `handleScroll` to check mounted state:

```javascript
function handleScroll() {
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = window.setTimeout(async () => {
    if (!isMounted.value || !containerRef.value || !bookStore.currentBook) return;

    const scrollTop = containerRef.value.scrollTop;
    const scrollHeight = containerRef.value.scrollHeight - containerRef.value.clientHeight;
    const currentChapterProgress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
    const totalChapters = bookStore.chapters.length;
    
    const safeCurrentChapter = Math.max(0, Math.min(bookStore.currentChapter, totalChapters - 1));
    const overallProgress = totalChapters > 0 
      ? ((safeCurrentChapter + currentChapterProgress) / totalChapters) * 100 
      : 0;

    if (bookStore.metadata?.id) {
      await bookStore.updateProgress({
        bookId: bookStore.metadata.id,
        cfi: '',
        scrollPosition: scrollTop,
        chapterIndex: safeCurrentChapter,
        percentage: Math.round(overallProgress),
        timestamp: new Date(),
      });
    }
  }, 500);
}
```

3. Update settings watcher:

```javascript
let abortController: AbortController | null = null;

watch(
  () => [
    settingsStore.preferences.wideMode,
    settingsStore.preferences.fontSize,
    settingsStore.preferences.fontFamily,
    settingsStore.preferences.lineHeight,
  ],
  () => {
    if (settingsTimer) clearTimeout(settingsTimer);
    
    // Cancel any pending updates
    if (abortController) {
      abortController.abort();
    }
    
    settingsTimer = window.setTimeout(async () => {
      if (!isMounted.value || !containerRef.value || !bookStore.currentBook) return;
      
      abortController = new AbortController();
      const { signal } = abortController;
      
      await nextTick();
      
      if (signal.aborted) return;
      
      const scrollTop = containerRef.value.scrollTop;
      const scrollHeight = containerRef.value.scrollHeight - containerRef.value.clientHeight;
      const currentChapterProgress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
      const totalChapters = bookStore.chapters.length;
      
      const safeCurrentChapter = Math.max(0, Math.min(bookStore.currentChapter, totalChapters - 1));
      const overallProgress = totalChapters > 0 
        ? ((safeCurrentChapter + currentChapterProgress) / totalChapters) * 100 
        : 0;

      if (!signal.aborted && bookStore.metadata?.id) {
        await bookStore.updateProgress({
          bookId: bookStore.metadata.id,
          cfi: '',
          scrollPosition: scrollTop,
          chapterIndex: safeCurrentChapter,
          percentage: Math.round(overallProgress),
          timestamp: new Date(),
        });
      }
      
      abortController = null;
    }, 500);
  }
);
```

4. Update cleanup:

```javascript
onUnmounted(() => {
  isMounted.value = false;
  
  if (scrollTimer) {
    clearTimeout(scrollTimer);
    scrollTimer = null;
  }
  
  if (settingsTimer) {
    clearTimeout(settingsTimer);
    settingsTimer = null;
  }
  
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
});
```

5. Create a reusable debounce composable:

```javascript
// composables/useDebouncedEffect.ts
import { onUnmounted, ref } from 'vue';

export function useDebouncedEffect(
  effect: () => Promise<void> | void,
  delay: number
) {
  const timer = ref<number | null>(null);
  const isMounted = ref(true);
  let abortController: AbortController | null = null;

  const execute = () => {
    if (timer.value !== null) {
      clearTimeout(timer.value);
    }
    
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    
    timer.value = window.setTimeout(async () => {
      if (!isMounted.value) return;
      
      abortController = new AbortController();
      const { signal } = abortController;
      
      try {
        await effect();
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Debounced effect error:', err);
        }
      } finally {
        if (!signal.aborted) {
          abortController = null;
        }
        timer.value = null;
      }
    }, delay);
  };

  const cancel = () => {
    if (timer.value !== null) {
      clearTimeout(timer.value);
      timer.value = null;
    }
    
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  };

  onUnmounted(() => {
    isMounted.value = false;
    cancel();
  });

  return {
    execute,
    cancel,
  };
}
```

6. Use the composable in BookViewer:

```javascript
import { useDebouncedEffect } from '@/composables/useDebouncedEffect';

const { execute: debouncedUpdateProgress, cancel: cancelProgressUpdate } = useDebouncedEffect(
  async () => {
    if (!containerRef.value || !bookStore.currentBook) return;

    const scrollTop = containerRef.value.scrollTop;
    const scrollHeight = containerRef.value.scrollHeight - containerRef.value.clientHeight;
    const currentChapterProgress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
    const totalChapters = bookStore.chapters.length;
    
    const safeCurrentChapter = Math.max(0, Math.min(bookStore.currentChapter, totalChapters - 1));
    const overallProgress = totalChapters > 0 
      ? ((safeCurrentChapter + currentChapterProgress) / totalChapters) * 100 
      : 0;

    if (bookStore.metadata?.id) {
      await bookStore.updateProgress({
        bookId: bookStore.metadata.id,
        cfi: '',
        scrollPosition: scrollTop,
        chapterIndex: safeCurrentChapter,
        percentage: Math.round(overallProgress),
        timestamp: new Date(),
      });
    }
  },
  500
);

function handleScroll() {
  debouncedUpdateProgress();
}
```

7. Use `useDebounceFn` from VueUse for simpler cases:

```javascript
import { useDebounceFn } from '@vueuse/core';

const debouncedUpdateProgress = useDebounceFn(async () => {
  if (!containerRef.value || !bookStore.currentBook) return;

  const scrollTop = containerRef.value.scrollTop;
  // ... rest of logic
  
  await bookStore.updateProgress({ ... });
}, 500);

function handleScroll() {
  debouncedUpdateProgress();
}
```

8. Add debouncing to the watchEffect:

```javascript
import { watchDebounced } from '@vueuse/core';

watchDebounced(
  () => bookStore.currentChapter,
  async (newChapter) => {
    if (!bookStore.currentBook) return;
    const totalChapters = bookStore.chapters.length;
    
    if (totalChapters === 0) return;
    
    const safeChapter = Math.max(0, Math.min(newChapter, totalChapters - 1));
    const overallProgress = (safeChapter / totalChapters) * 100;

    if (bookStore.metadata?.id) {
      await bookStore.updateProgress({
        bookId: bookStore.metadata.id,
        cfi: '',
        scrollPosition: 0,
        chapterIndex: safeChapter,
        percentage: Math.round(overallProgress),
        timestamp: new Date(),
      });
    }
  },
  { debounce: 300 }
);
```

9. For the settings watcher, use watchDebounced:

```javascript
watchDebounced(
  () => [
    settingsStore.preferences.wideMode,
    settingsStore.preferences.fontSize,
    settingsStore.preferences.fontFamily,
    settingsStore.preferences.lineHeight,
  ],
  async () => {
    if (!isMounted.value || !containerRef.value || !bookStore.currentBook) return;
    
    await nextTick();
    
    // ... progress update logic
  },
  { debounce: 500 }
);
```

10. Update chapter change watcher to use watchPostEffect for better timing:

```javascript
import { watchPostEffect } from 'vue';

watchPostEffect(() => {
  if (!bookStore.currentBook) return;
  
  const totalChapters = bookStore.chapters.length;
  if (totalChapters === 0) return;
  
  const safeChapter = Math.max(0, Math.min(bookStore.currentChapter, totalChapters - 1));
  const overallProgress = (safeChapter / totalChapters) * 100;

  // Debounce this update
  debouncedChapterUpdate(safeChapter, overallProgress);
});
```
