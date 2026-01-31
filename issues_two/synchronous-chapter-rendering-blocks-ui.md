# Synchronous Chapter Rendering Blocks UI

## Severity
Medium

## Affected Files
- `src/components/BookViewer.vue:141-166`
- `src/components/BookViewer.vue:329-347`

## Description
Chapter rendering is synchronous and can block the UI for large chapters:

```typescript
function renderCurrentChapter() {
  if (!articleRef.value || !bookStore.currentBook) return;

  const chapter = bookStore.chapters[bookStore.currentChapter];
  if (!chapter) {
    articleRef.value.innerHTML = '<p class="text-center text-gray-500">No chapter content available.</p>';
    return;
  }

  let content = chapter.content || '<p class="text-center text-gray-500">Empty chapter.</p>';

  if (bookStore.searchHighlight && bookStore.searchHighlight.chapterIndex === bookStore.currentChapter) {
    content = highlightSearchText(content, bookStore.searchHighlight.searchText);  // Expensive!
  }

  articleRef.value.innerHTML = content;  // Synchronous DOM manipulation!

  if (!hasRestoredScrollPosition && bookStore.currentScrollPosition > 0) {
    containerRef.value!.scrollTop = bookStore.currentScrollPosition;
    hasRestoredScrollPosition = true;
  }

  if (bookStore.searchHighlight && bookStore.searchHighlight.chapterIndex === bookStore.currentChapter) {
    nextTick(() => scrollToFirstHighlight());
  }
}
```

The `highlightSearchText` function (lines 168-236) does expensive DOM parsing and manipulation, then `innerHTML` assignment causes:
1. HTML parsing by browser
2. Full DOM tree reconstruction
3. Style recalculation
4. Layout recalculation
5. Paint operations

For large chapters (10,000+ words), this can freeze the UI for hundreds of milliseconds.

## Impact on User Experience
- UI freeze when changing chapters
- Janky page transitions
- Lost animations during chapter loads
- Unresponsive scrolling during chapter render
- Poor user experience on mobile devices
- Browser may show "page unresponsive" warning

## Implementation Plan

### Fix 1: Use requestAnimationFrame for Rendering

```typescript
function renderCurrentChunk() {
  if (!articleRef.value || !bookStore.currentBook) return;

  const chapter = bookStore.chapters[bookStore.currentChapter];
  if (!chapter) {
    articleRef.value.innerHTML = '<p class="text-center text-gray-500">No chapter content available.</p>';
    return;
  }

  const content = chapter.content || '<p class="text-center text-gray-500">Empty chapter.</p>';

  requestAnimationFrame(() => {
    if (bookStore.searchHighlight && bookStore.searchHighlight.chapterIndex === bookStore.currentChapter) {
      // Process highlighting in chunks
      highlightSearchTextInChunks(content, bookStore.searchHighlight.searchText);
    } else {
      articleRef.value!.innerHTML = content;
    }

    requestAnimationFrame(() => {
      // Restore scroll position in next frame
      if (!hasRestoredScrollPosition && bookStore.currentScrollPosition > 0) {
        containerRef.value!.scrollTop = bookStore.currentScrollPosition;
        hasRestoredScrollPosition = true;
      }

      // Scroll to highlight in frame after that
      if (bookStore.searchHighlight && bookStore.searchHighlight.chapterIndex === bookStore.currentChapter) {
        requestAnimationFrame(scrollToFirstHighlight);
      }
    });
  });
}
```

### Fix 2: Chunked HTML Rendering

```typescript
function renderChapterInChunks(html: string, chunkSize: number = 50000) {
  if (!articleRef.value) return;

  articleRef.value.innerHTML = '';  // Clear first

  const chunks = splitHtmlIntoChunks(html, chunkSize);
  let currentChunk = 0;

  function renderNextChunk() {
    if (currentChunk >= chunks.length) return;

    const chunk = document.createElement('div');
    chunk.innerHTML = chunks[currentChunk];
    articleRef.value!.appendChild(chunk);

    currentChunk++;

    if (currentChunk < chunks.length) {
      requestAnimationFrame(renderNextChunk);
    } else {
      // All chunks rendered
      if (!hasRestoredScrollPosition && bookStore.currentScrollPosition > 0) {
        containerRef.value!.scrollTop = bookStore.currentScrollPosition;
        hasRestoredScrollPosition = true;
      }
    }
  }

  renderNextChunk();
}

function splitHtmlIntoChunks(html: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  let currentPos = 0;

  while (currentPos < html.length) {
    // Find a safe break point (end of tag or whitespace)
    let endPos = currentPos + chunkSize;

    if (endPos < html.length) {
      const tagEnd = html.indexOf('>', endPos - 1000);
      const spacePos = html.lastIndexOf(' ', endPos);

      if (tagEnd !== -1 && tagEnd < endPos + 500) {
        endPos = tagEnd + 1;
      } else if (spacePos !== -1 && spacePos > currentPos) {
        endPos = spacePos;
      }
    }

    chunks.push(html.substring(currentPos, endPos));
    currentPos = endPos;
  }

  return chunks;
}
```

### Fix 3: Use DocumentFragment for Batch DOM Operations

```typescript
function renderWithDocumentFragment() {
  if (!articleRef.value || !bookStore.currentBook) return;

  const chapter = bookStore.chapters[bookStore.currentChapter];
  if (!chapter) {
    articleRef.value.textContent = 'No chapter content available.';
    return;
  }

  const content = chapter.content || '<p>Empty chapter.</p>';

  // Use DocumentFragment to minimize reflows
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;

  while (tempDiv.firstChild) {
    fragment.appendChild(tempDiv.firstChild);
  }

  articleRef.value.textContent = '';
  articleRef.value.appendChild(fragment);
}
```

### Fix 4: Progressive Loading with Skeleton

```typescript
const isLoadingChapter = ref(false);

async function renderCurrentChapter() {
  if (!articleRef.value || !bookStore.currentBook) return;

  const chapter = bookStore.chapters[bookStore.currentChapter];
  if (!chapter) {
    articleRef.value.innerHTML = '<p class="text-center text-gray-500">No chapter content available.</p>';
    return;
  }

  // Show skeleton while loading
  isLoadingChapter.value = true;
  articleRef.value.innerHTML = `
    <div class="skeleton">
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
    </div>
  `;

  // Use setTimeout to let skeleton render first
  setTimeout(() => {
    let content = chapter.content || '<p>Empty chapter.</p>';

    if (bookStore.searchHighlight && bookStore.searchHighlight.chapterIndex === bookStore.currentChapter) {
      content = highlightSearchText(content, bookStore.searchHighlight.searchText);
    }

    requestAnimationFrame(() => {
      articleRef.value!.innerHTML = content;
      isLoadingChapter.value = false;

      if (!hasRestoredScrollPosition && bookStore.currentScrollPosition > 0) {
        containerRef.value!.scrollTop = bookStore.currentScrollPosition;
        hasRestoredScrollPosition = true;
      }
    });
  }, 0);
}
```

### Fix 5: Use Web Worker for Search Highlighting

```typescript
// Move expensive highlighting to Web Worker
// workers/highlighter.worker.ts
self.onmessage = (e) => {
  const { html, searchText, chunkIndex, totalChunks } = e.data;

  try {
    const highlighted = highlightSearchTextWorker(html, searchText);

    self.postMessage({
      success: true,
      chunkIndex,
      highlightedHtml: highlighted,
      totalChunks,
    });
  } catch (error) {
    self.postMessage({
      success: false,
      error: error.message,
      chunkIndex,
    });
  }
};

function highlightSearchTextWorker(html: string, searchText: string): string {
  // Same highlighting logic but in worker
  // ...
  return html;
}
```

Usage:
```typescript
let highlightWorker: Worker | null = null;

function initHighlightWorker() {
  if (!highlightWorker) {
    highlightWorker = new Worker('/workers/highlighter.worker.js');
  }
  return highlightWorker;
}

async function renderCurrentChapterWithWorker() {
  if (!articleRef.value || !bookStore.currentBook) return;

  const chapter = bookStore.chapters[bookStore.currentChapter];
  if (!chapter) {
    articleRef.value.innerHTML = '<p class="text-center text-gray-500">No chapter content available.</p>';
    return;
  }

  const content = chapter.content || '<p>Empty chapter.</p>';

  if (bookStore.searchHighlight && bookStore.searchHighlight.chapterIndex === bookStore.currentChapter) {
    const worker = initHighlightWorker();

    const result = await new Promise<string>((resolve, reject) => {
      worker.onmessage = (e) => {
        if (e.data.success) {
          resolve(e.data.highlightedHtml);
        } else {
          reject(new Error(e.data.error));
        }
      };

      worker.onerror = reject;

      worker.postMessage({
        html: content,
        searchText: bookStore.searchHighlight.searchText,
        chunkIndex: 0,
        totalChunks: 1,
      });
    });

    articleRef.value.innerHTML = result;
  } else {
    articleRef.value.innerHTML = content;
  }

  if (!hasRestoredScrollPosition && bookStore.currentScrollPosition > 0) {
    containerRef.value!.scrollTop = bookStore.currentScrollPosition;
    hasRestoredScrollPosition = true;
  }
}
```

### Fix 6: Use CSS Containment

```typescript
// Add CSS to isolate chapter rendering
function applyContainmentStyles() {
  if (!articleRef.value) return;

  articleRef.value.style.contain = 'strict';
  articleRef.value.style.contentVisibility = 'auto';
}
```

In CSS:
```css
article {
  contain: strict;
  content-visibility: auto;
}
```

This tells the browser to optimize rendering of the element.

## Additional Optimizations
1. Implement virtual scrolling for very long chapters
2. Use IntersectionObserver to lazy-load images in chapters
3. Add transition animations for chapter changes
4. Implement chapter prefetching in background
5. Use a loading spinner during heavy operations
6. Add option to disable animations for better performance
7. Implement chapter content caching
8. Use CSS will-change property for animated elements
9. Add error boundary for rendering failures
10. Consider using a virtual DOM library like react-window for chapter content
