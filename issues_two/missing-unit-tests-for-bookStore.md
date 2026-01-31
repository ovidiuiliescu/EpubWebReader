# Missing Unit Tests for BookStore

**Severity:** High  
**Issue Type:** Missing Unit Tests

## Affected Files
- `src/stores/book.ts` (lines 1-138) - Entire file untested

## Description
The `bookStore` (Pinia store) manages all book-related state including loading books, chapter navigation, reading progress tracking, and search highlighting. This is core state management layer with zero test coverage.

**Untested Functions:**
- `loadBook()` - Main book loading function (lines 22-64)
- `setChapter()` - Chapter selection (lines 66-70)
- `nextChapter()` - Navigate forward (lines 72-76)
- `prevChapter()` - Navigate backward (lines 78-82)
- `updateProgress()` - Track reading progress (lines 84-99)
- `clearBook()` - Reset book state (lines 101-105)
- `setSearchHighlight()` - Search highlighting state (lines 107-109)
- `addChapter()` - Dynamic chapter addition (lines 111-115)

**Computed Properties:**
- `metadata` (line 15)
- `chapters` (line 16)
- `toc` (line 17)
- `currentChapterData` (lines 18-20)

## Why This Needs Testing
- **Core state management**: All book operations go through this store
- **Complex async logic**: `loadBook` involves multiple async operations
- **LibraryStore integration**: Must interact correctly with library store
- **Progress tracking**: Reading progress must be saved correctly
- **Chapter navigation**: Must handle boundary conditions
- **Error handling**: Try-catch blocks need validation (lines 58-60)
- **State persistence**: Maps and refs must maintain correct state

## Implementation Plan

### 1. Create Test File
`src/stores/book.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBookStore } from './book';
import { useLibraryStore } from './library';

describe('useBookStore', () => {
  let bookStore: ReturnType<typeof useBookStore>;
  let libraryStore: ReturnType<typeof useLibraryStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    bookStore = useBookStore();
    libraryStore = useLibraryStore();
    // Mock useEpub
  });

  // Test cases below
});
```

### 2. Test State Initialization
```typescript
describe('initial state', () => {
  it('should initialize with null currentBook', () => {
    expect(bookStore.currentBook).toBeNull();
  });

  it('should initialize with currentChapter 0', () => {
    expect(bookStore.currentChapter).toBe(0);
  });

  it('should initialize with scrollPosition 0', () => {
    expect(bookStore.currentScrollPosition).toBe(0);
  });

  it('should initialize with isLoading false', () => {
    expect(bookStore.isLoading).toBe(false);
  });

  it('should initialize with error null', () => {
    expect(bookStore.error).toBeNull();
  });

  it('should initialize with empty searchHighlight', () => {
    expect(bookStore.searchHighlight).toBeNull();
  });

  it('should initialize with empty readingProgress map', () => {
    expect(bookStore.readingProgress.size).toBe(0);
  });
});
```

### 3. Test Computed Properties
```typescript
describe('computed properties', () => {
  beforeEach(async () => {
    await bookStore.loadBook(mockFile);
  });

  it('should return metadata from currentBook', () => {
    expect(bookStore.metadata).toBeDefined();
    expect(bookStore.metadata?.title).toBe('Test Book');
  });

  it('should return chapters from currentBook', () => {
    expect(bookStore.chapters).toBeInstanceOf(Array);
    expect(bookStore.chapters.length).toBeGreaterThan(0);
  });

  it('should return toc from currentBook', () => {
    expect(bookStore.toc).toBeInstanceOf(Array);
  });

  it('should return current chapter data', () => {
    bookStore.setChapter(0);
    const chapter = bookStore.currentChapterData;
    expect(chapter).toBeDefined();
    expect(chapter?.title).toBeTypeOf('string');
  });

  it('should return undefined for currentChapterData when no book', () => {
    bookStore.clearBook();
    expect(bookStore.currentChapterData).toBeUndefined();
  });
});
```

### 4. Test loadBook Function
```typescript
describe('loadBook', () => {
  it('should load book and set currentBook', async () => {
    const mockFile = new File(['test'], 'test.epub', { type: 'application/epub+zip' });
    
    await bookStore.loadBook(mockFile);
    
    expect(bookStore.currentBook).not.toBeNull();
    expect(bookStore.metadata?.title).toBe('Test Book');
  });

  it('should set isLoading to true during load', async () => {
    const mockFile = new File(['test'], 'test.epub', { type: 'application/epub+zip' });
    
    const loadPromise = bookStore.loadBook(mockFile);
    expect(bookStore.isLoading).toBe(true);
    
    await loadPromise;
    expect(bookStore.isLoading).toBe(false);
  });

  it('should reset currentChapter to 0 on load', async () => {
    bookStore.setChapter(5);
    const mockFile = new File(['test'], 'test.epub', { type: 'application/epub+zip' });
    
    await bookStore.loadBook(mockFile);
    
    expect(bookStore.currentChapter).toBe(0);
  });

  it('should reset scrollPosition to 0 on load', async () => {
    bookStore.currentScrollPosition = 500;
    const mockFile = new File(['test'], 'test.epub', { type: 'application/epub+zip' });
    
    await bookStore.loadBook(mockFile);
    
    expect(bookStore.currentScrollPosition).toBe(0);
  });

  it('should cache book when shouldCache is true', async () => {
    const mockFile = new File(['test'], 'test.epub', { type: 'application/epub+zip' });
    const cacheSpy = vi.spyOn(libraryStore, 'cacheBook');
    
    await bookStore.loadBook(mockFile, true);
    
    expect(cacheSpy).toHaveBeenCalled();
  });

  it('should not cache book when shouldCache is false', async () => {
    const mockFile = new File(['test'], 'test.epub', { type: 'application/epub+zip' });
    const cacheSpy = vi.spyOn(libraryStore, 'cacheBook');
    
    await bookStore.loadBook(mockFile, false);
    
    expect(cacheSpy).not.toHaveBeenCalled();
  });

  it('should use existingBookId when provided', async () => {
    const mockFile = new File(['test'], 'test.epub', { type: 'application/epub+zip' });
    
    await bookStore.loadBook(mockFile, true, 'existing-id-123');
    
    expect(bookStore.metadata?.id).toBe('existing-id-123');
  });

  it('should restore reading progress from library', async () => {
    const mockFile = new File(['test'], 'test.epub', { type: 'application/epub+zip' });
    // Mock libraryStore.getReadingProgress to return progress
    vi.spyOn(libraryStore, 'getReadingProgress').mockResolvedValue({
      chapterIndex: 5,
      scrollPosition: 1000,
      percentage: 50,
    });
    
    await bookStore.loadBook(mockFile);
    
    expect(bookStore.currentChapter).toBe(5);
    expect(bookStore.currentScrollPosition).toBe(1000);
  });

  it('should set error on load failure', async () => {
    const mockFile = new File(['test'], 'test.epub', { type: 'application/epub+zip' });
    // Mock loadEpub to throw error
    vi.spyOn(libraryStore, 'cacheBook').mockRejectedValue(new Error('Load failed'));
    
    await expect(bookStore.loadBook(mockFile)).rejects.toThrow();
    expect(bookStore.error).not.toBeNull();
  });

  it('should reset error to null on successful load', async () => {
    bookStore.error = new Error('Previous error');
    const mockFile = new File(['test'], 'test.epub', { type: 'application/epub+zip' });
    
    await bookStore.loadBook(mockFile);
    
    expect(bookStore.error).toBeNull();
  });
});
```

### 5. Test Chapter Navigation Functions
```typescript
describe('setChapter', () => {
  beforeEach(async () => {
    await bookStore.loadBook(mockFile);
  });

  it('should set chapter to valid index', () => {
    bookStore.setChapter(2);
    expect(bookStore.currentChapter).toBe(2);
  });

  it('should not set chapter to negative index', () => {
    bookStore.setChapter(-1);
    expect(bookStore.currentChapter).toBeGreaterThanOrEqual(0);
  });

  it('should not set chapter beyond chapter count', () => {
    const maxChapter = bookStore.chapters.length;
    bookStore.setChapter(maxChapter + 5);
    expect(bookStore.currentChapter).toBeLessThan(bookStore.chapters.length);
  });

  it('should set chapter to 0 when valid', () => {
    bookStore.setChapter(0);
    expect(bookStore.currentChapter).toBe(0);
  });
});

describe('nextChapter', () => {
  beforeEach(async () => {
    await bookStore.loadBook(mockFile);
  });

  it('should increment chapter when not at last', () => {
    bookStore.setChapter(0);
    bookStore.nextChapter();
    expect(bookStore.currentChapter).toBe(1);
  });

  it('should not increment beyond last chapter', () => {
    const lastIndex = bookStore.chapters.length - 1;
    bookStore.setChapter(lastIndex);
    bookStore.nextChapter();
    expect(bookStore.currentChapter).toBe(lastIndex);
  });

  it('should not change chapter when already at last', () => {
    const lastIndex = bookStore.chapters.length - 1;
    bookStore.setChapter(lastIndex);
    bookStore.nextChapter();
    expect(bookStore.currentChapter).toBe(lastIndex);
  });
});

describe('prevChapter', () => {
  beforeEach(async () => {
    await bookStore.loadBook(mockFile);
  });

  it('should decrement chapter when not at first', () => {
    bookStore.setChapter(2);
    bookStore.prevChapter();
    expect(bookStore.currentChapter).toBe(1);
  });

  it('should not decrement below 0', () => {
    bookStore.setChapter(0);
    bookStore.prevChapter();
    expect(bookStore.currentChapter).toBe(0);
  });

  it('should not change chapter when already at first', () => {
    bookStore.setChapter(0);
    bookStore.prevChapter();
    expect(bookStore.currentChapter).toBe(0);
  });
});
```

### 6. Test updateProgress Function
```typescript
describe('updateProgress', () => {
  beforeEach(async () => {
    await bookStore.loadBook(mockFile);
  });

  it('should update readingProgress map', async () => {
    const bookId = bookStore.metadata!.id;
    const progress = {
      bookId,
      cfi: '',
      scrollPosition: 500,
      chapterIndex: 2,
      percentage: 25,
      timestamp: new Date(),
    };
    
    await bookStore.updateProgress(progress);
    
    expect(bookStore.readingProgress.has(bookId)).toBe(true);
  });

  it('should update currentBook metadata', async () => {
    const bookId = bookStore.metadata!.id;
    const progress = {
      bookId,
      cfi: '',
      scrollPosition: 500,
      chapterIndex: 2,
      percentage: 25,
      timestamp: new Date(),
    };
    
    await bookStore.updateProgress(progress);
    
    expect(bookStore.metadata?.progress).toBe(25);
    expect(bookStore.metadata?.currentChapter).toBe(2);
  });

  it('should update lastReadAt in metadata', async () => {
    const bookId = bookStore.metadata!.id;
    const before = bookStore.metadata!.lastReadAt;
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const progress = {
      bookId,
      cfi: '',
      scrollPosition: 500,
      chapterIndex: 2,
      percentage: 25,
      timestamp: new Date(),
    };
    
    await bookStore.updateProgress(progress);
    
    expect(bookStore.metadata!.lastReadAt.getTime()).toBeGreaterThan(before.getTime());
  });

  it('should call libraryStore.updateReadingProgress', async () => {
    const bookId = bookStore.metadata!.id;
    const updateSpy = vi.spyOn(libraryStore, 'updateReadingProgress');
    const progress = {
      bookId,
      cfi: '',
      scrollPosition: 500,
      chapterIndex: 2,
      percentage: 25,
      timestamp: new Date(),
    };
    
    await bookStore.updateProgress(progress);
    
    expect(updateSpy).toHaveBeenCalledWith(bookId, 2, 500, 25);
  });

  it('should not update when no currentBook', async () => {
    bookStore.clearBook();
    const progress = {
      bookId: 'nonexistent',
      cfi: '',
      scrollPosition: 500,
      chapterIndex: 2,
      percentage: 25,
      timestamp: new Date(),
    };
    
    await bookStore.updateProgress(progress);
    
    expect(bookStore.currentBook).toBeNull();
  });
});
```

### 7. Test Other Functions
```typescript
describe('clearBook', () => {
  beforeEach(async () => {
    await bookStore.loadBook(mockFile);
    bookStore.currentScrollPosition = 500;
  });

  it('should set currentBook to null', () => {
    bookStore.clearBook();
    expect(bookStore.currentBook).toBeNull();
  });

  it('should reset currentChapter to 0', () => {
    bookStore.clearBook();
    expect(bookStore.currentChapter).toBe(0);
  });

  it('should reset error to null', () => {
    bookStore.error = new Error('test');
    bookStore.clearBook();
    expect(bookStore.error).toBeNull();
  });
});

describe('setSearchHighlight', () => {
  it('should set searchHighlight', () => {
    bookStore.setSearchHighlight({
      chapterIndex: 2,
      searchText: 'test',
      matchIndex: 0,
    });
    
    expect(bookStore.searchHighlight).not.toBeNull();
    expect(bookStore.searchHighlight?.chapterIndex).toBe(2);
    expect(bookStore.searchHighlight?.searchText).toBe('test');
  });

  it('should clear searchHighlight when passing null', () => {
    bookStore.setSearchHighlight({
      chapterIndex: 2,
      searchText: 'test',
      matchIndex: 0,
    });
    
    bookStore.setSearchHighlight(null);
    
    expect(bookStore.searchHighlight).toBeNull();
  });
});

describe('addChapter', () => {
  it('should add chapter to currentBook', async () => {
    await bookStore.loadBook(mockFile);
    const initialCount = bookStore.chapters.length;
    
    bookStore.addChapter({
      id: 'new-chapter',
      href: 'new.xhtml',
      title: 'New Chapter',
      level: 0,
      content: '<p>New content</p>',
    });
    
    expect(bookStore.chapters.length).toBe(initialCount + 1);
    expect(bookStore.chapters[bookStore.chapters.length - 1].title).toBe('New Chapter');
  });

  it('should not add chapter when no currentBook', () => {
    bookStore.addChapter({
      id: 'new-chapter',
      href: 'new.xhtml',
      title: 'New Chapter',
      level: 0,
      content: '<p>New content</p>',
    });
    
    expect(bookStore.chapters).toEqual([]);
  });
});
```

## Expected Outcomes
- Full test coverage for book store
- Chapter navigation validated
- Progress tracking verified
- Error handling tested
- Library store integration confirmed
- Coverage > 85% for book.ts

## Dependencies
- Must complete "Missing Test Framework and Testing Infrastructure" issue first
- Needs useEpub mock
- Needs LibraryStore mock
