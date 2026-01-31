# Missing Component Tests for BookViewer

**Severity:** High  
**Issue Type:** Missing Component Tests

## Affected Files
- `src/components/BookViewer.vue` (lines 1-348) - Entire component untested

## Description
The `BookViewer` component is the core reading interface with complex logic for rendering chapter content, handling scroll events, managing internal navigation links, search highlighting, and applying reader settings. Zero test coverage for this critical component.

**Untested Features:**
- Chapter rendering with `watchEffect` (lines 253-257)
- Scroll debouncing and progress tracking (lines 38-61)
- Internal link handling (lines 63-139)
- Search text highlighting (lines 168-236)
- Font family resolution (lines 28-36)
- Settings change tracking (lines 288-321)
- Chapter change progress updates (lines 269-286)
- Search highlight reactivity (lines 259-266)

## Why This Needs Testing
- **Core reader interface**: This is where users read books
- **Complex DOM manipulation**: Heavy use of innerHTML, querySelector, scrollIntoView
- **Multiple watchers**: 4 different watch statements that could conflict
- **Debouncing logic**: Scroll and settings debounced (lines 40, 296)
- **Memory leaks**: Timer cleanup in `onUnmounted` (lines 323-326)
- **XSS risk**: Direct innerHTML manipulation (line 156)
- **Edge cases**: Missing chapters, empty content, broken links
- **Search integration**: Highlighting logic must not break content
- **Performance**: Large chapters could cause performance issues

## Implementation Plan

### 1. Create Test File
`src/components/BookViewer.test.vue`:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import BookViewer from './BookViewer.vue';
import { useBookStore } from '@/stores/book';
import { useSettingsStore } from '@/stores/settings';

describe('BookViewer', () => {
  let wrapper: VueWrapper;
  let bookStore: ReturnType<typeof useBookStore>;
  let settingsStore: ReturnType<typeof useSettingsStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    bookStore = useBookStore();
    settingsStore = useSettingsStore();
    // Mock book and settings
  });

  afterEach(() => {
    wrapper?.unmount();
  });
});
```

### 2. Test Component Rendering
```typescript
describe('rendering', () => {
  it('should render empty state when no book loaded', () => {
    wrapper = mount(BookViewer);
    
    expect(wrapper.text()).toContain('No chapter content available');
  });

  it('should render chapter content when book loaded', async () => {
    await loadMockBook();
    await nextTick();
    
    const article = wrapper.find('article');
    expect(article.exists()).toBe(true);
    expect(article.text()).toContain('Chapter content');
  });

  it('should apply custom font size', async () => {
    settingsStore.setFontSize(24);
    await loadMockBook();
    await nextTick();
    
    const article = wrapper.find('article');
    expect(article.attributes('style')).toContain('font-size: 24px');
  });

  it('should apply custom font family', async () => {
    settingsStore.setFontFamily('arial');
    await loadMockBook();
    await nextTick();
    
    const article = wrapper.find('article');
    expect(article.attributes('style')).toContain('Arial');
  });

  it('should apply custom line height', async () => {
    settingsStore.setLineHeight(2.0);
    await loadMockBook();
    await nextTick();
    
    const article = wrapper.find('article');
    expect(article.attributes('style')).toContain('line-height: 2');
  });

  it('should apply theme classes', async () => {
    settingsStore.setTheme('dark');
    await loadMockBook();
    await nextTick();
    
    const container = wrapper.find('.overflow-y-auto');
    expect(container.classes()).toContain('bg-gray-900');
  });

  it('should apply wide mode classes', async () => {
    settingsStore.preferences.wideMode = true;
    await loadMockBook();
    await nextTick();
    
    const container = wrapper.find('.overflow-y-auto');
    expect(container.classes()).toContain('max-w-full');
  });
});
```

### 3. Test Scroll Handling
```typescript
describe('scroll handling', () => {
  it('should handle scroll event', async () => {
    await loadMockBook();
    await nextTick();
    
    const container = wrapper.find('.overflow-y-auto');
    await container.trigger('scroll');
    
    await vi.advanceTimersByTimeAsync(500);
    
    // Verify updateProgress was called
    expect(bookStore.updateProgress).toHaveBeenCalled();
  });

  it('should debounce scroll events', async () => {
    await loadMockBook();
    await nextTick();
    
    const container = wrapper.find('.overflow-y-auto');
    
    await container.trigger('scroll');
    await vi.advanceTimersByTimeAsync(100);
    await container.trigger('scroll');
    await vi.advanceTimersByTimeAsync(100);
    
    // Should only call once after debounce
    expect(bookStore.updateProgress).toHaveBeenCalledTimes(0);
    
    await vi.advanceTimersByTimeAsync(500);
    expect(bookStore.updateProgress).toHaveBeenCalled();
  });

  it('should calculate overall progress correctly', async () => {
    await loadMockBook();
    await nextTick();
    
    const container = wrapper.find('.overflow-y-auto');
    container.element.scrollTop = 100;
    container.element.scrollHeight = 500;
    container.element.clientHeight = 100;
    
    await container.trigger('scroll');
    await vi.advanceTimersByTimeAsync(500);
    
    const call = bookStore.updateProgress.mock.calls[0][0];
    expect(call.percentage).toBeCloseTo(25, 0);
  });

  it('should handle scroll when no chapter content', async () => {
    await loadMockBookWithEmptyChapter();
    await nextTick();
    
    const container = wrapper.find('.overflow-y-auto');
    await container.trigger('scroll');
    
    // Should not throw
  });
});
```

### 4. Test Internal Link Handling
```typescript
describe('internal link handling', () => {
  it('should handle hash links', async () => {
    await loadMockBookWithContent(`
      <h2 id="section1">Section 1</h2>
      <p>Content</p>
    `);
    await nextTick();
    
    const link = wrapper.find('a[href="#section1"]');
    await link.trigger('click');
    await nextTick();
    
    // Should scroll to element
    // Verify element.scrollIntoView was called
  });

  it('should handle chapter navigation links', async () => {
    await loadMockBook();
    await nextTick();
    
    const link = wrapper.find('a[href="chapter2.xhtml"]');
    await link.trigger('click');
    
    expect(bookStore.setChapter).toHaveBeenCalled();
  });

  it('should handle dynamic chapter loading', async () => {
    await loadMockBook();
    await nextTick();
    
    const link = wrapper.find('a[href="new-chapter.xhtml"]');
    await link.trigger('click');
    
    // Should call epub.loadChapterByHref
    expect(bookStore.addChapter).toHaveBeenCalled();
  });

  it('should allow external links to work', async () => {
    await loadMockBook();
    await nextTick();
    
    const link = wrapper.find('a[href="https://example.com"]');
    await link.trigger('click');
    
    // Should not prevent default behavior
  });

  it('should handle mailto links', async () => {
    await loadMockBook();
    await nextTick();
    
    const link = wrapper.find('a[href="mailto:test@example.com"]');
    await link.trigger('click');
    
    // Should not prevent default
  });
});
```

### 5. Test Search Highlighting
```typescript
describe('search highlighting', () => {
  it('should highlight search text', async () => {
    await loadMockBookWithContent('This is test content');
    bookStore.searchHighlight = {
      chapterIndex: 0,
      searchText: 'test',
      matchIndex: 0,
    };
    await nextTick();
    
    const article = wrapper.find('article');
    expect(article.html()).toContain('<mark class="search-highlight active">test</mark>');
  });

  it('should highlight multiple matches', async () => {
    await loadMockBookWithContent('test one test two test three');
    bookStore.searchHighlight = {
      chapterIndex: 0,
      searchText: 'test',
      matchIndex: 0,
    };
    await nextTick();
    
    const marks = wrapper.findAll('mark.search-highlight');
    expect(marks.length).toBe(3);
  });

  it('should mark active search result', async () => {
    await loadMockBookWithContent('test one test two');
    bookStore.searchHighlight = {
      chapterIndex: 0,
      searchText: 'test',
      matchIndex: 1,
    };
    await nextTick();
    
    const marks = wrapper.findAll('mark.search-highlight');
    expect(marks[1].classes()).toContain('active');
  });

  it('should escape special regex characters in search', async () => {
    await loadMockBookWithContent('test.txt');
    bookStore.searchHighlight = {
      chapterIndex: 0,
      searchText: 'test.txt',
      matchIndex: 0,
    };
    await nextTick();
    
    // Should highlight correctly without regex errors
    const marks = wrapper.findAll('mark.search-highlight');
    expect(marks.length).toBe(1);
  });

  it('should not highlight in script tags', async () => {
    await loadMockBookWithContent('<p>test</p><script>var test = 1;</script>');
    bookStore.searchHighlight = {
      chapterIndex: 0,
      searchText: 'test',
      matchIndex: 0,
    };
    await nextTick();
    
    // Should only highlight in paragraph, not script
    const marks = wrapper.findAll('mark.search-highlight');
    expect(marks.length).toBe(1);
  });

  it('should scroll to first highlight', async () => {
    await loadMockBookWithContent('test');
    bookStore.searchHighlight = {
      chapterIndex: 0,
      searchText: 'test',
      matchIndex: 0,
    };
    await nextTick();
    
    // Verify scrollIntoView was called on first highlight
  });
});
```

### 6. Test Chapter Navigation
```typescript
describe('chapter navigation', () => {
  it('should render new chapter when chapter changes', async () => {
    await loadMockBook();
    await nextTick();
    
    bookStore.setChapter(1);
    await nextTick();
    
    const article = wrapper.find('article');
    expect(article.text()).toContain('Chapter 2');
  });

  it('should update progress on chapter change', async () => {
    await loadMockBook();
    await nextTick();
    
    bookStore.setChapter(1);
    await nextTick();
    
    expect(bookStore.updateProgress).toHaveBeenCalled();
  });

  it('should clear search highlight on chapter change', async () => {
    bookStore.searchHighlight = {
      chapterIndex: 0,
      searchText: 'test',
      matchIndex: 0,
    };
    await loadMockBook();
    await nextTick();
    
    bookStore.setChapter(1);
    await nextTick();
    
    // Highlights should be removed
    const marks = wrapper.findAll('mark.search-highlight');
    expect(marks.length).toBe(0);
  });
});
```

### 7. Test Settings Reactivity
```typescript
describe('settings reactivity', () => {
  it('should re-render when font size changes', async () => {
    await loadMockBook();
    await nextTick();
    
    settingsStore.setFontSize(24);
    await vi.advanceTimersByTimeAsync(500);
    await nextTick();
    
    const article = wrapper.find('article');
    expect(article.attributes('style')).toContain('font-size: 24px');
  });

  it('should re-render when theme changes', async () => {
    await loadMockBook();
    await nextTick();
    
    settingsStore.setTheme('dark');
    await nextTick();
    
    const container = wrapper.find('.overflow-y-auto');
    expect(container.classes()).toContain('bg-gray-900');
  });

  it('should update progress when settings change', async () => {
    await loadMockBook();
    await nextTick();
    
    settingsStore.setFontSize(24);
    await vi.advanceTimersByTimeAsync(500);
    
    expect(bookStore.updateProgress).toHaveBeenCalled();
  });
});
```

### 8. Test Edge Cases
```typescript
describe('edge cases', () => {
  it('should handle empty chapter content', async () => {
    await loadMockBookWithEmptyChapter();
    await nextTick();
    
    const article = wrapper.find('article');
    expect(article.text()).toContain('Empty chapter');
  });

  it('should handle missing chapter', async () => {
    await loadMockBook();
    bookStore.currentChapter = 999;
    await nextTick();
    
    const article = wrapper.find('article');
    expect(article.text()).toContain('No chapter content available');
  });

  it('should restore scroll position', async () => {
    bookStore.currentScrollPosition = 500;
    await loadMockBook();
    await nextTick();
    
    const container = wrapper.find('.overflow-y-auto');
    expect(container.element.scrollTop).toBe(500);
  });

  it('should handle malformed HTML in chapter', async () => {
    await loadMockBookWithContent('<p>test<div>unclosed');
    await nextTick();
    
    // Should not crash
    const article = wrapper.find('article');
    expect(article.exists()).toBe(true);
  });

  it('should handle chapter with images', async () => {
    await loadMockBookWithContent('<p>Text</p><img src="image.png" alt="Test" />');
    await nextTick();
    
    const img = wrapper.find('img');
    expect(img.exists()).toBe(true);
  });

  it('should clean up timers on unmount', async () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    
    await loadMockBook();
    const container = wrapper.find('.overflow-y-auto');
    await container.trigger('scroll');
    
    wrapper.unmount();
    
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
```

### 9. Test Memory Leaks
```typescript
describe('memory management', () => {
  it('should clear scroll timer on unmount', async () => {
    await loadMockBook();
    const container = wrapper.find('.overflow-y-auto');
    await container.trigger('scroll');
    
    wrapper.unmount();
    
    // Timer should be cleared
    await vi.advanceTimersByTimeAsync(500);
    expect(bookStore.updateProgress).not.toHaveBeenCalled();
  });

  it('should clear settings timer on unmount', async () => {
    await loadMockBook();
    settingsStore.setFontSize(24);
    
    wrapper.unmount();
    
    // Timer should be cleared
    await vi.advanceTimersByTimeAsync(500);
    expect(bookStore.updateProgress).not.toHaveBeenCalled();
  });
});
```

## Expected Outcomes
- Full component test coverage
- Scroll handling validated
- Link navigation verified
- Search highlighting tested
- Memory leaks prevented
- Coverage > 80% for BookViewer.vue

## Dependencies
- Must complete "Missing Test Framework and Testing Infrastructure" issue first
- Needs BookStore and SettingsStore mocks
- Needs useEpub mock
