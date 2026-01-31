# Missing Tests for Error Handling Paths

**Severity:** Medium  
**Issue Type:** Missing Error Handling Tests

## Affected Files
- `src/composables/useEpub.ts` - Multiple try-catch blocks (lines 122, 171, 212, 307, 391, 397, 405, 447)
- `src/composables/useSearch.ts` - Empty catch blocks (none - but silent failures possible)
- `src/stores/book.ts` - Error state (lines 58-60)
- `src/stores/library.ts` - No error handling on async operations
- `src/components/BookViewer.vue` - Silent failures in content rendering
- `src/App.vue` - Console.error on failure (lines 21-23)

## Description
The codebase has numerous error handling paths that are untested. Many errors are logged to console but never surface to users, potentially leaving the application in broken states without user awareness.

**Untested Error Paths:**

### useEpub.ts
1. JSZip loading failure (lines 20-22)
2. epubjs factory resolution failure (lines 56-61)
3. Base URL determination failure (lines 122-125)
4. Chapter loading failure (lines 170-173)
5. Cover image loading failure (lines 211-214)
6. NCX parsing failure (lines 307-309)
7. Chapter file not found (lines 390-393)
8. Empty chapter content (lines 397-399)
9. Missing body element (lines 405-435)
10. Empty body innerHTML (lines 438-441)
11. Chapter content parsing failure (lines 446-449)
12. Image file not found (lines 532-535)
13. Image loading failure (lines 542-544)

### book.ts
1. Book loading failure (lines 58-60)
2. Error state never cleared on successful load (line 62)
3. No error handling in updateProgress
4. No error handling in setChapter

### library.ts
1. Database init failure (no try-catch)
2. Book caching failure (no try-catch)
3. Reading progress update failure (no try-catch)
4. Book removal failure (no try-catch)
5. Export failure (no try-catch)
6. Clear library failure (no try-catch)
7. Cache limit check failure (no try-catch)

### BookViewer.vue
1. Scroll progress calculation when scrollHeight is 0 (line 44)
2. Link handling when href is null (line 70)
3. Chapter loading when currentBook is null (line 141)
4. Empty chapters array (line 145)
5. Fragment navigation when element not found (lines 115-120)

### App.vue
1. Non-EPUB file upload (lines 24-26)
2. Book loading failure (lines 21-23) - only console.error

## Why This Needs Testing
- **User experience**: Users need to know when something fails
- **Error recovery**: Application must gracefully handle failures
- **Silent failures**: Console errors are invisible to users
- **State corruption**: Errors can leave app in inconsistent state
- **Edge cases**: Unexpected inputs can cause crashes
- **Data loss**: Errors during save operations could lose progress
- **UX feedback**: No user-friendly error messages shown

## Implementation Plan

### 1. Test useEpub Error Paths
`src/composables/useEpub.error.test.ts`:
```typescript
describe('useEpub error handling', () => {
  it('should handle JSZip loading failure', async () => {
    // Mock JSZip to throw error
    await expect(epub.loadEpub(mockFile)).rejects.toThrow();
  });

  it('should handle epubjs factory resolution failure', async () => {
    // Mock epubjs to return non-function
    await expect(epub.loadEpub(mockFile)).rejects.toThrow(TypeError);
  });

  it('should handle missing base URL gracefully', async () => {
    // Mock rootfile to throw error
    const result = await epub.loadEpub(mockFile);
    expect(result.chapters.length).toBeGreaterThan(0);
  });

  it('should handle chapter loading failure gracefully', async () => {
    const result = await epub.loadChapterByHref('invalid.xhtml');
    expect(result).toBeNull();
  });

  it('should return null when cover fails to load', async () => {
    // Mock coverUrl to reject
    const result = await epub.loadEpub(mockFile);
    expect(result.coverBlob).toBeUndefined();
  });

  it('should handle malformed NCX file', async () => {
    // Mock NCX with invalid XML
    const result = await epub.loadEpub(mockFile);
    expect(result.toc.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle chapter file not found', async () => {
    const result = await epub.loadChapterByHref('nonexistent.xhtml');
    expect(result).toBeNull();
  });

  it('should handle empty chapter content', async () => {
    // Mock chapter with empty body
    const result = await epub.loadEpub(mockFile);
    expect(result.chapters[0].content).toContain('Empty chapter');
  });

  it('should handle missing body element', async () => {
    // Mock chapter without body tag
    const result = await epub.loadEpub(mockFile);
    expect(result.chapters[0].content).toContain('Unable to load chapter');
  });

  it('should handle image file not found', async () => {
    const result = await epub.loadEpub(mockFile);
    // Should still render chapter with missing images
    expect(result.chapters[0].content).toBeDefined();
  });
});
```

### 2. Test bookStore Error Handling
`src/stores/book.error.test.ts`:
```typescript
describe('bookStore error handling', () => {
  it('should set error on load failure', async () => {
    // Mock loadEpub to throw
    await expect(bookStore.loadBook(invalidFile)).rejects.toThrow();
    expect(bookStore.error).not.toBeNull();
  });

  it('should clear error on successful load', async () => {
    bookStore.error = new Error('Previous error');
    await bookStore.loadBook(validFile);
    expect(bookStore.error).toBeNull();
  });

  it('should handle updateProgress when no currentBook', async () => {
    bookStore.clearBook();
    await bookStore.updateProgress(mockProgress);
    // Should not throw
    expect(bookStore.currentBook).toBeNull();
  });

  it('should handle setChapter out of bounds', () => {
    bookStore.setChapter(999);
    expect(bookStore.currentChapter).toBeLessThan(bookStore.chapters.length);
  });

  it('should handle setChapter with negative index', () => {
    bookStore.setChapter(-5);
    expect(bookStore.currentChapter).toBeGreaterThanOrEqual(0);
  });
});
```

### 3. Test libraryStore Error Handling
`src/stores/library.error.test.ts`:
```typescript
describe('libraryStore error handling', () => {
  it('should handle database init failure gracefully', async () => {
    // Mock openDB to reject
    await libraryStore.init();
    expect(libraryStore.isInitialized).toBe(false);
  });

  it('should handle book caching failure gracefully', async () => {
    // Mock db.put to reject
    await libraryStore.cacheBook(metadata, blob);
    // Should not throw
  });

  it('should handle progress update failure gracefully', async () => {
    // Mock db.put to reject
    await libraryStore.updateReadingProgress('id', 0, 0, 0);
    // Should not throw
  });

  it('should handle book removal failure gracefully', async () => {
    // Mock db.delete to reject
    await libraryStore.removeBook('id');
    // Should not throw
  });

  it('should handle export failure gracefully', async () => {
    // Mock db.get to reject
    const result = await libraryStore.exportBook('id');
    expect(result).toBeNull();
  });

  it('should handle clear library failure gracefully', async () => {
    // Mock db.clear to reject
    await libraryStore.clearLibrary();
    // Should not throw
  });
});
```

### 4. Test BookViewer Error Handling
`src/components/BookViewer.error.test.vue`:
```typescript
describe('BookViewer error handling', () => {
  it('should handle scroll when scrollHeight is 0', async () => {
    container.element.scrollHeight = 0;
    await container.trigger('scroll');
    await vi.advanceTimersByTimeAsync(500);
    
    // Should not crash or divide by zero
    expect(bookStore.updateProgress).not.toHaveBeenCalled();
  });

  it('should handle link without href', async () => {
    await loadMockBookWithContent('<a>Link text</a>');
    const link = wrapper.find('a');
    await link.trigger('click');
    
    // Should not crash
  });

  it('should handle navigation when no book loaded', async () => {
    bookStore.clearBook();
    const link = wrapper.find('a[href="chapter2.xhtml"]');
    if (link.exists()) {
      await link.trigger('click');
    }
    // Should not crash
  });

  it('should handle fragment navigation to nonexistent element', async () => {
    await loadMockBookWithContent('<h2 id="section1">Section 1</h2>');
    const link = wrapper.find('a[href="#nonexistent"]');
    if (link.exists()) {
      await link.trigger('click');
    }
    // Should not crash
  });

  it('should handle empty chapters array', async () => {
    bookStore.chapters = [];
    await nextTick();
    
    const article = wrapper.find('article');
    expect(article.text()).toContain('No chapter content available');
  });
});
```

### 5. Test App Error Handling
`src/App.test.vue`:
```typescript
describe('App error handling', () => {
  it('should reject non-EPUB files', async () => {
    const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const dropEvent = createDropEvent([mockFile]);
    
    const dropZone = wrapper.findComponent({ name: 'DropZone' });
    await dropZone.vm.$emit('drop', mockFile);
    
    // Should not load book
    expect(bookStore.currentBook).toBeNull();
  });

  it('should show error message on book load failure', async () => {
    const invalidFile = new File(['invalid'], 'test.epub');
    await wrapper.vm.handleFileDrop(invalidFile);
    
    // Wait for error
    await vi.waitFor(() => bookStore.error !== null);
    expect(bookStore.error).not.toBeNull();
  });

  it('should handle multiple concurrent file drops', async () => {
    const file1 = new File(['test1'], 'test1.epub');
    const file2 = new File(['test2'], 'test2.epub');
    
    await Promise.all([
      wrapper.vm.handleFileDrop(file1),
      wrapper.vm.handleFileDrop(file2),
    ]);
    
    // Should handle gracefully
    expect(bookStore.currentBook).not.toBeNull();
  });
});
```

### 6. Test Error Recovery
`src/error-recovery.test.ts`:
```typescript
describe('error recovery scenarios', () => {
  it('should recover from corrupted chapter and continue reading', async () => {
    await loadBookWithCorruptedChapter();
    
    // Navigate to corrupted chapter
    bookStore.setChapter(2);
    await nextTick();
    
    // Should show error but not crash
    const article = wrapper.find('article');
    expect(article.text()).toContain('Unable to load chapter');
  });

  it('should recover from database failure on retry', async () => {
    // Mock db to fail then succeed
    await libraryStore.init();
    expect(libraryStore.isInitialized).toBe(true);
  });

  it('should recover from network error on book load', async () => {
    // Mock then unmock failure
    await bookStore.loadBook(mockFile);
    expect(bookStore.currentBook).not.toBeNull();
  });

  it('should maintain state after error', async () => {
    bookStore.currentChapter = 5;
    bookStore.currentScrollPosition = 1000;
    
    // Cause error
    await bookStore.loadBook(invalidFile);
    
    // Original state should remain or be gracefully reset
    expect(bookStore.currentChapter).toBeGreaterThanOrEqual(0);
  });
});
```

### 7. Test User-Facing Error Messages
```typescript
describe('user-facing error messages', () => {
  it('should show error toast on book load failure', async () => {
    // Mock toast/error component
    await bookStore.loadBook(invalidFile);
    
    // Verify error message displayed to user
    expect(wrapper.text()).toContain('Failed to load book');
  });

  it('should show error message on database failure', async () => {
    // Trigger database error
    
    // Verify user sees helpful message
    expect(wrapper.text()).toMatch(/storage|database/i);
  });

  it('should provide retry option for recoverable errors', async () => {
    // Show error with retry button
    
    const retryButton = wrapper.find('button:contains("Retry")');
    expect(retryButton.exists()).toBe(true);
  });
});
```

## Expected Outcomes
- All error paths tested
- Graceful degradation verified
- User error feedback confirmed
- Recovery scenarios validated
- Coverage > 90% for error handling

## Dependencies
- Must complete "Missing Test Framework and Testing Infrastructure" issue first
- Needs comprehensive mocking of error conditions
