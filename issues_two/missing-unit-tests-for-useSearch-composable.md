# Missing Unit Tests for useSearch Composable

**Severity:** Medium  
**Issue Type:** Missing Unit Tests

## Affected Files
- `src/composables/useSearch.ts` (lines 1-96) - Entire file untested

## Description
The `useSearch` composable provides search functionality across book chapters. It includes text searching, context extraction, regex escaping, and result management. Currently has zero test coverage.

**Untested Functions:**
- `searchInBook()` - Main search function (lines 9-77)
- `clearSearch()` - Reset search state (lines 79-82)
- `escapeRegex()` - Regex escaping for search terms (lines 84-86)

## Why This Needs Testing
- **User-facing feature**: Search is a core user interaction
- **DOM parsing**: Uses DOMParser to extract text from chapter HTML
- **Regex operations**: Critical for text matching and highlighting
- **Performance implications**: Loops through all chapters with maxResultsPerChapter limit
- **HTML sanitization**: Results use v-html to display excerpts (line 131 in SearchPanel.vue)
- **XSS risk**: Improper escaping could lead to XSS vulnerabilities
- **Edge cases**: Empty queries, special regex characters, large books, Unicode text

## Implementation Plan

### 1. Create Test File
`src/composables/useSearch.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useSearch } from './useSearch';

describe('useSearch', () => {
  let search: ReturnType<typeof useSearch>;

  beforeEach(() => {
    search = useSearch();
  });

  // Test cases below
});
```

### 2. Test searchInBook Function
```typescript
describe('searchInBook', () => {
  it('should return empty array for empty query', async () => {
    const chapters = [{ id: '1', href: '1.xhtml', title: 'Chapter 1', level: 0, content: '<p>test</p>' }];
    const results = await search.searchInBook('', chapters);
    
    expect(results).toEqual([]);
    expect(search.isSearching.value).toBe(false);
  });

  it('should return empty array for whitespace-only query', async () => {
    const chapters = [{ id: '1', href: '1.xhtml', title: 'Chapter 1', level: 0, content: '<p>test</p>' }];
    const results = await search.searchInBook('   ', chapters);
    
    expect(results).toEqual([]);
  });

  it('should find single occurrence of text', async () => {
    const chapters = [{
      id: '1',
      href: '1.xhtml',
      title: 'Chapter 1',
      level: 0,
      content: '<p>This is a test paragraph.</p>'
    }];
    const results = await search.searchInBook('test', chapters);
    
    expect(results).toHaveLength(1);
    expect(results[0].chapterIndex).toBe(0);
    expect(results[0].chapterTitle).toBe('Chapter 1');
    expect(results[0].matchedText).toBe('test');
    expect(results[0].matchIndex).toBe(0);
  });

  it('should find multiple occurrences in same chapter', async () => {
    const chapters = [{
      id: '1',
      href: '1.xhtml',
      title: 'Chapter 1',
      level: 0,
      content: '<p>test one test two test three</p>'
    }];
    const results = await search.searchInBook('test', chapters);
    
    expect(results).toHaveLength(3);
    expect(results[0].matchIndex).toBe(0);
    expect(results[1].matchIndex).toBe(1);
    expect(results[2].matchIndex).toBe(2);
  });

  it('should find text across multiple chapters', async () => {
    const chapters = [
      { id: '1', href: '1.xhtml', title: 'Chapter 1', level: 0, content: '<p>test in chapter 1</p>' },
      { id: '2', href: '2.xhtml', title: 'Chapter 2', level: 0, content: '<p>test in chapter 2</p>' },
      { id: '3', href: '3.xhtml', title: 'Chapter 3', level: 0, content: '<p>test in chapter 3</p>' }
    ];
    const results = await search.searchInBook('test', chapters);
    
    expect(results).toHaveLength(3);
    expect(results[0].chapterTitle).toBe('Chapter 1');
    expect(results[1].chapterTitle).toBe('Chapter 2');
    expect(results[2].chapterTitle).toBe('Chapter 3');
  });

  it('should limit results per chapter to maxResultsPerChapter', async () => {
    const longContent = '<p>' + Array(20).fill('test').join(' ') + '</p>';
    const chapters = [{
      id: '1',
      href: '1.xhtml',
      title: 'Chapter 1',
      level: 0,
      content: longContent
    }];
    const results = await search.searchInBook('test', chapters);
    
    expect(results.length).toBeLessThanOrEqual(10); // maxResultsPerChapter
  });

  it('should extract context around match', async () => {
    const chapters = [{
      id: '1',
      href: '1.xhtml',
      title: 'Chapter 1',
      level: 0,
      content: '<p>This is a long paragraph with the search term in the middle of some text</p>'
    }];
    const results = await search.searchInBook('search term', chapters);
    
    expect(results).toHaveLength(1);
    expect(results[0].excerpt).toContain('search term');
    expect(results[0].excerpt).toContain('...');
  });

  it('should highlight matched text in excerpt with mark tags', async () => {
    const chapters = [{
      id: '1',
      href: '1.xhtml',
      title: 'Chapter 1',
      level: 0,
      content: '<p>This is a test paragraph</p>'
    }];
    const results = await search.searchInBook('test', chapters);
    
    expect(results[0].excerpt).toContain('<mark>test</mark>');
  });

  it('should handle case-insensitive search', async () => {
    const chapters = [{
      id: '1',
      href: '1.xhtml',
      title: 'Chapter 1',
      level: 0,
      content: '<p>TEST Test test</p>'
    }];
    const results = await search.searchInBook('test', chapters);
    
    expect(results).toHaveLength(3);
  });

  it('should set isSearching to true during search', async () => {
    const chapters = [{ id: '1', href: '1.xhtml', title: 'Chapter 1', level: 0, content: '<p>test</p>' }];
    
    const searchPromise = search.searchInBook('test', chapters);
    expect(search.isSearching.value).toBe(true);
    
    await searchPromise;
    expect(search.isSearching.value).toBe(false);
  });

  it('should handle chapters with no content', async () => {
    const chapters = [
      { id: '1', href: '1.xhtml', title: 'Chapter 1', level: 0, content: '' },
      { id: '2', href: '2.xhtml', title: 'Chapter 2', level: 0, content: '<p>test</p>' }
    ];
    const results = await search.searchInBook('test', chapters);
    
    expect(results).toHaveLength(1);
    expect(results[0].chapterIndex).toBe(1);
  });

  it('should handle chapters with no body element', async () => {
    const chapters = [{
      id: '1',
      href: '1.xhtml',
      title: 'Chapter 1',
      level: 0,
      content: '<html><head></head></html>'
    }];
    const results = await search.searchInBook('test', chapters);
    
    expect(results).toHaveLength(0);
  });

  it('should update results ref after search', async () => {
    const chapters = [{ id: '1', href: '1.xhtml', title: 'Chapter 1', level: 0, content: '<p>test</p>' }];
    await search.searchInBook('test', chapters);
    
    expect(search.results.value).toHaveLength(1);
  });

  it('should update query ref after search', async () => {
    const chapters = [{ id: '1', href: '1.xhtml', title: 'Chapter 1', level: 0, content: '<p>test</p>' }];
    await search.searchInBook('test query', chapters);
    
    expect(search.query.value).toBe('test query');
  });

  it('should handle HTML content with script tags safely', async () => {
    const chapters = [{
      id: '1',
      href: '1.xhtml',
      title: 'Chapter 1',
      level: 0,
      content: '<p>test</p><script>alert("xss")</script>'
    }];
    const results = await search.searchInBook('test', chapters);
    
    expect(results).toHaveLength(1);
    // Script content should not affect search results
    expect(results[0].excerpt).not.toContain('alert');
  });
});
```

### 3. Test clearSearch Function
```typescript
describe('clearSearch', () => {
  it('should clear results array', async () => {
    const chapters = [{ id: '1', href: '1.xhtml', title: 'Chapter 1', level: 0, content: '<p>test</p>' }];
    await search.searchInBook('test', chapters);
    
    search.clearSearch();
    
    expect(search.results.value).toEqual([]);
  });

  it('should clear query string', async () => {
    const chapters = [{ id: '1', href: '1.xhtml', title: 'Chapter 1', level: 0, content: '<p>test</p>' }];
    await search.searchInBook('test', chapters);
    
    search.clearSearch();
    
    expect(search.query.value).toBe('');
  });
});
```

### 4. Test escapeRegex Function
```typescript
describe('escapeRegex', () => {
  it('should escape special regex characters', () => {
    const input = 'test.*+?^${}()|[]\\';
    const result = search.escapeRegex(input);
    
    expect(result).toBe('test\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });

  it('should escape asterisk', () => {
    expect(search.escapeRegex('test*')).toBe('test\\*');
  });

  it('should escape plus sign', () => {
    expect(search.escapeRegex('test+')).toBe('test\\+');
  });

  it('should escape question mark', () => {
    expect(search.escapeRegex('test?')).toBe('test\\?');
  });

  it('should escape caret', () => {
    expect(search.escapeRegex('test^')).toBe('test\\^');
  });

  it('should escape dollar sign', () => {
    expect(search.escapeRegex('test$')).toBe('test\\$');
  });

  it('should escape parentheses', () => {
    expect(search.escapeRegex('test()')).toBe('test\\(\\)');
  });

  it('should escape brackets', () => {
    expect(search.escapeRegex('test[]')).toBe('test\\[\\]');
  });

  it('should escape pipe', () => {
    expect(search.escapeRegex('test|other')).toBe('test\\|other');
  });

  it('should escape backslash', () => {
    expect(search.escapeRegex('test\\path')).toBe('test\\\\path');
  });

  it('should escape curly braces', () => {
    expect(search.escapeRegex('test{1,3}')).toBe('test\\{1,3\\}');
  });

  it('should not escape regular characters', () => {
    expect(search.escapeRegex('test123')).toBe('test123');
  });

  it('should handle empty string', () => {
    expect(search.escapeRegex('')).toBe('');
  });

  it('should handle string with only special characters', () => {
    expect(search.escapeRegex('.*+?^${}()|[]\\')).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });
});
```

### 5. Test Edge Cases and Special Scenarios
```typescript
describe('useSearch edge cases', () => {
  it('should handle Unicode characters', async () => {
    const chapters = [{
      id: '1',
      href: '1.xhtml',
      title: '第一章',
      level: 0,
      content: '<p>这是一段中文文本</p>'
    }];
    const results = await search.searchInBook('中文', chapters);
    
    expect(results).toHaveLength(1);
    expect(results[0].matchedText).toBe('中文');
  });

  it('should handle emoji characters', async () => {
    const chapters = [{
      id: '1',
      href: '1.xhtml',
      title: 'Chapter 1',
      level: 0,
      content: '<p>This is great 😊 content</p>'
    }];
    const results = await search.searchInBook('😊', chapters);
    
    expect(results).toHaveLength(1);
  });

  it('should handle very long search terms', async () => {
    const longTerm = 'a'.repeat(1000);
    const chapters = [{
      id: '1',
      href: '1.xhtml',
      title: 'Chapter 1',
      level: 0,
      content: `<p>${longTerm}</p>`
    }];
    const results = await search.searchInBook(longTerm, chapters);
    
    expect(results).toHaveLength(1);
  });

  it('should handle search with newlines', async () => {
    const chapters = [{
      id: '1',
      href: '1.xhtml',
      title: 'Chapter 1',
      level: 0,
      content: '<p>line1\nline2\nline3</p>'
    }];
    const results = await search.searchInBook('line2', chapters);
    
    expect(results).toHaveLength(1);
  });

  it('should handle HTML entities in content', async () => {
    const chapters = [{
      id: '1',
      href: '1.xhtml',
      title: 'Chapter 1',
      level: 0,
      content: '<p>This &amp; that</p>'
    }];
    const results = await search.searchInBook('and', chapters);
    
    // DOMParser should decode entities
    expect(results).toHaveLength(1);
  });

  it('should search within nested HTML elements', async () => {
    const chapters = [{
      id: '1',
      href: '1.xhtml',
      title: 'Chapter 1',
      level: 0,
      content: '<div><span>test</span></div>'
    }];
    const results = await search.searchInBook('test', chapters);
    
    expect(results).toHaveLength(1);
  });

  it('should handle large number of chapters efficiently', async () => {
    const chapters = Array(100).fill(null).map((_, i) => ({
      id: `${i}`,
      href: `${i}.xhtml`,
      title: `Chapter ${i + 1}`,
      level: 0,
      content: `<p>test in chapter ${i + 1}</p>`
    }));
    
    const start = Date.now();
    const results = await search.searchInBook('test', chapters);
    const duration = Date.now() - start;
    
    expect(results).toHaveLength(100);
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });

  it('should handle text near chapter boundaries', async () => {
    const chapters = [{
      id: '1',
      href: '1.xhtml',
      title: 'Chapter 1',
      level: 0,
      content: '<p>word at end of chapter</p>'
    }];
    const results = await search.searchInBook('end', chapters);
    
    expect(results).toHaveLength(1);
    // Check that excerpt handles boundary correctly
    expect(results[0].excerpt).toContain('end');
  });

  it('should handle matches at the very beginning', async () => {
    const chapters = [{
      id: '1',
      href: '1.xhtml',
      title: 'Chapter 1',
      level: 0,
      content: '<p>Start of content</p>'
    }];
    const results = await search.searchInBook('Start', chapters);
    
    expect(results).toHaveLength(1);
    expect(results[0].excerpt).not.toMatch(/^\.\.\./); // No leading ellipsis
  });

  it('should handle matches at the very end', async () => {
    const chapters = [{
      id: '1',
      href: '1.xhtml',
      title: 'Chapter 1',
      level: 0,
      content: '<p>End of content</p>'
    }];
    const results = await search.searchInBook('content', chapters);
    
    expect(results).toHaveLength(1);
    expect(results[0].excerpt).not.toMatch(/\.\.\.$/); // No trailing ellipsis
  });
});
```

### 6. Test XSS Prevention
```typescript
describe('useSearch XSS prevention', () => {
  it('should escape HTML in search query when creating regex', async () => {
    const chapters = [{
      id: '1',
      href: '1.xhtml',
      title: 'Chapter 1',
      level: 0,
      content: '<p>test content</p>'
    }];
    // Query contains HTML tags
    const results = await search.searchInBook('<script>alert(1)</script>', chapters);
    
    expect(results).toHaveLength(0); // Should not find HTML literal
  });

  it('should not execute scripts in excerpt', async () => {
    const chapters = [{
      id: '1',
      href: '1.xhtml',
      title: 'Chapter 1',
      level: 0,
      content: '<p>test</p>'
    }];
    const results = await search.searchInBook('test', chapters);
    
    // Excerpt should use mark tags, not script
    expect(results[0].excerpt).not.toContain('<script>');
  });

  it('should handle malicious HTML in chapter content', async () => {
    const chapters = [{
      id: '1',
      href: '1.xhtml',
      title: 'Chapter 1',
      level: 0,
      content: '<p>test<img src=x onerror=alert(1)></p>'
    }];
    const results = await search.searchInBook('test', chapters);
    
    // Text extraction should only get textContent
    expect(results[0].excerpt).toContain('test');
    expect(results[0].excerpt).not.toContain('onerror');
  });
});
```

## Expected Outcomes
- Full test coverage for search functionality
- XSS vulnerabilities identified and prevented
- Performance validated for large books
- Edge cases handled properly
- Coverage > 85% for useSearch.ts

## Dependencies
- Must complete "Missing Test Framework and Testing Infrastructure" issue first
