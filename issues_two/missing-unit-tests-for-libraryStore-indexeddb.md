# Missing Unit Tests for LibraryStore (IndexedDB Operations)

**Severity:** High  
**Issue Type:** Missing Unit Tests

## Affected Files
- `src/stores/library.ts` (lines 1-175) - Entire file untested

## Description
The `libraryStore` (Pinia store) manages all IndexedDB operations including storing books, metadata, cover images, reading progress, and library management. This is critical persistence layer with zero test coverage. IndexedDB operations are async and can fail silently without proper testing.

**Untested Functions:**
- `init()` - Database initialization (lines 29-43)
- `loadBooks()` - Load books from database (lines 45-52)
- `cacheBook()` - Store book and metadata (lines 54-80)
- `updateReadingProgress()` - Update progress (lines 82-107)
- `getReadingProgress()` - Retrieve progress (lines 109-118)
- `removeBook()` - Delete book (lines 120-124)
- `getBookBlob()` - Get EPUB blob (lines 126-130)
- `getCoverImage()` - Get cover blob (lines 132-136)
- `exportBook()` - Export book (lines 138-140)
- `checkCacheLimit()` - Manage cache size (lines 142-153)
- `clearLibrary()` - Clear all books (lines 155-159)

## Why This Needs Testing
- **Data persistence**: User's entire library depends on this store
- **IndexedDB complexity**: Async operations, schema changes, transaction failures
- **Cache management**: MAX_CACHED_BOOKS limit enforcement (line 8)
- **Blob storage**: Large binary data (EPUB files, images) must be handled correctly
- **Progress tracking**: Reading progress must persist across sessions
- **Error handling**: Multiple async operations with no error handling
- **Schema versioning**: DB_VERSION is 2, migrations not tested (line 7)
- **Concurrency**: Multiple books being added/removed simultaneously
- **Data loss risk**: Bugs could corrupt or lose user's library

## Implementation Plan

### 1. Create Test File
`src/stores/library.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLibraryStore } from './library';
import { openDB, type IDBPDatabase } from 'idb';

describe('useLibraryStore', () => {
  let libraryStore: ReturnType<typeof useLibraryStore>;
  let db: IDBPDatabase<{ books: any }> | null;

  beforeEach(async () => {
    setActivePinia(createPinia());
    libraryStore = useLibraryStore();
    // Mock openDB to use in-memory database
    db = await openDB('test-epub-reader', 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('books')) {
          const store = database.createObjectStore('books', { keyPath: 'id' });
          store.createIndex('addedAt', 'addedAt');
        }
      },
    });
    vi.mocked(openDB).mockResolvedValue(db);
  });

  afterEach(async () => {
    await db?.close();
    await indexedDB.deleteDatabase('test-epub-reader');
  });
});
```

### 2. Test init Function
```typescript
describe('init', () => {
  it('should initialize IndexedDB database', async () => {
    await libraryStore.init();
    
    expect(libraryStore.isInitialized).toBe(true);
    expect(libraryStore.db).toBeDefined();
  });

  it('should not initialize twice', async () => {
    await libraryStore.init();
    const db1 = libraryStore.db;
    
    await libraryStore.init();
    
    expect(libraryStore.db).toBe(db1);
  });

  it('should create books object store on first init', async () => {
    await libraryStore.init();
    
    const db = libraryStore.db!;
    expect(db.objectStoreNames.contains('books')).toBe(true);
  });

  it('should load books after database initialization', async () => {
    // Add a test book directly to DB
    await db!.add('books', {
      id: 'test-1',
      metadata: { id: 'test-1', title: 'Test Book', author: 'Test', addedAt: new Date(), lastReadAt: new Date(), progress: 0, currentChapter: 0 },
      epubBlob: new Blob(['test']),
      addedAt: new Date(),
    });
    
    await libraryStore.init();
    
    expect(libraryStore.books.length).toBe(1);
    expect(libraryStore.books[0].title).toBe('Test Book');
  });

  it('should handle database upgrade', async () => {
    // Test migration scenario
    await libraryStore.init();
    expect(libraryStore.isInitialized).toBe(true);
  });
});
```

### 3. Test cacheBook Function
```typescript
describe('cacheBook', () => {
  beforeEach(async () => {
    await libraryStore.init();
  });

  it('should cache new book with metadata and blob', async () => {
    const metadata = {
      id: 'test-1',
      title: 'Test Book',
      author: 'Test Author',
      addedAt: new Date(),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    };
    const epubBlob = new Blob(['epub content'], { type: 'application/epub+zip' });
    
    await libraryStore.cacheBook(metadata, epubBlob);
    
    expect(libraryStore.books.length).toBe(1);
    expect(libraryStore.books[0].id).toBe('test-1');
  });

  it('should update existing book instead of duplicating', async () => {
    const metadata = {
      id: 'test-1',
      title: 'Original Title',
      author: 'Test Author',
      addedAt: new Date(),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    };
    const epubBlob = new Blob(['epub content'], { type: 'application/epub+zip' });
    
    await libraryStore.cacheBook(metadata, epubBlob);
    
    const updatedMetadata = {
      ...metadata,
      title: 'Updated Title',
      progress: 50,
    };
    await libraryStore.cacheBook(updatedMetadata, epubBlob);
    
    expect(libraryStore.books.length).toBe(1);
    expect(libraryStore.books[0].title).toBe('Updated Title');
    expect(libraryStore.books[0].progress).toBe(50);
  });

  it('should store cover image when provided', async () => {
    const metadata = {
      id: 'test-1',
      title: 'Test Book',
      author: 'Test Author',
      addedAt: new Date(),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    };
    const epubBlob = new Blob(['epub content'], { type: 'application/epub+zip' });
    const coverImage = new Blob(['cover data'], { type: 'image/jpeg' });
    
    await libraryStore.cacheBook(metadata, epubBlob, coverImage);
    
    const retrievedCover = await libraryStore.getCoverImage('test-1');
    expect(retrievedCover).not.toBeNull();
  });

  it('should enforce MAX_CACHED_BOOKS limit', async () => {
    const maxBooks = 10;
    
    for (let i = 0; i < maxBooks + 5; i++) {
      await libraryStore.cacheBook({
        id: `book-${i}`,
        title: `Book ${i}`,
        author: 'Test',
        addedAt: new Date(),
        lastReadAt: new Date(),
        progress: 0,
        currentChapter: 0,
      }, new Blob([`content ${i}`]));
    }
    
    expect(libraryStore.books.length).toBeLessThanOrEqual(maxBooks);
  });

  it('should remove oldest book when cache limit reached', async () => {
    // Add 10 books
    for (let i = 0; i < 10; i++) {
      await libraryStore.cacheBook({
        id: `book-${i}`,
        title: `Book ${i}`,
        author: 'Test',
        addedAt: new Date(Date.now() + i * 1000), // Different timestamps
        lastReadAt: new Date(),
        progress: 0,
        currentChapter: 0,
      }, new Blob([`content ${i}`]));
    }
    
    // Add 11th book
    await libraryStore.cacheBook({
      id: 'book-10',
      title: 'Book 10',
      author: 'Test',
      addedAt: new Date(),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    }, new Blob(['content 10']));
    
    expect(libraryStore.books.length).toBe(10);
    // First book should be removed
    const firstBookExists = libraryStore.books.find(b => b.id === 'book-0');
    expect(firstBookExists).toBeUndefined();
  });

  it('should not cache when database is not initialized', async () => {
    libraryStore.db = null; // Simulate uninitialized state
    
    await libraryStore.cacheBook({
      id: 'test-1',
      title: 'Test',
      author: 'Test',
      addedAt: new Date(),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    }, new Blob(['test']));
    
    // Should not throw, just do nothing
    expect(libraryStore.books.length).toBe(0);
  });
});
```

### 4. Test Reading Progress Functions
```typescript
describe('updateReadingProgress', () => {
  beforeEach(async () => {
    await libraryStore.init();
    await libraryStore.cacheBook({
      id: 'test-1',
      title: 'Test Book',
      author: 'Test',
      addedAt: new Date(),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    }, new Blob(['test']));
  });

  it('should update reading progress for existing book', async () => {
    await libraryStore.updateReadingProgress('test-1', 5, 1000, 50);
    
    const progress = await libraryStore.getReadingProgress('test-1');
    expect(progress).toEqual({
      chapterIndex: 5,
      scrollPosition: 1000,
      percentage: 50,
    });
  });

  it('should update book metadata with progress', async () => {
    await libraryStore.updateReadingProgress('test-1', 5, 1000, 50);
    
    const book = libraryStore.books.find(b => b.id === 'test-1');
    expect(book?.progress).toBe(50);
    expect(book?.currentChapter).toBe(5);
  });

  it('should update lastReadAt timestamp', async () => {
    const before = libraryStore.books.find(b => b.id === 'test-1')!.lastReadAt;
    
    await new Promise(resolve => setTimeout(resolve, 10));
    await libraryStore.updateReadingProgress('test-1', 5, 1000, 50);
    
    const after = libraryStore.books.find(b => b.id === 'test-1')!.lastReadAt;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });

  it('should not update progress for non-existent book', async () => {
    await libraryStore.updateReadingProgress('nonexistent', 5, 1000, 50);
    
    const progress = await libraryStore.getReadingProgress('nonexistent');
    expect(progress).toBeNull();
  });

  it('should not update when database is not initialized', async () => {
    libraryStore.db = null;
    
    await libraryStore.updateReadingProgress('test-1', 5, 1000, 50);
    
    // Should not throw
  });
});

describe('getReadingProgress', () => {
  beforeEach(async () => {
    await libraryStore.init();
    await libraryStore.cacheBook({
      id: 'test-1',
      title: 'Test Book',
      author: 'Test',
      addedAt: new Date(),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    }, new Blob(['test']));
  });

  it('should return null for non-existent book', async () => {
    const progress = await libraryStore.getReadingProgress('nonexistent');
    expect(progress).toBeNull();
  });

  it('should return null for book with no progress', async () => {
    const progress = await libraryStore.getReadingProgress('test-1');
    expect(progress).toBeNull();
  });

  it('should return reading progress when it exists', async () => {
    await libraryStore.updateReadingProgress('test-1', 5, 1000, 50);
    
    const progress = await libraryStore.getReadingProgress('test-1');
    expect(progress).toEqual({
      chapterIndex: 5,
      scrollPosition: 1000,
      percentage: 50,
    });
  });
});
```

### 5. Test removeBook Function
```typescript
describe('removeBook', () => {
  beforeEach(async () => {
    await libraryStore.init();
    await libraryStore.cacheBook({
      id: 'test-1',
      title: 'Test Book',
      author: 'Test',
      addedAt: new Date(),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    }, new Blob(['test']));
  });

  it('should remove book from library', async () => {
    expect(libraryStore.books.length).toBe(1);
    
    await libraryStore.removeBook('test-1');
    
    expect(libraryStore.books.length).toBe(0);
  });

  it('should remove book from database', async () => {
    await libraryStore.removeBook('test-1');
    
    const blob = await libraryStore.getBookBlob('test-1');
    expect(blob).toBeNull();
  });

  it('should not throw when removing non-existent book', async () => {
    await libraryStore.removeBook('nonexistent');
    // Should not throw
  });
});
```

### 6. Test getBookBlob Function
```typescript
describe('getBookBlob', () => {
  beforeEach(async () => {
    await libraryStore.init();
    await libraryStore.cacheBook({
      id: 'test-1',
      title: 'Test Book',
      author: 'Test',
      addedAt: new Date(),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    }, new Blob(['test epub content'], { type: 'application/epub+zip' }));
  });

  it('should return blob for existing book', async () => {
    const blob = await libraryStore.getBookBlob('test-1');
    expect(blob).not.toBeNull();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob!.type).toBe('application/epub+zip');
  });

  it('should return null for non-existent book', async () => {
    const blob = await libraryStore.getBookBlob('nonexistent');
    expect(blob).toBeNull();
  });

  it('should return blob with correct content', async () => {
    const blob = await libraryStore.getBookBlob('test-1');
    const text = await blob!.text();
    expect(text).toBe('test epub content');
  });
});
```

### 7. Test getCoverImage Function
```typescript
describe('getCoverImage', () => {
  beforeEach(async () => {
    await libraryStore.init();
  });

  it('should return null when no cover image', async () => {
    await libraryStore.cacheBook({
      id: 'test-1',
      title: 'Test Book',
      author: 'Test',
      addedAt: new Date(),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    }, new Blob(['test']));

    const cover = await libraryStore.getCoverImage('test-1');
    expect(cover).toBeNull();
  });

  it('should return cover image when it exists', async () => {
    const coverBlob = new Blob(['cover data'], { type: 'image/jpeg' });
    await libraryStore.cacheBook({
      id: 'test-1',
      title: 'Test Book',
      author: 'Test',
      addedAt: new Date(),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    }, new Blob(['test']), coverBlob);

    const cover = await libraryStore.getCoverImage('test-1');
    expect(cover).not.toBeNull();
    expect(cover).toBeInstanceOf(Blob);
    expect(cover!.type).toBe('image/jpeg');
  });
});
```

### 8. Test exportBook Function
```typescript
describe('exportBook', () => {
  beforeEach(async () => {
    await libraryStore.init();
    await libraryStore.cacheBook({
      id: 'test-1',
      title: 'Test Book',
      author: 'Test',
      addedAt: new Date(),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    }, new Blob(['test epub']));
  });

  it('should return book blob for export', async () => {
    const blob = await libraryStore.exportBook('test-1');
    expect(blob).not.toBeNull();
    expect(blob!.type).toBe('application/epub+zip');
  });

  it('should return null for non-existent book', async () => {
    const blob = await libraryStore.exportBook('nonexistent');
    expect(blob).toBeNull();
  });
});
```

### 9. Test clearLibrary Function
```typescript
describe('clearLibrary', () => {
  beforeEach(async () => {
    await libraryStore.init();
    await libraryStore.cacheBook({
      id: 'test-1',
      title: 'Book 1',
      author: 'Test',
      addedAt: new Date(),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    }, new Blob(['test 1']));
    await libraryStore.cacheBook({
      id: 'test-2',
      title: 'Book 2',
      author: 'Test',
      addedAt: new Date(),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    }, new Blob(['test 2']));
  });

  it('should clear all books from library', async () => {
    expect(libraryStore.books.length).toBe(2);
    
    await libraryStore.clearLibrary();
    
    expect(libraryStore.books.length).toBe(0);
  });

  it('should clear database', async () => {
    await libraryStore.clearLibrary();
    
    const blob = await libraryStore.getBookBlob('test-1');
    expect(blob).toBeNull();
  });

  it('should not throw when library is empty', async () => {
    await libraryStore.clearLibrary();
    await libraryStore.clearLibrary();
    // Should not throw
  });
});
```

### 10. Test loadBooks Function
```typescript
describe('loadBooks', () => {
  beforeEach(async () => {
    await libraryStore.init();
  });

  it('should sort books by addedAt descending', async () => {
    await libraryStore.cacheBook({
      id: 'book-1',
      title: 'Book 1',
      author: 'Test',
      addedAt: new Date('2024-01-01'),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    }, new Blob(['test 1']));
    
    await libraryStore.cacheBook({
      id: 'book-2',
      title: 'Book 2',
      author: 'Test',
      addedAt: new Date('2024-01-02'),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    }, new Blob(['test 2']));
    
    expect(libraryStore.books[0].id).toBe('book-2');
    expect(libraryStore.books[1].id).toBe('book-1');
  });

  it('should load only metadata from database', async () => {
    await libraryStore.cacheBook({
      id: 'test-1',
      title: 'Test Book',
      author: 'Test',
      addedAt: new Date(),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    }, new Blob(['epub']));
    
    const book = libraryStore.books[0];
    expect(book.id).toBeDefined();
    expect(book.title).toBeDefined();
    expect(book.author).toBeDefined();
  });
});
```

### 11. Test Edge Cases
```typescript
describe('edge cases', () => {
  it('should handle concurrent cache operations', async () => {
    await libraryStore.init();
    
    const promises = Array(20).fill(null).map((_, i) =>
      libraryStore.cacheBook({
        id: `book-${i}`,
        title: `Book ${i}`,
        author: 'Test',
        addedAt: new Date(),
        lastReadAt: new Date(),
        progress: 0,
        currentChapter: 0,
      }, new Blob([`content ${i}`]))
    );
    
    await Promise.all(promises);
    
    expect(libraryStore.books.length).toBeLessThanOrEqual(10);
  });

  it('should handle very large book blobs', async () => {
    await libraryStore.init();
    const largeBlob = new Blob([new Array(10 * 1024 * 1024).fill('a').join('')]); // 10MB
    
    await libraryStore.cacheBook({
      id: 'large-book',
      title: 'Large Book',
      author: 'Test',
      addedAt: new Date(),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    }, largeBlob);
    
    const retrieved = await libraryStore.getBookBlob('large-book');
    expect(retrieved!.size).toBeGreaterThan(10 * 1024 * 1024 - 1000);
  });

  it('should handle special characters in book metadata', async () => {
    await libraryStore.init();
    
    await libraryStore.cacheBook({
      id: 'test-1',
      title: 'Test <script>alert("xss")</script> Book',
      author: 'Test & Author',
      addedAt: new Date(),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    }, new Blob(['test']));
    
    expect(libraryStore.books[0].title).toContain('<script>');
  });
});
```

## Expected Outcomes
- Full test coverage for IndexedDB operations
- Cache management validated
- Progress tracking verified
- Data persistence confirmed
- Edge cases handled
- Coverage > 85% for library.ts

## Dependencies
- Must complete "Missing Test Framework and Testing Infrastructure" issue first
- Needs fake-indexeddb or similar library for testing
