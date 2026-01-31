# Unsafe Non-Null Assertions and Missing Null Checks

**Severity:** Medium

**Affected Files:**
- `src/components/BookViewer.vue:53,159,201,207-208,220,278,312`
- `src/components/HomeScreen.vue:69`
- `src/components/LibraryPanel.vue:69`

## Description

The codebase uses non-null assertions (`!`) and accesses potentially null/undefined values without proper null checks, which can lead to runtime errors if the assumptions don't hold.

### Specific Issues:

**src/components/BookViewer.vue:**
```typescript
Line 53:   bookId: bookStore.metadata!.id,  // metadata could be undefined
Line 159:  containerRef.value!.scrollTop = bookStore.currentScrollPosition;
Line 201:  const parts: (string | HTMLElement)[] = [];
Line 207:  parts.push(node.textContent!.substring(lastIndex, match.index));
Line 208:  const mark = document.createElement('mark');
Line 220:  if (lastIndex < (node.textContent || '').length) {
Line 278:  await bookStore.updateProgress({
             bookId: bookStore.metadata!.id,
Line 312:  await bookStore.updateProgress({
             bookId: bookStore.metadata!.id,
```

**src/components/HomeScreen.vue:**
```typescript
Line 69:  coverUrls.value.get(id)!  // Non-null assertion on Map.get()
```

**src/components/LibraryPanel.vue:**
```typescript
Line 69:  URL.revokeObjectURL(coverUrls.value.get(id)!);  // Non-null assertion on Map.get()
```

## Why This is Problematic

1. **Runtime Errors**: If the value is actually `null` or `undefined`, a `TypeError` will be thrown at runtime (e.g., "Cannot read property 'id' of undefined").

2. **Type Safety Bypass**: Non-null assertions (`!`) tell TypeScript "trust me, this isn't null", but if the assumption is wrong, the error occurs at runtime instead of being caught at compile time.

3. **Cascading Errors**: One null reference error can crash the entire application or leave it in an inconsistent state.

4. **Hard to Debug**: When these errors occur, the stack trace may not clearly indicate which non-null assertion failed.

5. **Brittle Code**: Code with non-null assertions is more brittle to refactoring or changes in data flow.

## Implementation Plan

### Step 1: Add Null Checks for bookStore.metadata in BookViewer

**Line 53:**
```typescript
// Before:
await bookStore.updateProgress({
  bookId: bookStore.metadata!.id,
  // ...
});

// After:
if (!bookStore.metadata) {
  console.error('No book metadata available for progress update');
  return;
}
await bookStore.updateProgress({
  bookId: bookStore.metadata.id,
  cfi: '',
  scrollPosition: scrollTop,
  chapterIndex: bookStore.currentChapter,
  percentage: Math.round(overallProgress),
  timestamp: new Date(),
});
```

**Line 159:**
```typescript
// Before:
if (!hasRestoredScrollPosition && bookStore.currentScrollPosition > 0) {
  containerRef.value!.scrollTop = bookStore.currentScrollPosition;
  hasRestoredScrollPosition = true;
}

// After:
if (!hasRestoredScrollPosition && bookStore.currentScrollPosition > 0) {
  if (containerRef.value) {
    containerRef.value.scrollTop = bookStore.currentScrollPosition;
    hasRestoredScrollPosition = true;
  }
}
```

**Line 278:**
```typescript
// Before:
await bookStore.updateProgress({
  bookId: bookStore.metadata!.id,
  // ...
});

// After:
if (!bookStore.metadata) {
  console.error('No book metadata available for progress update');
  return;
}
await bookStore.updateProgress({
  bookId: bookStore.metadata.id,
  cfi: '',
  scrollPosition: 0,
  chapterIndex: bookStore.currentChapter,
  percentage: Math.round(overallProgress),
  timestamp: new Date(),
});
```

**Line 312:**
```typescript
// Before:
await bookStore.updateProgress({
  bookId: bookStore.metadata!.id,
  // ...
});

// After:
if (!bookStore.metadata) {
  console.error('No book metadata available for progress update');
  return;
}
await bookStore.updateProgress({
  bookId: bookStore.metadata.id,
  cfi: '',
  scrollPosition: scrollTop,
  chapterIndex: bookStore.currentChapter,
  percentage: Math.round(overallProgress),
  timestamp: new Date(),
});
```

### Step 2: Fix textContent Null Checks in highlightSearchText

**Lines 207, 220:**
```typescript
// Before:
for (const { node, parent } of nodesToReplace) {
  const matches = (node.textContent || '').matchAll(regex);
  const parts: (string | HTMLElement)[] = [];
  let lastIndex = 0;

  for (const match of matches) {
    if (match.index !== undefined) {
      parts.push(node.textContent!.substring(lastIndex, match.index));  // Line 207
      const mark = document.createElement('mark');
      mark.className = 'search-highlight';
      if (matchCount === targetIndex) {
        mark.classList.add('active');
      }
      mark.textContent = match[0];
      parts.push(mark);
      lastIndex = match.index + match[0].length;
      matchCount++;
    }
  }

  if (lastIndex < (node.textContent || '').length) {  // Line 220
    parts.push(node.textContent!.substring(lastIndex));
  }

  // ...
}

// After:
for (const { node, parent } of nodesToReplace) {
  const textContent = node.textContent || '';
  const matches = textContent.matchAll(regex);
  const parts: (string | HTMLElement)[] = [];
  let lastIndex = 0;

  for (const match of matches) {
    if (match.index !== undefined) {
      parts.push(textContent.substring(lastIndex, match.index));
      const mark = document.createElement('mark');
      mark.className = 'search-highlight';
      if (matchCount === targetIndex) {
        mark.classList.add('active');
      }
      mark.textContent = match[0];
      parts.push(mark);
      lastIndex = match.index + match[0].length;
      matchCount++;
    }
  }

  if (lastIndex < textContent.length) {
    parts.push(textContent.substring(lastIndex));
  }

  // ...
}
```

### Step 3: Fix coverUrl Non-Null Assertions in HomeScreen

**Line 69:**
```typescript
// Before:
async function removeBook(id: string) {
  await libraryStore.removeBook(id);
  if (bookStore.metadata?.id === id) {
    bookStore.clearBook();
  }
  if (coverUrls.value.has(id)) {
    URL.revokeObjectURL(coverUrls.value.get(id)!);
    coverUrls.value.delete(id);
  }
}

// After:
async function removeBook(id: string) {
  await libraryStore.removeBook(id);
  if (bookStore.metadata?.id === id) {
    bookStore.clearBook();
  }
  const coverUrl = coverUrls.value.get(id);
  if (coverUrl) {
    URL.revokeObjectURL(coverUrl);
    coverUrls.value.delete(id);
  }
}
```

### Step 4: Fix coverUrl Non-Null Assertions in LibraryPanel

**Line 69:**
```typescript
// Before:
async function removeBook(id: string) {
  await libraryStore.removeBook(id);
  if (bookStore.metadata?.id === id) {
    bookStore.clearBook();
  }
  if (coverUrls.value.has(id)) {
    URL.revokeObjectURL(coverUrls.value.get(id)!);
    coverUrls.value.delete(id);
  }
}

// After:
async function removeBook(id: string) {
  await libraryStore.removeBook(id);
  if (bookStore.metadata?.id === id) {
    bookStore.clearBook();
  }
  const coverUrl = coverUrls.value.get(id);
  if (coverUrl) {
    URL.revokeObjectURL(coverUrl);
    coverUrls.value.delete(id);
  }
}
```

### Step 5: Use Optional Chaining and Nullish Coalescing

Consider using optional chaining (`?.`) and nullish coalescing (`??`) operators where appropriate:

```typescript
// Example: Instead of:
containerRef.value!.scrollTop = value;

// Use:
containerRef.value?.scrollTop = value;

// Example: Instead of:
const text = node.textContent || '';

// Use:
const text = node.textContent ?? '';
```

### Step 6: Extract Safe Helper Functions

For common patterns, create helper functions:

```typescript
// src/components/BookViewer.vue

function safeSetScrollTop(element: HTMLElement | null, value: number): void {
  if (element) {
    element.scrollTop = value;
  }
}

function safeUpdateProgress(bookStore: ReturnType<typeof useBookStore>, progress: ReadingProgress): void {
  if (!bookStore.metadata) {
    console.error('No book metadata available for progress update');
    return;
  }
  bookStore.updateProgress(progress);
}

// Then use:
safeSetScrollTop(containerRef.value, bookStore.currentScrollPosition);
```

## Priority Order

1. **HIGH**: Fix all `bookStore.metadata!` non-null assertions (lines 53, 278, 312 in BookViewer.vue)
2. **HIGH**: Fix `containerRef.value!` non-null assertion (line 159 in BookViewer.vue)
3. **MEDIUM**: Fix `textContent!` non-null assertions (lines 207, 220 in BookViewer.vue)
4. **MEDIUM**: Fix `coverUrls.value.get(id)!` non-null assertions (lines 69 in HomeScreen.vue and LibraryPanel.vue)
5. **LOW**: Consider extracting helper functions for common patterns

## Testing Considerations

After implementing these changes:
- Test the application with an empty book (no metadata)
- Test with a book that has missing or null metadata properties
- Verify scroll position restoration still works
- Test search functionality with various book contents
- Test removing books from the library
- Monitor console for any error messages from the new null checks
- Run TypeScript compiler to verify no new type errors are introduced
