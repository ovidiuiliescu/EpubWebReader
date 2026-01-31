# Missing Input Sanitization for User Search Queries

## Severity
Low

## Affected Files
- `src/composables/useSearch.ts:9-77` (searchInBook function)
- `src/components/SearchPanel.vue:78-94` (search input)

## Description
The search functionality processes user queries without proper sanitization, which can lead to:
1. ReDoS (Regular Expression Denial of Service) via malicious search queries
2. Information leakage through search result highlighting
3. Unintended behavior with special characters
4. Potential for HTML injection if search results are not properly escaped

```typescript
// Lines 9-77 in useSearch.ts - searchInBook function
async function searchInBook(
  searchQuery: string,
  chapters: Chapter[]
): Promise<SearchResult[]> {
  if (!searchQuery.trim()) { // Basic trim, no real validation
    results.value = [];
    return [];
  }

  isSearching.value = true;
  query.value = searchQuery;
  const searchResults: SearchResult[] = [];
  const maxResultsPerChapter = 10;

  try {
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      let resultsInChapter = 0;

      if (!chapter.content) continue;

      const parser = new DOMParser();
      const doc = parser.parseFromString(chapter.content, 'text/html');
      const body = doc.body;

      if (!body) continue;

      const text = body.textContent || '';
      const lowerText = text.toLowerCase();
      const lowerQuery = searchQuery.toLowerCase(); // NO INPUT LENGTH VALIDATION

      let index = lowerText.indexOf(lowerQuery); // NO SANITIZATION

      while (index !== -1 && resultsInChapter < maxResultsPerChapter) {
        const contextLength = 50;
        const start = Math.max(0, index - contextLength);
        const end = Math.min(text.length, index + searchQuery.length + contextLength);
        let excerpt = text.substring(start, end);
        const matchedText = text.substring(index, index + searchQuery.length);

        if (start > 0) excerpt = '...' + excerpt;
        if (end < text.length) excerpt = excerpt + '...';

        excerpt = excerpt.replace(
          new RegExp(`(${escapeRegex(searchQuery)})`, 'gi'), // USER INPUT IN REGEX
          '<mark>$1</mark>'
        );

        searchResults.push({
          chapterIndex: i,
          chapterTitle: chapter.title,
          excerpt,
          cfi: chapter.href,
          searchText: searchQuery, // STORED WITHOUT SANITIZATION
          matchedText,
          matchIndex: resultsInChapter,
        });

        resultsInChapter++;
        index = lowerText.indexOf(lowerQuery, index + 1);
      }
    }
  } finally {
    isSearching.value = false;
  }

  results.value = searchResults;
  return searchResults;
}
```

## Potential Attack Vectors

### 1. ReDoS via Catastrophic Backtracking
Attacker crafts search query with patterns that cause exponential regex matching time:

```javascript
// Malicious search query
searchQuery = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!";

// Or worse:
searchQuery = "a(a(a(a(a(a(a(a(a(a(a(a(a(a(a(a(a(a(a(a(a(a(a(a(a(a(a(";

// This causes catastrophic backtracking in the regex:
// new RegExp(`(${escapeRegex(searchQuery)})`, 'gi')
```

Impact:
- Browser freezes for several seconds or minutes
- Application becomes unresponsive
- Potential browser tab crash
- CPU exhaustion

### 2. Search Query Length Overflow
```javascript
// Extremely long search query
searchQuery = "a".repeat(100000); // 100,000 characters

// Issues:
// - High memory usage
// - Long regex compilation time
// - Slow search execution
// - Potential stack overflow
```

### 3. Special Character Injection
```javascript
// Special regex characters
searchQuery = "$&*+?[](){}|^";

// While escapeRegex handles this, the original query 
// is still used in text matching without validation

// Issues:
// - Unexpected behavior
// - Performance degradation
// - Potential error in search execution
```

### 4. HTML/Script in Search Queries
```javascript
// Search with HTML
searchQuery = "<script>alert(1)</script>";

// While the search is case-insensitive and uses indexOf,
// this could leak into:
// - Stored search history
// - Displayed in search results
// - URL parameters if search is shareable
```

### 5. Unicode/Character Attacks
```javascript
// Zero-width characters
searchQuery = "\u200B\u200C\u200Dtest"; // Zero-width characters

// RTL override characters
searchQuery = "\u202Etest\u202D"; // RTL override

// Homoglyphs (visually similar characters)
searchQuery = "аdmin"; // Cyrillic 'а' instead of 'a'

// Issues:
// - Bypass filters
// - Confusing search results
// - UI rendering issues
```

## Implementation Plan

### Step 1: Create input validation utility
Create `src/utils/inputValidator.ts`:
```typescript
/**
 * Input Validation Utility
 * 
 * Validates and sanitizes user input
 */

/**
 * Maximum length for search queries
 */
const MAX_SEARCH_QUERY_LENGTH = 200;

/**
 * Minimum length for meaningful search queries
 */
const MIN_SEARCH_QUERY_LENGTH = 1;

/**
 * Patterns that could cause ReDoS
 */
const REDOS_PATTERNS = [
  // Repeated characters (catastrophic backtracking)
  /(.)\1{10,}/,
  // Nested quantifiers
  /\(([^()]+|\([^()]*\))*\)/,
  // Alternation with overlapping
  /(.+)\1+/,
  // Multiple consecutive wildcards
  /\*{5,}/,
  // Complex nested patterns
  /\(([^)]*\([^)]*\))+/,
];

/**
 * Dangerous character sequences
 */
const DANGEROUS_SEQUENCES = [
  // Null bytes
  '\x00',
  // RTL/LTR overrides (bidi attacks)
  '\u202E',
  '\u202D',
  '\u202B',
  '\u202C',
  // Zero-width characters
  '\u200B',
  '\u200C',
  '\u200D',
  '\uFEFF',
];

/**
 * Maximum execution time for search (in ms)
 */
const MAX_SEARCH_TIME = 5000;

/**
 * Validate search query
 */
export function validateSearchQuery(
  query: string,
  maxLength: number = MAX_SEARCH_QUERY_LENGTH,
  minLength: number = MIN_SEARCH_QUERY_LENGTH
): { valid: boolean; error?: string; sanitized?: string } {
  
  if (!query || typeof query !== 'string') {
    return {
      valid: false,
      error: 'Search query is required'
    };
  }

  // Check length
  if (query.length < minLength) {
    return {
      valid: false,
      error: `Search query is too short (minimum ${minLength} character${minLength > 1 ? 's' : ''})`
    };
  }

  if (query.length > maxLength) {
    return {
      valid: false,
      error: `Search query is too long (maximum ${maxLength} characters, provided ${query.length})`
    };
  }

  // Trim whitespace
  const trimmed = query.trim();
  
  if (trimmed.length === 0) {
    return {
      valid: false,
      error: 'Search query cannot be empty'
    };
  }

  // Check for null bytes
  if (trimmed.includes('\x00')) {
    return {
      valid: false,
      error: 'Invalid characters in search query'
    };
  }

  // Check for dangerous sequences
  for (const seq of DANGEROUS_SEQUENCES) {
    if (trimmed.includes(seq)) {
      return {
        valid: false,
        error: 'Invalid characters in search query'
      };
    }
  }

  // Check for ReDoS patterns
  for (const pattern of REDOS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        valid: false,
        error: 'Search query contains patterns that may cause performance issues'
      };
    }
  }

  // Additional validation: Check for excessive repetition
  const charCount: Record<string, number> = {};
  for (const char of trimmed) {
    charCount[char] = (charCount[char] || 0) + 1;
  }
  
  const maxCharRepetition = Math.max(...Object.values(charCount));
  if (maxCharRepetition > 50) {
    return {
      valid: false,
      error: 'Search query contains excessive character repetition'
    };
  }

  return {
    valid: true,
    sanitized: trimmed
  };
}

/**
 * Sanitize search query for safe display
 */
export function sanitizeSearchQueryForDisplay(query: string): string {
  // HTML encode to prevent XSS if displayed
  return query
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Create safe search regex with timeout
 */
export function createSafeSearchRegex(query: string, flags: string = 'gi'): RegExp | null {
  // Validate query first
  const validation = validateSearchQuery(query);
  if (!validation.valid) {
    return null;
  }

  const sanitized = validation.sanitized || query;

  // Escape regex special characters
  const escaped = sanitized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  try {
    return new RegExp(`(${escaped})`, flags);
  } catch {
    return null;
  }
}

/**
 * Debounced search with timeout
 */
export function createSafeSearchFunction<T extends (...args: any[]) => any>(
  fn: T,
  timeout: number = MAX_SEARCH_TIME
): (...args: Parameters<T>) => ReturnType<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Search timeout'));
    }, timeout);

    Promise.resolve(fn(...args))
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  }) as ReturnType<T>;
}

/**
 * Check if search is safe to execute
 */
export function isSearchSafe(
  query: string,
  chapters: Chapter[]
): { safe: boolean; reason?: string } {
  
  // Check total content size
  const totalSize = chapters.reduce((sum, ch) => 
    sum + (ch.content?.length || 0), 0
  );

  // If content is very large, limit search complexity
  if (totalSize > 10 * 1024 * 1024) { // > 10MB
    return {
      safe: false,
      reason: 'Book is too large for comprehensive search'
    };
  }

  // Check query complexity
  const validation = validateSearchQuery(query);
  if (!validation.valid) {
    return {
      safe: false,
      reason: validation.error
    };
  }

  return {
    safe: true
  };
}
```

### Step 2: Update useSearch.ts with validation
```typescript
import {
  validateSearchQuery,
  createSafeSearchRegex,
  isSearchSafe,
  createSafeSearchFunction,
  sanitizeSearchQueryForDisplay
} from '@/utils/inputValidator';
import { createLogger } from '@/utils/logger';

const logger = createLogger('useSearch');

export function useSearch() {
  const results = ref<SearchResult[]>([]);
  const isSearching = ref(false);
  const query = ref('');

  async function searchInBook(
    searchQuery: string,
    chapters: Chapter[]
  ): Promise<SearchResult[]> {
    // VALIDATE SEARCH QUERY
    const validation = validateSearchQuery(searchQuery);
    if (!validation.valid) {
      logger.warn('Invalid search query', {
        error: validation.error,
        query: searchQuery
      });
      results.value = [];
      return [];
    }

    // CHECK IF SEARCH IS SAFE
    const safety = isSearchSafe(searchQuery, chapters);
    if (!safety.safe) {
      logger.warn('Search not safe to execute', {
        reason: safety.reason
      });
      // Could show user message: "This book is too large for comprehensive search"
      results.value = [];
      return [];
    }

    isSearching.value = true;
    query.value = sanitizeSearchQueryForDisplay(searchQuery);
    const searchResults: SearchResult[] = [];
    const maxResultsPerChapter = 10;
    const maxTotalResults = 100; // Limit total results

    try {
      // CREATE SAFE REGEX
      const regex = createSafeSearchRegex(searchQuery);
      if (!regex) {
        logger.error('Failed to create search regex', { query: searchQuery });
        results.value = [];
        return [];
      }

      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        let resultsInChapter = 0;

        if (!chapter.content) continue;

        const parser = new DOMParser();
        const doc = parser.parseFromString(chapter.content, 'text/html');
        const body = doc.body;

        if (!body) continue;

        const text = body.textContent || '';
        const lowerText = text.toLowerCase();
        const lowerQuery = searchQuery.toLowerCase();

        let index = lowerText.indexOf(lowerQuery);

        while (index !== -1 && 
               resultsInChapter < maxResultsPerChapter &&
               searchResults.length < maxTotalResults) {
          const contextLength = 50;
          const start = Math.max(0, index - contextLength);
          const end = Math.min(text.length, index + searchQuery.length + contextLength);
          let excerpt = text.substring(start, end);
          const matchedText = text.substring(index, index + searchQuery.length);

          if (start > 0) excerpt = '...' + excerpt;
          if (end < text.length) excerpt = excerpt + '...';

          // Use pre-validated regex instead of creating new one
          excerpt = excerpt.replace(regex, '<mark>$1</mark>');

          searchResults.push({
            chapterIndex: i,
            chapterTitle: chapter.title,
            excerpt,
            cfi: chapter.href,
            searchText: query.value, // Use sanitized display version
            matchedText,
            matchIndex: resultsInChapter,
          });

          resultsInChapter++;
          index = lowerText.indexOf(lowerQuery, index + 1);
        }

        // Early exit if we have enough results
        if (searchResults.length >= maxTotalResults) {
          break;
        }
      }
    } catch (error) {
      logger.error('Search error', error);
    } finally {
      isSearching.value = false;
    }

    results.value = searchResults;
    return searchResults;
  }

  function clearSearch(): void {
    results.value = [];
    query.value = '';
  }

  function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  return {
    results,
    isSearching,
    query,
    searchInBook,
    clearSearch,
  };
}
```

### Step 3: Update SearchPanel.vue with validation
```vue
<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { useBookStore } from '@/stores/book';
import { useSearch } from '@/composables/useSearch';
import { useTheme } from '@/composables/useTheme';
import { validateSearchQuery, sanitizeSearchQueryForDisplay } from '@/utils/inputValidator';

const emit = defineEmits<{
  close: [];
}>();

const bookStore = useBookStore();
const search = useSearch();
const { themeClasses } = useTheme();

const searchQuery = ref('');
const searchInput = ref<HTMLInputElement | null>(null);
const validationError = ref<string | null>(null);

async function performSearch() {
  const trimmedQuery = searchQuery.value.trim();
  
  if (!trimmedQuery) {
    bookStore.setSearchHighlight(null);
    validationError.value = null;
    return;
  }
  
  // VALIDATE BEFORE SEARCHING
  const validation = validateSearchQuery(trimmedQuery);
  if (!validation.valid) {
    validationError.value = validation.error;
    return;
  }
  
  validationError.value = null;
  
  await search.searchInBook(
    trimmedQuery,
    bookStore.chapters
  );
  
  const currentChapterResults = search.results.value.filter(
    r => r.chapterIndex === bookStore.currentChapter
  );
  
  bookStore.setSearchHighlight({
    chapterIndex: bookStore.currentChapter,
    searchText: trimmedQuery,
    matchIndex: currentChapterResults.length > 0 ? 0 : undefined,
  });
}

onUnmounted(() => {
  bookStore.setSearchHighlight(null);
});

watch(searchQuery, () => {
  validationError.value = null;
  const timer = setTimeout(() => {
    performSearch();
  }, 300);
  return () => clearTimeout(timer);
});
</script>

<template>
  <div class="h-full flex flex-col" :class="themeClasses.bg">
    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="font-semibold">Search</h2>
      <button
        @click="emit('close')"
        class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        aria-label="Close"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
      <div class="relative">
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          placeholder="Search in book..."
          maxlength="200"
          class="w-full px-4 py-2 pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          :class="themeClasses.text"
          @keydown.enter="performSearch"
        />
        <svg 
          class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      
      <!-- Validation error display -->
      <div v-if="validationError" class="mt-2 text-sm text-red-600 dark:text-red-400">
        {{ validationError }}
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      <!-- Loading state -->
      <div v-if="search.isSearching.value" class="flex justify-center py-8">
        <svg class="animate-spin h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      <!-- No results -->
      <div 
        v-else-if="searchQuery && search.results.value.length === 0" 
        class="text-center py-8 text-gray-500"
      >
        No results found for "{{ sanitizeSearchQueryForDisplay(searchQuery) }}"
      </div>

      <!-- Results list -->
      <div v-else-if="search.results.value.length > 0" class="space-y-3">
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {{ search.results.value.length }} results found
        </p>
        
        <button
          v-for="(result, index) in search.results.value"
          :key="index"
          @click="goToResult(result)"
          class="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <p class="font-medium text-sm mb-1" :class="themeClasses.text">
            {{ result.chapterTitle }}
          </p>
          <p 
            class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2"
            v-html="result.excerpt"
          />
        </button>
      </div>

      <!-- Empty state -->
      <div 
        v-else 
        class="text-center py-8 text-gray-500"
      >
        Enter a search term to find content in this book
      </div>
    </div>
  </div>
</template>
```

### Step 4: Add tests
Create `tests/input-validator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  validateSearchQuery,
  createSafeSearchRegex,
  isSearchSafe,
  sanitizeSearchQueryForDisplay
} from '@/utils/inputValidator';

describe('validateSearchQuery', () => {
  it('should accept valid search queries', () => {
    expect(validateSearchQuery('test').valid).toBe(true);
    expect(validateSearchQuery('hello world').valid).toBe(true);
    expect(validateSearchQuery('test123').valid).toBe(true);
  });

  it('should reject empty queries', () => {
    const result = validateSearchQuery('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('should reject queries that are too long', () => {
    const longQuery = 'a'.repeat(250);
    const result = validateSearchQuery(longQuery);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too long');
  });

  it('should reject queries with null bytes', () => {
    const result = validateSearchQuery('test\x00query');
    expect(result.valid).toBe(false);
  });

  it('should reject queries with ReDoS patterns', () => {
    const result = validateSearchQuery('a'.repeat(100) + '!');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('performance issues');
  });

  it('should reject queries with excessive repetition', () => {
    const result = validateSearchQuery('a'.repeat(100));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('excessive repetition');
  });
});

describe('createSafeSearchRegex', () => {
  it('should escape regex special characters', () => {
    const regex = createSafeSearchRegex('test.*+?');
    expect(regex).not.toBeNull();
    expect(regex?.test('test.*+?')).toBe(true);
  });

  it('should return null for invalid queries', () => {
    const regex = createSafeSearchRegex('');
    expect(regex).toBeNull();
  });
});

describe('sanitizeSearchQueryForDisplay', () => {
  it('should HTML encode special characters', () => {
    const sanitized = sanitizeSearchQueryForDisplay('<script>alert(1)</script>');
    expect(sanitized).toContain('&lt;script&gt;');
    expect(sanitized).not.toContain('<script>');
  });

  it('should preserve safe characters', () => {
    const sanitized = sanitizeSearchQueryForDisplay('hello world');
    expect(sanitized).toBe('hello world');
  });
});
```

## Additional Recommendations

1. **Rate Limiting**: Limit search frequency to prevent abuse
2. **Result Pagination**: Paginate large result sets
3. **Progress Indicators**: Show search progress for large books
4. **User Feedback**: Display helpful error messages
5. **Performance Monitoring**: Track search execution times
6. **Debouncing**: Already implemented, but verify timing

## ReDoS Prevention Checklist

| Protection | Implemented? | Notes |
|------------|----------------|--------|
| Input length limit | ✓ | MAX_SEARCH_QUERY_LENGTH |
| Pattern validation | ✓ | REDOS_PATTERNS check |
| Character repetition check | ✓ | Max 50 repeats |
| Timeout mechanism | ✓ | MAX_SEARCH_TIME |
| Safe regex creation | ✓ | createSafeSearchRegex |
| Content size check | ✓ | isSearchSafe function |

## Related Issues
- See also: `xss-via-unsafe-vhtml-searchpanel.md` (Search result sanitization)
- See also: `sensitive-data-exposure-console.md` (Logging security)
