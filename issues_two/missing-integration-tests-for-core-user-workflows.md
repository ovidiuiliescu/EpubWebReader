# Missing Integration Tests for Core User Workflows

**Severity:** High  
**Issue Type:** Missing Integration Tests

## Affected Files
- `src/App.vue` (lines 1-139) - Root component with workflows
- `src/components/BookViewer.vue` - Reading workflow
- `src/components/ChapterList.vue` - Navigation workflow
- `src/components/Controls.vue` - Settings workflow
- `src/components/LibraryPanel.vue` - Library management workflow
- `src/components/HomeScreen.vue` - Book loading workflow
- `src/components/DropZone.vue` - File upload workflow

## Description
The application has several critical user workflows that are completely untested in an integrated manner. Unit tests verify individual components, but integration tests verify that components work together correctly.

**Untested Workflows:**
1. **Load Book Workflow**: User uploads EPUB → Book parses → Library stores → Reader displays
2. **Read Book Workflow**: User navigates chapters → Scroll updates progress → Progress persists
3. **Search Workflow**: User searches → Results display → Click result → Navigate to location
4. **Theme Switching Workflow**: User cycles themes → UI updates throughout → Theme persists
5. **Settings Persistence Workflow**: User changes settings → Settings save → App reloads → Settings restore
6. **Library Management Workflow**: Add books → Display in library → Remove books → Clear library
7. **Bookmark/Progress Workflow**: Read at position → Close book → Reopen → Position restored

## Why This Needs Testing
- **End-to-end verification**: User workflows span multiple components and stores
- **Integration bugs**: Components may work individually but fail when combined
- **State synchronization**: Multiple watchers and computed properties could conflict
- **Async coordination**: Multiple async operations must complete in correct order
- **User regression prevention**: Core workflows are most likely to be affected by changes
- **Data flow verification**: Data must flow correctly from stores to components
- **Event handling**: Component communication via events and stores

## Implementation Plan

### 1. Create Integration Test File
`src/integration/workflows.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import App from '@/App.vue';
import { useBookStore } from '@/stores/book';
import { useLibraryStore } from '@/stores/library';
import { useSettingsStore } from '@/stores/settings';

describe('User Workflows Integration Tests', () => {
  let wrapper: VueWrapper;
  let bookStore: ReturnType<typeof useBookStore>;
  let libraryStore: ReturnType<typeof useLibraryStore>;
  let settingsStore: ReturnType<typeof useSettingsStore>;

  beforeEach(async () => {
    setActivePinia(createPinia());
    bookStore = useBookStore();
    libraryStore = useLibraryStore();
    settingsStore = useSettingsStore();
    
    // Setup mocks
    await libraryStore.init();
    wrapper = mount(App);
  });

  afterEach(() => {
    wrapper?.unmount();
  });
});
```

### 2. Test Load Book Workflow
```typescript
describe('Load Book Workflow', () => {
  it('should complete full book loading workflow', async () => {
    // Simulate file drop
    const mockFile = new File(['test'], 'test.epub', { type: 'application/epub+zip' });
    const dropEvent = new DragEvent('drop', {
      dataTransfer: new DataTransfer(),
    });
    Object.defineProperty(dropEvent.dataTransfer, 'files', {
      value: [mockFile],
      writable: false,
    });
    
    // Trigger drop on HomeScreen
    const dropZone = wrapper.findComponent({ name: 'DropZone' });
    await dropZone.vm.$emit('drop', mockFile);
    
    // Wait for loading
    await vi.waitFor(() => bookStore.isLoading === false, { timeout: 5000 });
    
    // Verify book loaded
    expect(bookStore.currentBook).not.toBeNull();
    expect(bookStore.metadata?.title).toBe('Test Book');
    expect(bookStore.chapters.length).toBeGreaterThan(0);
    
    // Verify book added to library
    expect(libraryStore.books.length).toBeGreaterThan(0);
  });

  it('should display loading state during book load', async () => {
    const mockFile = new File(['test'], 'test.epub', { type: 'application/epub+zip' });
    const dropZone = wrapper.findComponent({ name: 'DropZone' });
    
    // Start loading
    const loadPromise = dropZone.vm.$emit('drop', mockFile);
    
    // Check loading state
    expect(bookStore.isLoading).toBe(true);
    expect(wrapper.find('.animate-spin').exists()).toBe(true);
    expect(wrapper.text()).toContain('Loading book...');
    
    // Wait for completion
    await loadPromise;
    await vi.waitFor(() => bookStore.isLoading === false);
  });

  it('should show error message on failed load', async () => {
    // Mock loadEpub to throw error
    const mockFile = new File(['invalid'], 'test.epub', { type: 'application/epub+zip' });
    
    // Trigger load with invalid file
    const dropZone = wrapper.findComponent({ name: 'DropZone' });
    await dropZone.vm.$emit('drop', mockFile);
    
    // Wait for error
    await vi.waitFor(() => bookStore.error !== null);
    
    expect(bookStore.error).not.toBeNull();
  });
});
```

### 3. Test Read Book Workflow
```typescript
describe('Read Book Workflow', () => {
  beforeEach(async () => {
    await loadMockBook();
  });

  it('should navigate chapters correctly', async () => {
    const initialChapter = bookStore.currentChapter;
    
    // Click next chapter button
    const nextButton = wrapper.find('button[title="Next chapter"]');
    await nextButton.trigger('click');
    
    await nextTick();
    
    expect(bookStore.currentChapter).toBe(initialChapter + 1);
    expect(wrapper.find('article').text()).toContain('Chapter 2');
  });

  it('should update reading progress on scroll', async () => {
    const container = wrapper.find('.overflow-y-auto');
    
    // Mock scroll position
    container.element.scrollTop = 500;
    container.element.scrollHeight = 1000;
    container.element.clientHeight = 500;
    await container.trigger('scroll');
    
    // Wait for debounce
    await vi.advanceTimersByTimeAsync(500);
    
    // Verify progress saved
    const progress = await libraryStore.getReadingProgress(bookStore.metadata!.id);
    expect(progress?.percentage).toBeCloseTo(50, 0);
  });

  it('should restore reading position on book reload', async () => {
    // Set reading position
    bookStore.currentScrollPosition = 1000;
    bookStore.currentChapter = 5;
    await libraryStore.updateReadingProgress(
      bookStore.metadata!.id,
      5,
      1000,
      50
    );
    
    // Reload book
    const mockFile = new File(['test'], 'test.epub', { type: 'application/epub+zip' });
    await bookStore.loadBook(mockFile, true, bookStore.metadata!.id);
    
    await nextTick();
    
    // Verify position restored
    expect(bookStore.currentChapter).toBe(5);
    expect(bookStore.currentScrollPosition).toBe(1000);
  });
});
```

### 4. Test Search Workflow
```typescript
describe('Search Workflow', () => {
  beforeEach(async () => {
    await loadMockBook();
  });

  it('should complete search workflow', async () => {
    // Open search panel
    const searchButton = wrapper.find('button[title="Search"]');
    await searchButton.trigger('click');
    
    await nextTick();
    
    // Enter search query
    const searchInput = wrapper.find('input[placeholder="Search in book..."]');
    await searchInput.setValue('test');
    
    // Wait for search to complete
    await vi.advanceTimersByTimeAsync(500);
    await nextTick();
    
    // Verify results displayed
    expect(wrapper.html()).toContain('results found');
    
    // Click first result
    const firstResult = wrapper.findAll('button').find(b => 
      b.text().includes('test')
    );
    await firstResult.trigger('click');
    
    await nextTick();
    
    // Verify navigation
    expect(bookStore.searchHighlight).not.toBeNull();
    expect(wrapper.html()).toContain('<mark>test</mark>');
  });

  it('should close search panel after navigating to result', async () => {
    // Open search
    const searchButton = wrapper.find('button[title="Search"]');
    await searchButton.trigger('click');
    await nextTick();
    
    expect(wrapper.findComponent({ name: 'SearchPanel' }).exists()).toBe(true);
    
    // Perform search
    const searchInput = wrapper.find('input[placeholder="Search in book..."]');
    await searchInput.setValue('test');
    await vi.advanceTimersByTimeAsync(500);
    await nextTick();
    
    // Click result
    const result = wrapper.findAll('button').find(b => b.text().includes('test'));
    await result.trigger('click');
    await nextTick();
    
    // Panel should be closed
    expect(wrapper.findComponent({ name: 'SearchPanel' }).exists()).toBe(false);
  });
});
```

### 5. Test Theme Switching Workflow
```typescript
describe('Theme Switching Workflow', () => {
  it('should cycle through all themes', async () => {
    const initialTheme = settingsStore.preferences.theme;
    
    // Click theme button 4 times
    const themeButton = wrapper.find('button[title*="Current theme"]');
    
    await themeButton.trigger('click');
    expect(settingsStore.preferences.theme).not.toBe(initialTheme);
    
    await themeButton.trigger('click');
    expect(settingsStore.preferences.theme).not.toBe(initialTheme);
    
    await themeButton.trigger('click');
    expect(settingsStore.preferences.theme).not.toBe(initialTheme);
    
    await themeButton.trigger('click');
    expect(settingsStore.preferences.theme).toBe(initialTheme);
  });

  it('should apply theme classes to entire app', async () => {
    settingsStore.setTheme('dark');
    await nextTick();
    
    const container = wrapper.find('.min-h-screen');
    expect(container.classes()).toContain('bg-gray-900');
    expect(container.classes()).toContain('text-gray-100');
  });

  it('should persist theme to localStorage', async () => {
    settingsStore.setTheme('sepia');
    
    // Reload settings
    const newStore = useSettingsStore();
    
    expect(newStore.preferences.theme).toBe('sepia');
  });
});
```

### 6. Test Settings Persistence Workflow
```typescript
describe('Settings Persistence Workflow', () => {
  it('should persist font size changes', async () => {
    const increaseButton = wrapper.find('button[title="Increase font size"]');
    
    await increaseButton.trigger('click');
    await increaseButton.trigger('click');
    
    expect(settingsStore.preferences.fontSize).toBe(22);
    
    // Reload settings
    const newStore = useSettingsStore();
    expect(newStore.preferences.fontSize).toBe(22);
  });

  it('should apply font size to reader', async () => {
    settingsStore.setFontSize(24);
    await nextTick();
    
    const article = wrapper.find('article');
    expect(article.attributes('style')).toContain('font-size: 24px');
  });

  it('should persist wide mode toggle', async () => {
    const wideButton = wrapper.find('button[title*="Wide screen mode"]');
    await wideButton.trigger('click');
    
    expect(settingsStore.preferences.wideMode).toBe(true);
    
    // Reload settings
    const newStore = useSettingsStore();
    expect(newStore.preferences.wideMode).toBe(true);
  });
});
```

### 7. Test Library Management Workflow
```typescript
describe('Library Management Workflow', () => {
  it('should add book to library via upload', async () => {
    const addButton = wrapper.find('button:contains("Add Book")');
    const fileInput = wrapper.find('input[type="file"]');
    
    // Simulate file selection
    const mockFile = new File(['test'], 'test.epub', { type: 'application/epub+zip' });
    Object.defineProperty(fileInput.element, 'files', {
      value: [mockFile],
    });
    await fileInput.trigger('change');
    
    // Wait for book to load
    await vi.waitFor(() => libraryStore.books.length > 0);
    
    expect(libraryStore.books.length).toBeGreaterThan(0);
  });

  it('should display books in library panel', async () => {
    await libraryStore.cacheBook(
      {
        id: 'test-1',
        title: 'Test Book',
        author: 'Test Author',
        addedAt: new Date(),
        lastReadAt: new Date(),
        progress: 0,
        currentChapter: 0,
      },
      new Blob(['test'])
    );
    
    // Open library panel
    const libraryButton = wrapper.find('button[title="Library"]');
    await libraryButton.trigger('click');
    await nextTick();
    
    expect(wrapper.html()).toContain('Test Book');
    expect(wrapper.html()).toContain('Test Author');
  });

  it('should remove book from library', async () => {
    await libraryStore.cacheBook(
      {
        id: 'test-1',
        title: 'Test Book',
        author: 'Test',
        addedAt: new Date(),
        lastReadAt: new Date(),
        progress: 0,
        currentChapter: 0,
      },
      new Blob(['test'])
    );
    
    const libraryButton = wrapper.find('button[title="Library"]');
    await libraryButton.trigger('click');
    await nextTick();
    
    // Remove book
    const removeButton = wrapper.find('button[title="Remove from library"]');
    await removeButton.trigger('click');
    
    await nextTick();
    
    expect(libraryStore.books.length).toBe(0);
  });

  it('should clear entire library', async () => {
    // Add multiple books
    for (let i = 0; i < 3; i++) {
      await libraryStore.cacheBook(
        {
          id: `test-${i}`,
          title: `Book ${i}`,
          author: 'Test',
          addedAt: new Date(),
          lastReadAt: new Date(),
          progress: 0,
          currentChapter: 0,
        },
        new Blob([`content ${i}`])
      );
    }
    
    const libraryButton = wrapper.find('button[title="Library"]');
    await libraryButton.trigger('click');
    await nextTick();
    
    // Clear library
    const clearButton = wrapper.find('button:contains("Clear Library")');
    await clearButton.trigger('click');
    
    await nextTick();
    
    expect(libraryStore.books.length).toBe(0);
  });
});
```

### 8. Test Bookmark/Progress Workflow
```typescript
describe('Bookmark/Progress Workflow', () => {
  it('should save reading position when navigating chapters', async () => {
    await loadMockBook();
    
    // Navigate to chapter 2
    const nextButton = wrapper.find('button[title="Next chapter"]');
    await nextButton.trigger('click');
    
    await nextTick();
    
    // Scroll in new chapter
    const container = wrapper.find('.overflow-y-auto');
    container.element.scrollTop = 250;
    await container.trigger('scroll');
    await vi.advanceTimersByTimeAsync(500);
    
    // Verify progress saved
    const progress = await libraryStore.getReadingProgress(bookStore.metadata!.id);
    expect(progress?.chapterIndex).toBe(1);
  });

  it('should restore reading position on book reopen', async () => {
    const bookId = 'test-book';
    
    // Save position
    await libraryStore.cacheBook(
      {
        id: bookId,
        title: 'Test Book',
        author: 'Test',
        addedAt: new Date(),
        lastReadAt: new Date(),
        progress: 50,
        currentChapter: 3,
      },
      new Blob(['test'])
    );
    await libraryStore.updateReadingProgress(bookId, 3, 1000, 50);
    
    // Close current book
    bookStore.clearBook();
    
    // Reopen book
    const mockFile = new File(['test'], 'test.epub', { type: 'application/epub+zip' });
    await bookStore.loadBook(mockFile, false, bookId);
    
    await nextTick();
    
    // Verify position restored
    expect(bookStore.currentChapter).toBe(3);
    expect(bookStore.currentScrollPosition).toBe(1000);
  });

  it('should display progress in library', async () => {
    await libraryStore.cacheBook(
      {
        id: 'test-1',
        title: 'Test Book',
        author: 'Test',
        addedAt: new Date(),
        lastReadAt: new Date(),
        progress: 75,
        currentChapter: 5,
      },
      new Blob(['test'])
    );
    
    const libraryButton = wrapper.find('button[title="Library"]');
    await libraryButton.trigger('click');
    await nextTick();
    
    expect(wrapper.html()).toContain('75%');
  });
});
```

### 9. Test Edge Cases
```typescript
describe('workflow edge cases', () => {
  it('should handle rapid chapter navigation', async () => {
    await loadMockBook();
    
    const nextButton = wrapper.find('button[title="Next chapter"]');
    
    // Rapid navigation
    await nextButton.trigger('click');
    await nextButton.trigger('click');
    await nextButton.trigger('click');
    
    await nextTick();
    
    expect(bookStore.currentChapter).toBe(3);
  });

  it('should handle multiple settings changes simultaneously', async () => {
    settingsStore.setFontSize(20);
    settingsStore.setTheme('dark');
    settingsStore.toggleWideMode();
    
    await nextTick();
    
    expect(settingsStore.preferences.fontSize).toBe(20);
    expect(settingsStore.preferences.theme).toBe('dark');
    expect(settingsStore.preferences.wideMode).toBe(true);
  });

  it('should handle concurrent search and navigation', async () => {
    await loadMockBook();
    
    // Start search
    const searchButton = wrapper.find('button[title="Search"]');
    await searchButton.trigger('click');
    
    const searchInput = wrapper.find('input[placeholder="Search in book..."]');
    await searchInput.setValue('test');
    
    // Navigate before search completes
    const nextButton = wrapper.find('button[title="Next chapter"]');
    await nextButton.trigger('click');
    
    await vi.advanceTimersByTimeAsync(500);
    await nextTick();
    
    // Should not crash
    expect(bookStore.currentChapter).toBeGreaterThan(0);
  });
});
```

## Expected Outcomes
- Complete workflow test coverage
- End-to-end scenarios validated
- Integration bugs prevented
- User experience protected
- Coverage for critical user journeys

## Dependencies
- Must complete "Missing Test Framework and Testing Infrastructure" issue first
- Requires all component tests to be implemented
- Requires all store tests to be implemented
