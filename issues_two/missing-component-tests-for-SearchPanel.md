# Missing Component Tests for SearchPanel

**Severity:** Medium  
**Issue Type:** Missing Component Tests

## Affected Files
- `src/components/SearchPanel.vue` (lines 1-146) - Entire component untested

## Description
The `SearchPanel` component provides search interface with debounced input, loading states, results display, and navigation to search results. Zero test coverage for this user-facing feature.

**Untested Features:**
- Search input with debouncing (lines 44-49)
- Integration with `useSearch` composable (lines 12, 24-28)
- Loading state display (lines 99-104)
- Empty results state (lines 107-112)
- Results list with excerpts (lines 115-134)
- Result click navigation (lines 51-58)
- Component cleanup (lines 40-42)

## Why This Needs Testing
- **User-facing feature**: Search is primary navigation method
- **XSS risk**: Uses v-html for excerpts (line 131)
- **Debouncing**: Must properly debounce user input
- **State management**: Must correctly handle loading, results, and empty states
- **Store integration**: Must call bookStore.setSearchHighlight
- **Performance**: Debounce timer must not leak
- **Edge cases**: Empty queries, long queries, special characters

## Implementation Plan

### 1. Create Test File
`src/components/SearchPanel.test.vue`:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import SearchPanel from './SearchPanel.vue';
import { useBookStore } from '@/stores/book';
import * as useSearchModule from '@/composables/useSearch';

describe('SearchPanel', () => {
  let wrapper: VueWrapper;
  let bookStore: ReturnType<typeof useBookStore>;
  let searchComposable: any;

  beforeEach(() => {
    setActivePinia(createPinia());
    bookStore = useBookStore();
    searchComposable = {
      results: ref([]),
      isSearching: ref(false),
      searchInBook: vi.fn(),
      clearSearch: vi.fn(),
    };
    vi.mocked(useSearchModule).mockReturnValue(searchComposable);
  });

  afterEach(() => {
    wrapper?.unmount();
  });
});
```

### 2. Test Component Rendering
```typescript
describe('rendering', () => {
  it('should render search input', () => {
    wrapper = mount(SearchPanel);
    
    const input = wrapper.find('input[type="text"]');
    expect(input.exists()).toBe(true);
    expect(input.attributes('placeholder')).toBe('Search in book...');
  });

  it('should render search heading', () => {
    wrapper = mount(SearchPanel);
    
    const heading = wrapper.find('h2');
    expect(heading.text()).toBe('Search');
  });

  it('should render close button', () => {
    wrapper = mount(SearchPanel);
    
    const button = wrapper.find('button[aria-label="Close"]');
    expect(button.exists()).toBe(true);
  });

  it('should render empty state initially', () => {
    wrapper = mount(SearchPanel);
    
    expect(wrapper.text()).toContain('Enter a search term to find content in this book');
  });
});
```

### 3. Test Search Input
```typescript
describe('search input', () => {
  it('should update searchQuery value on input', async () => {
    wrapper = mount(SearchPanel);
    const input = wrapper.find('input[type="text"]');
    
    await input.setValue('test query');
    
    expect(wrapper.vm.searchQuery).toBe('test query');
  });

  it('should call searchInBook with debouncing', async () => {
    wrapper = mount(SearchPanel);
    const input = wrapper.find('input[type="text"]');
    
    await input.setValue('test');
    await vi.advanceTimersByTimeAsync(100);
    await input.setValue('test query');
    await vi.advanceTimersByTimeAsync(100);
    
    // Should not call yet (debounce)
    expect(searchComposable.searchInBook).not.toHaveBeenCalled();
    
    await vi.advanceTimersByTimeAsync(300);
    
    // Should call after debounce
    expect(searchComposable.searchInBook).toHaveBeenCalled();
  });

  it('should not search for empty query', async () => {
    wrapper = mount(SearchPanel);
    const input = wrapper.find('input[type="text"]');
    
    await input.setValue('   ');
    await vi.advanceTimersByTimeAsync(500);
    
    expect(searchComposable.searchInBook).not.toHaveBeenCalled();
  });

  it('should clear search highlight on empty query', async () => {
    wrapper = mount(SearchPanel);
    const input = wrapper.find('input[type="text"]');
    
    await input.setValue('test');
    await vi.advanceTimersByTimeAsync(500);
    await input.setValue('');
    await vi.advanceTimersByTimeAsync(500);
    
    expect(bookStore.searchHighlight).toBeNull();
  });
});
```

### 4. Test Loading State
```typescript
describe('loading state', () => {
  it('should show loading spinner when searching', async () => {
    searchComposable.isSearching.value = true;
    wrapper = mount(SearchPanel);
    
    const spinner = wrapper.find('.animate-spin');
    expect(spinner.exists()).toBe(true);
    expect(wrapper.text()).toContain('Loading book...');
  });

  it('should hide loading spinner when not searching', () => {
    searchComposable.isSearching.value = false;
    wrapper = mount(SearchPanel);
    
    const spinner = wrapper.find('.animate-spin');
    expect(spinner.exists()).toBe(false);
  });
});
```

### 5. Test Results Display
```typescript
describe('results display', () => {
  beforeEach(() => {
    searchComposable.results.value = [
      {
        chapterIndex: 0,
        chapterTitle: 'Chapter 1',
        excerpt: 'This is a <mark>test</mark> excerpt...',
        cfi: 'chapter1',
        searchText: 'test',
        matchedText: 'test',
        matchIndex: 0,
      },
      {
        chapterIndex: 1,
        chapterTitle: 'Chapter 2',
        excerpt: 'Another <mark>test</mark> excerpt...',
        cfi: 'chapter2',
        searchText: 'test',
        matchedText: 'test',
        matchIndex: 0,
      },
    ];
  });

  it('should show results count', () => {
    wrapper = mount(SearchPanel);
    
    expect(wrapper.text()).toContain('2 results found');
  });

  it('should render result items', () => {
    wrapper = mount(SearchPanel);
    
    const buttons = wrapper.findAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('should display chapter title in result', () => {
    wrapper = mount(SearchPanel);
    
    expect(wrapper.html()).toContain('Chapter 1');
    expect(wrapper.html()).toContain('Chapter 2');
  });

  it('should display excerpt with v-html', () => {
    wrapper = mount(SearchPanel);
    
    expect(wrapper.html()).toContain('<mark>test</mark>');
  });
});
```

### 6. Test Empty Results State
```typescript
describe('empty results state', () => {
  it('should show no results message when query has no matches', async () => {
    wrapper = mount(SearchPanel);
    searchComposable.results.value = [];
    searchComposable.isSearching.value = false;
    const input = wrapper.find('input[type="text"]');
    await input.setValue('nonexistent');
    await vi.advanceTimersByTimeAsync(500);
    await nextTick();
    
    expect(wrapper.text()).toContain('No results found for "nonexistent"');
  });
});
```

### 7. Test Result Navigation
```typescript
describe('result navigation', () => {
  beforeEach(() => {
    searchComposable.results.value = [
      {
        chapterIndex: 2,
        chapterTitle: 'Chapter 3',
        excerpt: 'This is a <mark>test</mark> excerpt...',
        cfi: 'chapter3',
        searchText: 'test',
        matchedText: 'test',
        matchIndex: 1,
      },
    ];
  });

  it('should set chapter when result clicked', async () => {
    wrapper = mount(SearchPanel);
    const resultButton = wrapper.findAll('button').find(b => 
      b.text().includes('Chapter 3')
    );
    
    await resultButton.trigger('click');
    
    expect(bookStore.setChapter).toHaveBeenCalledWith(2);
  });

  it('should set search highlight when result clicked', async () => {
    wrapper = mount(SearchPanel);
    const resultButton = wrapper.findAll('button').find(b => 
      b.text().includes('Chapter 3')
    );
    
    await resultButton.trigger('click');
    
    expect(bookStore.searchHighlight).toEqual({
      chapterIndex: 2,
      searchText: 'test',
      matchIndex: 1,
    });
  });

  it('should emit close event when result clicked', async () => {
    wrapper = mount(SearchPanel);
    const resultButton = wrapper.findAll('button').find(b => 
      b.text().includes('Chapter 3')
    );
    
    await resultButton.trigger('click');
    
    expect(wrapper.emitted('close')).toBeTruthy();
  });
});
```

### 8. Test Close Button
```typescript
describe('close button', () => {
  it('should emit close event when clicked', async () => {
    wrapper = mount(SearchPanel);
    const closeButton = wrapper.find('button[aria-label="Close"]');
    
    await closeButton.trigger('click');
    
    expect(wrapper.emitted('close')).toBeTruthy();
  });
});
```

### 9. Test Cleanup
```typescript
describe('cleanup', () => {
  it('should clear search highlight on unmount', async () => {
    bookStore.searchHighlight = {
      chapterIndex: 0,
      searchText: 'test',
      matchIndex: 0,
    };
    wrapper = mount(SearchPanel);
    
    wrapper.unmount();
    
    expect(bookStore.searchHighlight).toBeNull();
  });
});
```

### 10. Test XSS Prevention
```typescript
describe('XSS prevention', () => {
  it('should escape HTML in excerpts', async () => {
    searchComposable.results.value = [
      {
        chapterIndex: 0,
        chapterTitle: 'Chapter 1',
        excerpt: 'This is a <script>alert("xss")</script> excerpt',
        cfi: 'chapter1',
        searchText: 'test',
        matchedText: 'test',
        matchIndex: 0,
      },
    ];
    wrapper = mount(SearchPanel);
    
    // Script should not be executed
    // Note: v-html allows HTML, so this tests that useSearch escapes properly
    expect(wrapper.html()).not.toContain('<script>');
  });
});
```

### 11. Test Edge Cases
```typescript
describe('edge cases', () => {
  it('should handle very long search queries', async () => {
    wrapper = mount(SearchPanel);
    const input = wrapper.find('input[type="text"]');
    const longQuery = 'a'.repeat(1000);
    
    await input.setValue(longQuery);
    await vi.advanceTimersByTimeAsync(500);
    
    expect(wrapper.vm.searchQuery).toBe(longQuery);
  });

  it('should handle special characters in search', async () => {
    wrapper = mount(SearchPanel);
    const input = wrapper.find('input[type="text"]');
    
    await input.setValue('test.*+?^${}()|[]\\');
    await vi.advanceTimersByTimeAsync(500);
    
    expect(searchComposable.searchInBook).toHaveBeenCalledWith(
      'test.*+?^${}()|[]\\',
      expect.any(Array)
    );
  });

  it('should handle rapid successive searches', async () => {
    wrapper = mount(SearchPanel);
    const input = wrapper.find('input[type="text"]');
    
    await input.setValue('a');
    await vi.advanceTimersByTimeAsync(100);
    await input.setValue('ab');
    await vi.advanceTimersByTimeAsync(100);
    await input.setValue('abc');
    await vi.advanceTimersByTimeAsync(100);
    await input.setValue('abcd');
    await vi.advanceTimersByTimeAsync(500);
    
    // Should only call once with final value
    expect(searchComposable.searchInBook).toHaveBeenCalledTimes(1);
    expect(searchComposable.searchInBook).toHaveBeenCalledWith('abcd', expect.any(Array));
  });

  it('should handle many results', () => {
    searchComposable.results.value = Array(100).fill(null).map((_, i) => ({
      chapterIndex: 0,
      chapterTitle: `Chapter 1`,
      excerpt: 'Result excerpt',
      cfi: 'chapter1',
      searchText: 'test',
      matchedText: 'test',
      matchIndex: i,
    }));
    
    wrapper = mount(SearchPanel);
    
    const buttons = wrapper.findAll('button');
    expect(buttons.length).toBeGreaterThan(50);
  });

  it('should handle result with empty chapterTitle', () => {
    searchComposable.results.value = [
      {
        chapterIndex: 0,
        chapterTitle: '',
        excerpt: 'Test excerpt',
        cfi: 'chapter1',
        searchText: 'test',
        matchedText: 'test',
        matchIndex: 0,
      },
    ];
    
    wrapper = mount(SearchPanel);
    
    expect(wrapper.html()).toContain('Test excerpt');
  });

  it('should handle result with long excerpt', () => {
    searchComposable.results.value = [
      {
        chapterIndex: 0,
        chapterTitle: 'Chapter 1',
        excerpt: 'a'.repeat(1000),
        cfi: 'chapter1',
        searchText: 'test',
        matchedText: 'test',
        matchIndex: 0,
      },
    ];
    
    wrapper = mount(SearchPanel);
    
    // Should render without error
    expect(wrapper.find('button').exists()).toBe(true);
  });
});
```

## Expected Outcomes
- Full component test coverage
- Debouncing verified
- XSS prevention confirmed
- State transitions tested
- Coverage > 85% for SearchPanel.vue

## Dependencies
- Must complete "Missing Test Framework and Testing Infrastructure" issue first
- Needs useSearch and BookStore mocks
