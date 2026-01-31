# Missing Error Handling in useEpub.loadChapterByHref

## Severity
Medium

## Affected Files
- `src/composables/useEpub.ts:139-174`

## Description
The `loadChapterByHref` function catches errors but only logs them with a console.warn, then returns `null`. This can lead to silent failures and poor user experience when chapter loading fails.

```javascript
async function loadChapterByHref(href: string): Promise<Chapter | null> {
  if (!currentBook || !(currentBook as any).chapters) return null;

  try {
    // ... loading logic
    return newChapter;
  } catch (err) {
    console.warn(`Failed to load chapter: ${href}`, err);
    return null;
  }
}
```

## Why This Is A Problem

1. **Silent failures**: When a chapter fails to load, the function returns `null` but the caller doesn't always handle this gracefully:
   - In `BookViewer.vue:124`, if `newChapter` is `null`, nothing happens - the chapter isn't added, and the user sees a broken navigation link
   - User clicks a link but nothing happens, leading to confusion

2. **Poor error reporting**: Users see no error message, making debugging impossible for non-technical users

3. **No retry mechanism**: If a chapter load fails due to temporary issue (network, corruption), there's no way to retry

4. **No validation**: The function doesn't validate that `currentBook` or `chapters` actually exist before proceeding

5. **Inconsistent error handling**: Other parts of the codebase have different error handling strategies, making the codebase inconsistent

6. **Information leakage**: Console warnings might contain file paths or other information that shouldn't be logged

## Implementation Plan

1. Create a typed error class for chapter loading errors:

```javascript
// errors/chapterError.ts
export class ChapterLoadError extends Error {
  constructor(
    message: string,
    public readonly href: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ChapterLoadError';
  }
}
```

2. Update `loadChapterByHref` to throw errors instead of returning null:

```javascript
import { ChapterLoadError } from '@/errors/chapterError';

async function loadChapterByHref(href: string): Promise<Chapter> {
  if (!currentBook) {
    throw new ChapterLoadError('No book is currently loaded', href);
  }
  
  if (!(currentBook as any).chapters) {
    throw new ChapterLoadError('Book chapters not available', href);
  }

  try {
    let chapterPath = href;
    if (currentBaseUrl) {
      try {
        chapterPath = new URL(href, `http://localhost/${currentBaseUrl}`).pathname;
      } catch (err) {
        // If URL parsing fails, use original href
        chapterPath = href;
      }
    }

    chapterPath = chapterPath.replace(/^\//, '');
    chapterPath = decodeURIComponent(chapterPath);

    const content = await loadChapterContent(currentBook, currentBaseUrl, href, href);
    const title = await getTitleFromChapter(currentBook, chapterPath);

    const newChapter: Chapter = {
      id: chapterPath,
      href: href,
      title: title || chapterPath.split('/').pop() || href,
      level: 0,
      content,
    };

    (currentBook as any).chapters.push(newChapter);

    return newChapter;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    throw new ChapterLoadError(
      `Failed to load chapter from ${href}`,
      href,
      error
    );
  }
}
```

3. Update `BookViewer.vue` to handle errors properly:

```javascript
async function handleLinkClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  const link = target.closest('a') as HTMLAnchorElement | null;

  if (!link) return;

  const href = link.getAttribute('href');
  if (!href) return;

  // ... fragment handling ...

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

  const isCurrentNavigation = () => currentNavigationId === navigationId;

  try {
    let chapterIndex = bookStore.chapters.findIndex(/* ... */);

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

    // Load new chapter
    const newChapter = await epub.loadChapterByHref(href);
    
    if (isCurrentNavigation()) {
      bookStore.addChapter(newChapter);
      chapterIndex = bookStore.chapters.length - 1;
      bookStore.setChapter(chapterIndex);

      if (fragmentId) {
        await nextTick();
        scrollToFragment(fragmentId);
      }
    }
  } catch (error) {
    if (!isCurrentNavigation()) return;
    
    console.error('Failed to navigate to chapter:', error);
    
    // Show error to user
    const errorMessage = error instanceof ChapterLoadError 
      ? `Could not load chapter: ${error.message}`
      : 'Could not load chapter. Please try again.';
    
    // You could add an error state to the component
    error.value = errorMessage;
  }
}
```

4. Add error state to BookViewer:

```javascript
const error = ref<string | null>(null);

function clearError() {
  error.value = null;
}
```

And in template:

```html
<div v-if="error" class="fixed bottom-4 left-4 right-4 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-lg shadow-lg flex items-center gap-3 z-50">
  <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  <span class="flex-1">{{ error }}</span>
  <button @click="clearError" class="p-1 hover:bg-red-200 dark:hover:bg-red-800/50 rounded">
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>
</div>
```

5. Add error handling to `loadChapterContent` and `getTitleFromChapter`:

```javascript
async function loadChapterContent(book: any, baseUrl: string | undefined, href: string, title: string): Promise<string> {
  try {
    // ... existing logic
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    throw new ChapterLoadError(
      `Failed to load chapter content: ${title} (${href})`,
      href,
      error
    );
  }
}

async function getTitleFromChapter(book: any, chapterPath: string): Promise<string> {
  try {
    // ... existing logic
    return titleEl?.textContent || '';
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    throw new ChapterLoadError(
      `Failed to get chapter title: ${chapterPath}`,
      chapterPath,
      error
    );
  }
}
```

6. Add error handling in book store:

```javascript
// stores/book.ts
async function loadBook(file: File, shouldCache: boolean = true, existingBookId?: string): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    const { epub } = await import('@/composables/useEpub');
    const libraryStore = useLibraryStore();
    const book = await epub.loadEpub(file, existingBookId);
    
    // ... rest of loading logic
  } catch (err) {
    error.value = err instanceof Error ? err : new Error('Failed to load book');
    throw err;
  } finally {
    isLoading.value = false;
  }
}
```

7. Add retry functionality:

```javascript
async function retryLoadChapter(href: string): Promise<void> {
  error.value = null;
  try {
    const newChapter = await epub.loadChapterByHref(href);
    bookStore.addChapter(newChapter);
    const chapterIndex = bookStore.chapters.length - 1;
    bookStore.setChapter(chapterIndex);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load chapter';
  }
}
```

8. Add error logging service:

```javascript
// services/errorLogger.ts
export class ErrorLogger {
  private static instance: ErrorLogger;
  private errors: Error[] = [];

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  log(error: Error, context?: Record<string, unknown>): void {
    this.errors.push(error);
    
    // Log to console with context
    console.error('Error logged:', error, context);
    
    // In production, you might send to error tracking service
    // e.g., Sentry, LogRocket, etc.
  }

  getErrors(): Error[] {
    return [...this.errors];
  }

  clearErrors(): void {
    this.errors = [];
  }
}
```
