# Null Access in BookViewer Without Proper Guard

## Severity
High

## Affected Files
- `src/components/BookViewer.vue:42, 273, 303`

## Description
The `bookStore.chapters` array is accessed without checking if it exists or has elements, which can cause runtime errors when book is not fully loaded or when switching between books.

```javascript
// Line 42
const totalChapters = bookStore.chapters.length;
const overallProgress = totalChapters > 0 
  ? ((bookStore.currentChapter + currentChapterProgress) / totalChapters) * 100 
  : 0;

// Line 273
const totalChapters = bookStore.chapters.length;
const overallProgress = totalChapters > 0 
  ? ((bookStore.currentChapter / totalChapters) * 100)
  : 0;

// Line 305
const totalChapters = bookStore.chapters.length;
const overallProgress = totalChapters > 0 
  ? ((bookStore.currentChapter + currentChapterProgress) / totalChapters) * 100 
  : 0;
```

## Why This Is A Problem

1. **Timing issue**: `bookStore.chapters` is a computed property that returns `currentBook.value?.chapters || []`. If `currentBook.value` is `null`, it returns an empty array, which is fine. However, if there's a race condition where book is being loaded/unloaded, intermediate states could cause issues.

2. **Division by zero**: While the code checks `totalChapters > 0`, the division calculation relies on `bookStore.currentChapter` being valid. If `currentChapter` is out of bounds, the progress calculation will be incorrect.

3. **Inconsistent state**: The function `handleScroll` can be called at any time during scroll events. If a book is currently being loaded, `currentChapter` might be valid but `chapters` might be empty, leading to division by zero if the check wasn't there (though it is).

4. **Race condition with chapter changes**: When switching chapters, there's a brief moment where `currentChapter` may not match the actual rendered chapter content, causing inaccurate progress calculations.

5. **No validation of currentChapter bounds**: The code assumes `bookStore.currentChapter` is always within valid range, but doesn't validate this assumption.

## Implementation Plan

1. Create a utility function for calculating progress with proper validation:

```javascript
function calculateProgress(
  currentChapter: number,
  totalChapters: number,
  scrollProgress: number = 0
): number {
  if (totalChapters === 0) return 0;
  
  // Validate currentChapter is within bounds
  const safeCurrentChapter = Math.max(0, Math.min(currentChapter, totalChapters - 1));
  
  const chapterProgress = scrollProgress / 100; // scrollProgress is 0-1
  
  const overallProgress = ((safeCurrentChapter + chapterProgress) / totalChapters) * 100;
  
  return Math.min(100, Math.max(0, overallProgress));
}
```

2. Update `handleScroll` function with proper guards:

```javascript
function handleScroll() {
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = window.setTimeout(async () => {
    if (!containerRef.value || !bookStore.currentBook) return;

    const scrollTop = containerRef.value.scrollTop;
    const scrollHeight = containerRef.value.scrollHeight - containerRef.value.clientHeight;
    
    // Guard against zero scrollHeight
    if (scrollHeight <= 0) return;
    
    const currentChapterProgress = Math.min(1, Math.max(0, scrollTop / scrollHeight));
    const totalChapters = bookStore.chapters.length;
    
    // Guard against invalid currentChapter
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

3. Update chapter change watcher:

```javascript
watch(
  () => bookStore.currentChapter,
  async () => {
    if (!bookStore.currentBook) return;
    const totalChapters = bookStore.chapters.length;
    
    if (totalChapters === 0) return;
    
    const safeCurrentChapter = Math.max(0, Math.min(bookStore.currentChapter, totalChapters - 1));
    const overallProgress = (safeCurrentChapter / totalChapters) * 100;

    if (bookStore.metadata?.id) {
      await bookStore.updateProgress({
        bookId: bookStore.metadata.id,
        cfi: '',
        scrollPosition: 0,
        chapterIndex: safeCurrentChapter,
        percentage: Math.round(overallProgress),
        timestamp: new Date(),
      });
    }
  }
);
```

4. Update settings watcher:

```javascript
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
      
      await nextTick();
      
      const scrollTop = containerRef.value.scrollTop;
      const scrollHeight = containerRef.value.scrollHeight - containerRef.value.clientHeight;
      
      if (scrollHeight <= 0) return;
      
      const currentChapterProgress = Math.min(1, Math.max(0, scrollTop / scrollHeight));
      const totalChapters = bookStore.chapters.length;
      
      if (totalChapters === 0) return;
      
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
);
```

5. Add validation in `setChapter` function in book store:

```javascript
function setChapter(index: number): void {
  const totalChapters = currentBook.value?.chapters?.length || 0;
  if (totalChapters === 0) {
    currentChapter.value = 0;
    return;
  }
  
  const safeIndex = Math.max(0, Math.min(index, totalChapters - 1));
  currentChapter.value = safeIndex;
}
```

6. Add computed property for safe chapter index:

```javascript
const safeCurrentChapter = computed(() => {
  const totalChapters = chapters.value.length;
  if (totalChapters === 0) return 0;
  return Math.max(0, Math.min(currentChapter.value, totalChapters - 1));
});
```

Then use `safeCurrentChapter.value` instead of `currentChapter` in progress calculations.

7. Add loading state guard in template:

```javascript
<template>
  <div v-if="bookStore.currentBook && bookStore.chapters.length > 0">
    <!-- Content -->
  </div>
</template>
```

This ensures UI only renders when data is in a valid state.
