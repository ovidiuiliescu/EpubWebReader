# Missing Tests for Edge Cases and Boundary Conditions

**Severity:** Medium  
**Issue Type:** Missing Edge Case Tests

## Affected Files
- All source files lack edge case testing

## Description
The codebase has numerous edge cases and boundary conditions that are untested. Edge cases are inputs at the limits of valid ranges, unexpected inputs, or unusual usage patterns that can cause bugs, crashes, or undefined behavior.

**Untested Edge Cases:**

### useEpub Composable
1. **Empty or zero-byte EPUB files**
2. **Extremely large EPUB files** (> 100MB)
3. **Chapters with no title**
4. **Chapters with very long titles** (> 1000 chars)
5. **TOC with hundreds of chapters**
6. **Nested TOC with deep hierarchy** (> 10 levels)
7. **Chapters with thousands of images**
8. **Images with very large file sizes**
9. **Images with invalid or corrupted data**
10. **Chapters with no text content** (only images)
11. **Chapters with mixed languages** and Unicode
12. **EPUB with no cover image**
13. **EPUB with multiple cover images**
14. **Chapters with circular links**
15. **Very long chapter content** (> 1MB HTML)
16. **Chapters with inline scripts** (XSS risk)
17. **Chapters with malformed HTML**
18. **EPUB with missing required files** (OPF, NCX)
19. **EPUB with unusual directory structures**
20. **Book titles with special characters** (<, >, &, quotes)
21. **Authors with international names**
22. **EPUB with multiple spine items**

### useSearch Composable
1. **Empty search query** (covered but verify)
2. **Search queries with only whitespace**
3. **Very long search queries** (> 1000 chars)
4. **Search with special regex characters**
5. **Search with Unicode characters** (emoji, CJK, RTL)
6. **Search in books with thousands of chapters**
7. **Search with results in every chapter**
8. **Search queries that match HTML tags**
9. **Case-insensitive search with Turkish locale** (İ/i issue)
10. **Search with duplicate consecutive words**
11. **Search with zero-width characters**
12. **Search with control characters**
13. **Search in chapters with no body text** (only scripts/styles)

### BookViewer Component
1. **Scroll at very top of document** (scrollTop = 0)
2. **Scroll at very bottom of document**
3. **Very large scroll positions** (scrollTop > 10 million)
4. **Rapid scrolling events** (thousands per second)
5. **Chapter with no content** (empty string)
6. **Chapter with only whitespace**
7. **Chapter with very long words** (no line breaks)
8. **Internal links to nonexistent chapters**
9. **Internal links with invalid anchors**
10. **Internal links with fragments but no chapter**
11. **Settings changes while scrolling**
12. **Chapter changes while user is scrolling**
13. **Theme changes while rendering**
14. **Search highlight with zero matches**
15. **Search highlight with thousands of matches**
16. **Font size at minimum** (12px)
17. **Font size at maximum** (32px)
18. **Line height with decimal values**
19. **Padding with negative values** (should reject)
20. **Multiple rapid chapter navigations**

### bookStore
1. **Loading book with no chapters**
2. **Loading book with corrupted metadata**
3. **Loading book with no title**
4. **Loading book while another is loading**
5. **Setting chapter index at array boundaries** (-1, chapters.length)
6. **Update progress with NaN values**
7. **Update progress with negative percentages**
8. **Update progress with percentages > 100**
9. **Clearing search highlight with undefined**
10. **Adding chapter when no book loaded**

### libraryStore
1. **Storing books with duplicate IDs**
2. **Caching more than MAX_CACHED_BOOKS**
3. **Storing very large EPUB files** (> 500MB)
4. **Storing very large cover images** (> 10MB)
5. **Removing book that doesn't exist**
6. **Exporting book with no blob**
7. **Clearing library when already empty**
8. **Updating progress for non-existent book**
9. **Books with very long metadata** (> 10KB)
10. **Books with special characters in ID**
11. **Concurrent add/remove operations**
12. **Database at storage quota limit**

### SettingsStore
1. **Font size below minimum** (should clamp to 12)
2. **Font size above maximum** (should clamp to 32)
3. **Negative font size**
4. **Font size with decimal values**
5. **Line height of 0**
6. **Line height with negative values**
7. **Padding with very large values**
8. **Theme with invalid value**
9. **Setting theme to non-existent option**
10. **Font family with invalid option**
11. **LocalStorage full or disabled**
12. **LocalStorage corrupted data**
13. **Concurrent settings changes**

### Components
1. **BookViewer with no ref elements**
2. **Controls component with no chapters loaded**
3. **ChapterList with empty TOC**
4. **SearchPanel with very long results list**
5. **DropZone with multiple files dropped**
6. **HomeScreen with no books in library**
7. **LibraryPanel with thousands of books**
8. **App component with all panels toggled rapidly**
9. **Component with missing required props**
10. **Component with invalid prop types**
11. **Component mounting after unmount**
12. **Component with async setup errors**

## Why This Needs Testing
- **Production bugs**: Edge cases often cause unexpected bugs
- **User data loss**: Boundary conditions can corrupt data
- **Performance issues**: Large inputs can cause performance degradation
- **Security vulnerabilities**: Malformed inputs can lead to XSS
- **Crash risks**: Unhandled edge cases cause app crashes
- **UX problems**: Unexpected inputs cause confusing behavior
- **Compatibility**: Different EPUB creators have different structures
- **Browser quirks**: Edge cases expose browser differences
- **Regression prevention**: Tests prevent edge case regressions

## Implementation Plan

### 1. Create Edge Cases Test File
`src/edge-cases.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { epub } from '@/composables/useEpub';
import { useSearch } from '@/composables/useSearch';
import { useBookStore } from '@/stores/book';
import { useLibraryStore } from '@/stores/library';
import { useSettingsStore } from '@/stores/settings';

describe('Edge Cases and Boundary Conditions', () => {
  // Test cases below
});
```

### 2. Test File Size Edge Cases
```typescript
describe('file size edge cases', () => {
  it('should handle empty EPUB file', async () => {
    const emptyFile = new File([''], 'empty.epub', { type: 'application/epub+zip' });
    
    await expect(epub.loadEpub(emptyFile)).rejects.toThrow();
  });

  it('should handle zero-byte file', async () => {
    const zeroFile = new File([new Uint8Array(0)], 'zero.epub', { type: 'application/epub+zip' });
    
    await expect(epub.loadEpub(zeroFile)).rejects.toThrow();
  });

  it('should handle very large EPUB file', async () => {
    const largeContent = new Uint8Array(100 * 1024 * 1024); // 100MB
    const largeFile = new File([largeContent], 'large.epub', { type: 'application/epub+zip' });
    
    // Should not crash, may time out or fail gracefully
    await expect(epub.loadEpub(largeFile)).resolves.toBeDefined();
  }, { timeout: 30000 });

  it('should handle EPUB at storage limit', async () => {
    // Create file near browser storage limit
    const nearLimitContent = new Uint8Array(5 * 1024 * 1024); // 5MB
    const file = new File([nearLimitContent], 'test.epub', { type: 'application/epub+zip' });
    
    // Should handle storage quota exceeded
    const result = await libraryStore.cacheBook(mockMetadata, file);
    expect(result).not.toThrow();
  });
});
```

### 3. Test Content Edge Cases
```typescript
describe('content edge cases', () => {
  it('should handle chapters with no title', async () => {
    const result = await epub.loadEpub(fileWithNoTitle);
    expect(result.chapters[0].title).toBeTypeOf('string');
  });

  it('should handle very long chapter titles', async () => {
    const longTitle = 'a'.repeat(10000);
    const result = await epub.loadEpub(fileWithLongTitle);
    
    expect(result.chapters[0].title.length).toBe(longTitle.length);
  });

  it('should handle chapters with no text content', async () => {
    const result = await epub.loadEpub(fileWithImagesOnly);
    expect(result.chapters[0].content).toContain('<img');
  });

  it('should handle chapters with very long content', async () => {
    const longContent = '<p>' + 'test '.repeat(100000) + '</p>';
    const result = await epub.loadEpub(fileWithLongContent);
    
    expect(result.chapters[0].content).toBeDefined();
  });

  it('should handle chapters with special HTML entities', async () => {
    const htmlContent = '<p>&lt;script&gt;alert("xss")&lt;/script&gt;</p>';
    const result = await epub.loadEpub(fileWithEntities);
    
    // Should decode entities
    expect(result.chapters[0].content).not.toContain('&lt;');
  });
});
```

### 4. Test Navigation Edge Cases
```typescript
describe('navigation edge cases', () => {
  it('should handle chapter index at -1', () => {
    bookStore.setChapter(-1);
    expect(bookStore.currentChapter).toBeGreaterThanOrEqual(0);
  });

  it('should handle chapter index beyond array length', () => {
    bookStore.setChapter(999999);
    expect(bookStore.currentChapter).toBeLessThan(bookStore.chapters.length);
  });

  it('should handle navigation at first chapter', () => {
    bookStore.currentChapter = 0;
    bookStore.prevChapter();
    expect(bookStore.currentChapter).toBe(0);
  });

  it('should handle navigation at last chapter', () => {
    bookStore.currentChapter = bookStore.chapters.length - 1;
    bookStore.nextChapter();
    expect(bookStore.currentChapter).toBe(bookStore.chapters.length - 1);
  });

  it('should handle circular chapter navigation', () => {
    bookStore.currentChapter = 0;
    for (let i = 0; i < 1000; i++) {
      bookStore.nextChapter();
    }
    expect(bookStore.currentChapter).toBeLessThan(bookStore.chapters.length);
  });
});
```

### 5. Test Search Edge Cases
```typescript
describe('search edge cases', () => {
  it('should handle empty search with whitespace only', async () => {
    const results = await search.searchInBook('   ', chapters);
    expect(results).toEqual([]);
  });

  it('should handle very long search query', async () => {
    const longQuery = 'a'.repeat(10000);
    const results = await search.searchInBook(longQuery, chapters);
    
    expect(search.isSearching.value).toBe(false);
  });

  it('should handle search with special regex characters', async () => {
    const query = '.*+?^${}()|[]\\';
    const results = await search.searchInBook(query, chapters);
    
    // Should not throw regex errors
    expect(results).toBeDefined();
  });

  it('should handle search with Unicode characters', async () => {
    const query = '😀测试العربية';
    const results = await search.searchInBook(query, chapters);
    
    expect(results).toBeDefined();
  });

  it('should handle search with Turkish locale issues', async () => {
    const chapter = { content: '<p>Istanbul is İzmir</p>' };
    const results = await search.searchInBook('izmir', [chapter]);
    
    // Should match both İ and i
    expect(results.length).toBeGreaterThan(0);
  });

  it('should handle search matching HTML tags', async () => {
    const chapter = { content: '<p><div>test</div></p>' };
    const results = await search.searchInBook('div', [chapter]);
    
    // Should only match text content, not tags
    expect(results.length).toBe(0);
  });
});
```

### 6. Test Settings Boundary Cases
```typescript
describe('settings boundary cases', () => {
  it('should clamp font size below minimum', () => {
    settingsStore.setFontSize(-10);
    expect(settingsStore.preferences.fontSize).toBe(12);
  });

  it('should clamp font size above maximum', () => {
    settingsStore.setFontSize(100);
    expect(settingsStore.preferences.fontSize).toBe(32);
  });

  it('should handle font size at minimum boundary', () => {
    settingsStore.setFontSize(12);
    expect(settingsStore.preferences.fontSize).toBe(12);
  });

  it('should handle font size at maximum boundary', () => {
    settingsStore.setFontSize(32);
    expect(settingsStore.preferences.fontSize).toBe(32);
  });

  it('should handle line height of 0', () => {
    settingsStore.setLineHeight(0);
    expect(settingsStore.preferences.lineHeight).toBe(0);
  });

  it('should handle negative line height', () => {
    settingsStore.setLineHeight(-1.5);
    expect(settingsStore.preferences.lineHeight).toBe(-1.5);
  });

  it('should handle very large padding values', () => {
    settingsStore.setPadding(10000);
    expect(settingsStore.preferences.padding).toBe(10000);
  });
});
```

### 7. Test Scroll Boundary Cases
```typescript
describe('scroll boundary cases', () => {
  it('should handle scroll at position 0', async () => {
    container.element.scrollTop = 0;
    await container.trigger('scroll');
    await vi.advanceTimersByTimeAsync(500);
    
    expect(bookStore.updateProgress).toHaveBeenCalled();
  });

  it('should handle scroll at maximum position', async () => {
    container.element.scrollTop = container.element.scrollHeight - container.element.clientHeight;
    await container.trigger('scroll');
    await vi.advanceTimersByTimeAsync(500);
    
    expect(bookStore.updateProgress).toHaveBeenCalled();
  });

  it('should handle very large scroll positions', async () => {
    container.element.scrollTop = 100000000;
    await container.trigger('scroll');
    await vi.advanceTimersByTimeAsync(500);
    
    // Should not crash or produce invalid percentage
    expect(bookStore.updateProgress).toHaveBeenCalled();
  });

  it('should handle rapid scroll events', async () => {
    for (let i = 0; i < 1000; i++) {
      container.element.scrollTop = i;
      await container.trigger('scroll');
    }
    
    await vi.advanceTimersByTimeAsync(500);
    
    // Should debounce and only call once
    expect(bookStore.updateProgress).toHaveBeenCalledTimes(1);
  });
});
```

### 8. Test Library Boundary Cases
```typescript
describe('library boundary cases', () => {
  it('should handle caching beyond MAX_CACHED_BOOKS', async () => {
    const maxBooks = 10;
    
    for (let i = 0; i < 20; i++) {
      await libraryStore.cacheBook(
        { id: `book-${i}`, title: `Book ${i}`, author: 'Test', addedAt: new Date(), lastReadAt: new Date(), progress: 0, currentChapter: 0 },
        new Blob([`content ${i}`])
      );
    }
    
    expect(libraryStore.books.length).toBeLessThanOrEqual(maxBooks);
  });

  it('should handle removing non-existent book', async () => {
    await libraryStore.removeBook('nonexistent-id');
    // Should not throw
  });

  it('should handle clearing empty library', async () => {
    await libraryStore.clearLibrary();
    await libraryStore.clearLibrary();
    // Should not throw
  });

  it('should handle concurrent cache operations', async () => {
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        libraryStore.cacheBook(
          { id: `book-${i}`, title: `Book ${i}`, author: 'Test', addedAt: new Date(), lastReadAt: new Date(), progress: 0, currentChapter: 0 },
          new Blob([`content ${i}`])
        )
      );
    }
    
    await Promise.all(promises);
    expect(libraryStore.books.length).toBeLessThanOrEqual(10);
  });
});
```

### 9. Test Progress Boundary Cases
```typescript
describe('progress boundary cases', () => {
  it('should handle progress percentage of 0', async () => {
    await bookStore.updateProgress({
      bookId: 'test',
      cfi: '',
      scrollPosition: 0,
      chapterIndex: 0,
      percentage: 0,
      timestamp: new Date(),
    });
    
    expect(bookStore.metadata?.progress).toBe(0);
  });

  it('should handle progress percentage of 100', async () => {
    await bookStore.updateProgress({
      bookId: 'test',
      cfi: '',
      scrollPosition: 1000,
      chapterIndex: 5,
      percentage: 100,
      timestamp: new Date(),
    });
    
    expect(bookStore.metadata?.progress).toBe(100);
  });

  it('should handle negative scroll position', async () => {
    await bookStore.updateProgress({
      bookId: 'test',
      cfi: '',
      scrollPosition: -100,
      chapterIndex: 0,
      percentage: 0,
      timestamp: new Date(),
    });
    
    // Should accept negative value
    expect(bookStore.updateProgress).toHaveBeenCalled();
  });

  it('should handle NaN percentage', async () => {
    await bookStore.updateProgress({
      bookId: 'test',
      cfi: '',
      scrollPosition: 100,
      chapterIndex: 0,
      percentage: NaN,
      timestamp: new Date(),
    });
    
    // Should handle NaN without crashing
    expect(bookStore.updateProgress).toHaveBeenCalled();
  });
});
```

### 10. Test Component Lifecycle Edge Cases
```typescript
describe('component lifecycle edge cases', () => {
  it('should handle component unmounting during async operation', async () => {
    const wrapper = mount(BookViewer);
    await loadMockBook();
    
    // Trigger async operation
    const operation = bookStore.loadBook(mockFile);
    
    // Unmount before operation completes
    wrapper.unmount();
    
    await operation;
    // Should not crash
  });

  it('should handle component mounting with missing dependencies', () => {
    // Don't initialize stores
    const wrapper = mount(App);
    
    // Should not crash, may show loading/error state
    expect(wrapper.exists()).toBe(true);
  });

  it('should handle rapid component mount/unmount', async () => {
    for (let i = 0; i < 10; i++) {
      const wrapper = mount(BookViewer);
      await nextTick();
      wrapper.unmount();
    }
    // Should not leak memory
  });
});
```

## Expected Outcomes
- Comprehensive edge case coverage
- Boundary conditions validated
- Input sanitization verified
- Resource exhaustion prevented
- Graceful degradation confirmed

## Dependencies
- Must complete "Missing Test Framework and Testing Infrastructure" issue first
- Needs all other test implementations as foundation
