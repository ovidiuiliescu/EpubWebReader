# Race Condition in Chapter Link Navigation

## Severity
High

## Affected Files
- `src/components/BookViewer.vue:110-138`

## Description
When handling chapter link clicks, there's a race condition where `loadChapterByHref` is called asynchronously, but if the user clicks multiple links rapidly or if there are pending async operations, state can become inconsistent:

```javascript
if (chapterIndex >= 0) {
  bookStore.setChapter(chapterIndex);
  // ... scroll to fragment
} else {
  const newChapter = await epub.loadChapterByHref(href);
  if (newChapter) {
    bookStore.addChapter(newChapter);
    chapterIndex = bookStore.chapters.length - 1;
    bookStore.setChapter(chapterIndex);
    // ... scroll to fragment
  }
}
```

## Why This Is A Problem

1. **State inconsistency**: If a user clicks two different links in quick succession:
   - First click starts loading a new chapter
   - Second click starts before the first completes
   - Both `loadChapterByHref` calls complete out of order
   - The UI may show the wrong chapter or fragment

2. **Stale data**: `bookStore.addChapter(newChapter)` adds the chapter to the store, but `chapterIndex = bookStore.chapters.length - 1` assumes the array hasn't changed since `loadChapterByHref` was called. If another operation adds/removes chapters concurrently, this index could be wrong.

3. **No cancellation**: There's no way to cancel an in-progress chapter load when a new link is clicked.

4. **Fragment scroll timing**: The fragment scroll happens in `nextTick()` after `bookStore.setChapter()`, but if the chapter content isn't fully rendered yet, the scroll may fail or scroll to the wrong position.

5. **Multiple pending operations**: The async nature means multiple chapter loads can be pending simultaneously, consuming unnecessary resources and potentially causing UI flicker.

## Implementation Plan

1. Track the current navigation operation and cancel previous ones:

```javascript
let currentNavigationId: string | null = null;

async function handleLinkClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  const link = target.closest('a') as HTMLAnchorElement | null;

  if (!link) return;

  const href = link.getAttribute('href');
  if (!href) return;

  if (href.startsWith('#')) {
    event.preventDefault();
    const elementId = href.substring(1);
    nextTick(() => {
      const targetElement = articleRef.value?.querySelector(`#${elementId}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    return;
  }

  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return;
  }

  event.preventDefault();

  // Generate unique navigation ID
  const navigationId = Math.random().toString(36).substring(7);
  currentNavigationId = navigationId;

  let chapterPath = href;
  let fragmentId = '';
  const fragmentIndex = href.indexOf('#');
  if (fragmentIndex >= 0) {
    chapterPath = href.substring(0, fragmentIndex);
    fragmentId = href.substring(fragmentIndex + 1);
  }

  chapterPath = decodeURIComponent(chapterPath).replace(/^\/+/, '');

  // Check if this navigation is still the most recent
  const isCurrentNavigation = () => currentNavigationId === navigationId;

  try {
    let chapterIndex = bookStore.chapters.findIndex(chapter => {
      const chapterHref = decodeURIComponent(chapter.href).replace(/^\/+/, '');
      if (chapterHref === chapterPath) return true;
      if (chapterHref.endsWith(`/${chapterPath}`) || chapterHref.endsWith(`\\${chapterPath}`)) return true;
      if (chapterPath.endsWith(`/${chapterHref}`) || chapterPath.endsWith(`\\${chapterHref}`)) return true;
      const chapterName = chapterHref.split('/').pop() || chapterHref;
      const linkName = chapterPath.split('/').pop() || chapterPath;
      return chapterName === linkName || chapterName.replace(/\.[^/.]+$/, '') === linkName.replace(/\.[^/.]+$/, '');
    });

    if (chapterIndex >= 0) {
      if (isCurrentNavigation()) {
        bookStore.setChapter(chapterIndex);

        if (fragmentId) {
          await nextTick();
          scrollToFragment(fragmentId);
        }
      }
      return;
    }

    const newChapter = await epub.loadChapterByHref(href);
    
    // Only proceed if this is still the current navigation
    if (newChapter && isCurrentNavigation()) {
      bookStore.addChapter(newChapter);
      chapterIndex = bookStore.chapters.length - 1;
      bookStore.setChapter(chapterIndex);

      if (fragmentId) {
        await nextTick();
        scrollToFragment(fragmentId);
      }
    }
  } catch (error) {
    console.error('Failed to navigate to chapter:', error);
  }
}

function scrollToFragment(fragmentId: string) {
  if (!isCurrentNavigation()) return;
  
  const targetElement = articleRef.value?.querySelector(`#${fragmentId}`);
  if (targetElement) {
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
```

2. Alternatively, use an AbortController pattern for more robust cancellation:

```javascript
let abortController: AbortController | null = null;

async function handleLinkClick(event: MouseEvent) {
  // Cancel any pending navigation
  if (abortController) {
    abortController.abort();
  }
  
  abortController = new AbortController();
  const signal = abortController.signal;
  
  try {
    // ... rest of navigation logic
    // Check signal.aborted before each async operation
    
    const newChapter = await epub.loadChapterByHref(href);
    if (signal.aborted) return;
    
    // ... continue with navigation
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Failed to navigate to chapter:', error);
    }
  } finally {
    if (signal.aborted) {
      abortController = null;
    }
  }
}
```

3. Add loading state to prevent multiple simultaneous navigation attempts:

```javascript
const isNavigating = ref(false);

async function handleLinkClick(event: MouseEvent) {
  if (isNavigating.value) return;
  
  isNavigating.value = true;
  try {
    // ... navigation logic
  } finally {
    isNavigating.value = false;
  }
}
```

4. Extract fragment scrolling into a separate function that can be retried if the element doesn't exist yet:

```javascript
async function scrollToFragment(fragmentId: string, retries = 3, delay = 100): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    await nextTick();
    const targetElement = articleRef.value?.querySelector(`#${fragmentId}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }
    if (i < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  console.warn(`Fragment #${fragmentId} not found after ${retries} attempts`);
  return false;
}
```
