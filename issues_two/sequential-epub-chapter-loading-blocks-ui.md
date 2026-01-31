# Sequential EPUB Chapter Loading Blocks UI

## Severity
Critical

## Affected Files
- `src/composables/useEpub.ts:314-346`
- `src/composables/useEpub.ts:334-342`

## Description
The `loadChapters` function loads all chapter content sequentially and synchronously when a book is opened:

```typescript
async function loadChapters(book: any, baseUrl: string | undefined, toc: TocItem[]): Promise<Chapter[]> {
  const chapters: Chapter[] = [];

  const allItems: { item: TocItem; isChild: boolean }[] = [];

  for (const item of toc) {
    allItems.push({ item, isChild: false });
    if (item.children) {
      for (const child of item.children) {
        allItems.push({ item: child, isChild: true });
      }
    }
  }

  for (const { item } of allItems) {
    const content = await loadChapterContent(book, baseUrl, item.href, item.title); // Sequential!
    chapters.push({
      id: item.id,
      href: item.href,
      title: item.title,
      level: item.level,
      content,
    });
  }

  return chapters;
}
```

For large EPUBs with hundreds of chapters, this causes:
1. Extremely long initial load times (seconds to minutes)
2. UI freeze during loading (no progress indication)
3. High memory usage (all chapters in memory at once)
4. Unnecessary loading of chapters the user may never read

The `loadChapterContent` function (lines 348-450) also performs expensive DOM parsing and image processing for every chapter upfront.

## Impact on User Experience
- App appears frozen when opening large books
- Users may think the app crashed
- No feedback on loading progress
- Unnecessary memory consumption
- Poor first-chapter display time (user must wait for all chapters)
- Potential browser tab crashes with very large EPUBs

## Implementation Plan

### Option 1: Lazy Load Chapter Content (Recommended)

```typescript
// src/composables/useEpub.ts
async function loadChapters(book: any, baseUrl: string | undefined, toc: TocItem[]): Promise<Chapter[]> {
  const chapters: Chapter[] = [];

  const allItems: { item: TocItem; isChild: boolean }[] = [];

  for (const item of toc) {
    allItems.push({ item, isChild: false });
    if (item.children) {
      for (const child of item.children) {
        allItems.push({ item: child, isChild: true });
      }
    }
  }

  allItems.sort((a, b) => {
    const aOrder = a.item.playOrder || 0;
    const bOrder = b.item.playOrder || 0;
    return aOrder - bOrder;
  });

  // Only load metadata, not content
  for (const { item } of allItems) {
    chapters.push({
      id: item.id,
      href: item.href,
      title: item.title,
      level: item.level,
      content: undefined, // Lazy load
    });
  }

  return chapters;
}

// Add a new function to load chapter content on demand
async function loadChapterContent(book: any, baseUrl: string | undefined, href: string, title: string): Promise<string> {
  // ... existing implementation
}

// Cache loaded chapters to avoid re-loading
const chapterContentCache = new Map<string, Promise<string>>();

async function getChapterContent(chapter: Chapter): Promise<string> {
  if (chapter.content !== undefined) {
    return chapter.content;
  }

  if (!chapterContentCache.has(chapter.href)) {
    const promise = loadChapterContent(currentBook, currentBaseUrl, chapter.href, chapter.title);
    chapterContentCache.set(chapter.href, promise);
    const content = await promise;

    // Update the chapter in the book
    if (currentBook && currentBook.chapters) {
      const index = currentBook.chapters.findIndex(c => c.href === chapter.href);
      if (index !== -1) {
        currentBook.chapters[index].content = content;
      }
    }

    return content;
  }

  return chapterContentCache.get(chapter.href)!;
}
```

### Option 2: Prefetch N Chapters Ahead

```typescript
const PREFETCH_COUNT = 2; // Load current + 2 next chapters

async function prefetchChapters(currentIndex: number) {
  const chaptersToPrefetch = chapters.value.slice(
    currentIndex + 1,
    currentIndex + 1 + PREFETCH_COUNT
  );

  await Promise.all(
    chaptersToPrefetch.map(chapter => getChapterContent(chapter))
  );
}
```

### Option 3: Use Web Worker for Background Loading

```typescript
// Create a new worker: workers/chapterLoader.worker.ts
self.onmessage = async (e) => {
  const { bookData, baseUrl, chapter } = e.data;
  try {
    const content = await loadChapterContent(bookData, baseUrl, chapter.href, chapter.title);
    self.postMessage({ success: true, chapterHref: chapter.href, content });
  } catch (error) {
    self.postMessage({ success: false, chapterHref: chapter.href, error });
  }
};
```

### Update BookViewer to support lazy loading

```typescript
// src/components/BookViewer.vue
async function renderCurrentChapter() {
  if (!articleRef.value || !bookStore.currentBook) return;

  const chapter = bookStore.chapters[bookStore.currentChapter];
  if (!chapter) {
    articleRef.value.innerHTML = '<p class="text-center text-gray-500">No chapter content available.</p>';
    return;
  }

  // Lazy load chapter content if not loaded
  if (chapter.content === undefined) {
    articleRef.value.innerHTML = '<p class="text-center text-gray-500">Loading chapter...</p>';
    chapter.content = await epub.getChapterContent(chapter);

    // Prefetch next chapters
    epub.prefetchChapters(bookStore.currentChapter);
  }

  let content = chapter.content || '<p class="text-center text-gray-500">Empty chapter.</p>';

  // ... rest of rendering logic
}
```

## Additional Optimizations
1. Add progress indicator showing chapters loaded vs total
2. Implement chapter content expiration to free memory
3. Use LRU cache for chapter content (e.g., keep last 5 chapters in memory)
4. Prioritize loading first chapter before loading others
5. Consider streaming/chunking chapter loading for very large chapters
6. Add option to "pre-load entire book" for offline use
7. Cache parsed chapters in IndexedDB for faster subsequent loads
