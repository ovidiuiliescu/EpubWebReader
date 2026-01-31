# Inefficient Search Implementation Parses All Chapters

## Severity
High

## Affected Files
- `src/composables/useSearch.ts:9-77`
- `src/composables/useSearch.ts:23-70`

## Description
The search implementation sequentially parses all chapter HTML content using DOMParser, which is extremely expensive for large books:

```typescript
async function searchInBook(searchQuery: string, chapters: Chapter[]): Promise<SearchResult[]> {
  const searchResults: SearchResult[] = [];
  const maxResultsPerChapter = 10;

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];

    if (!chapter.content) continue;

    const parser = new DOMParser(); // Expensive DOM parsing
    const doc = parser.parseFromString(chapter.content, 'text/html');
    const body = doc.body;

    if (!body) continue;

    const text = body.textContent || '';
    const lowerText = text.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();

    let index = lowerText.indexOf(lowerQuery);

    while (index !== -1 && resultsInChapter < maxResultsPerChapter) {
      // Find matches and extract context
      index = lowerText.indexOf(lowerQuery, index + 1);
    }
  }
}
```

Issues:
1. DOMParser is called for every chapter, even if chapters aren't loaded
2. Text content extraction from DOM is slow
3. Sequential processing blocks UI
4. No caching of search results
5. Search doesn't work with lazy-loaded chapters (requires all chapters in memory)
6. No support for fuzzy search or relevance scoring

## Impact on User Experience
- Very slow search operations (seconds for large books)
- UI freeze during search
- Can't search until all chapters are loaded
- Poor user experience for large EPUBs (hundreds of chapters)
- No partial/incremental search results shown

## Implementation Plan

### Option 1: Text-Based Search Without DOM Parsing (Recommended)

```typescript
// src/composables/useSearch.ts
async function searchInBook(searchQuery: string, chapters: Chapter[]): Promise<SearchResult[]> {
  if (!searchQuery.trim()) {
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

      // Skip chapters that aren't loaded
      if (!chapter.content) continue;

      // Use plain text search instead of DOM parsing
      const text = stripHtmlTags(chapter.content);
      const lowerText = text.toLowerCase();
      const lowerQuery = searchQuery.toLowerCase();

      let index = lowerText.indexOf(lowerQuery);
      let resultsInChapter = 0;

      while (index !== -1 && resultsInChapter < maxResultsPerChapter) {
        const contextLength = 50;
        const start = Math.max(0, index - contextLength);
        const end = Math.min(text.length, index + searchQuery.length + contextLength);
        let excerpt = text.substring(start, end);

        if (start > 0) excerpt = '...' + excerpt;
        if (end < text.length) excerpt = excerpt + '...';

        excerpt = excerpt.replace(
          new RegExp(`(${escapeRegex(searchQuery)})`, 'gi'),
          '<mark>$1</mark>'
        );

        searchResults.push({
          chapterIndex: i,
          chapterTitle: chapter.title,
          excerpt,
          cfi: chapter.href,
          searchText: searchQuery,
          matchedText: searchQuery,
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

// Helper function to strip HTML tags
function stripHtmlTags(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}
```

### Option 2: Build and Cache Search Index

```typescript
// Create a search index when book is loaded
let searchIndex: Map<string, { chapterIndex: number; title: string; text: string }> = new Map();

async function buildSearchIndex(chapters: Chapter[]) {
  searchIndex.clear();

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    if (chapter.content) {
      searchIndex.set(chapter.href, {
        chapterIndex: i,
        title: chapter.title,
        text: stripHtmlTags(chapter.content).toLowerCase()
      });
    }
  }
}

async function searchInBook(searchQuery: string, chapters: Chapter[]): Promise<SearchResult[]> {
  if (!searchQuery.trim()) {
    results.value = [];
    return [];
  }

  isSearching.value = true;
  query.value = searchQuery;
  const searchResults: SearchResult[] = [];
  const maxResultsPerChapter = 10;
  const lowerQuery = searchQuery.toLowerCase();

  try {
    // Use cached index for faster search
    for (const [href, data] of searchIndex) {
      let index = data.text.indexOf(lowerQuery);
      let resultsInChapter = 0;

      while (index !== -1 && resultsInChapter < maxResultsPerChapter) {
        const contextLength = 50;
        const start = Math.max(0, index - contextLength);
        const end = Math.min(data.text.length, index + searchQuery.length + contextLength);
        let excerpt = data.text.substring(start, end);

        if (start > 0) excerpt = '...' + excerpt;
        if (end < data.text.length) excerpt = excerpt + '...';

        excerpt = excerpt.replace(
          new RegExp(`(${escapeRegex(searchQuery)})`, 'gi'),
          '<mark>$1</mark>'
        );

        searchResults.push({
          chapterIndex: data.chapterIndex,
          chapterTitle: data.title,
          excerpt,
          cfi: href,
          searchText: searchQuery,
          matchedText: searchQuery,
          matchIndex: resultsInChapter,
        });

        resultsInChapter++;
        index = data.text.indexOf(lowerQuery, index + 1);
      }
    }
  } finally {
    isSearching.value = false;
  }

  results.value = searchResults;
  return searchResults;
}
```

### Option 3: Use Web Worker for Search

```typescript
// workers/search.worker.ts
self.onmessage = (e) => {
  const { query, chapters } = e.data;
  const results = performSearch(query, chapters);
  self.postMessage(results);
};

function performSearch(query: string, chapters: Chapter[]): SearchResult[] {
  const searchResults: SearchResult[] = [];
  const maxResultsPerChapter = 10;

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    if (!chapter.content) continue;

    const text = stripHtmlTags(chapter.content);
    // ... search logic
  }

  return searchResults;
}
```

### Option 4: Use a Dedicated Search Library

Consider using libraries like:
- `fuse.js` - Fuzzy search with scoring
- `lunr.js` - Full-text search with indexing
- `elasticlunr.js` - Lightweight search engine

```typescript
import Fuse from 'fuse.js';

const fuse = new Fuse(chapters, {
  keys: ['content'],
  threshold: 0.3, // Fuzzy matching
  includeMatches: true,
});

const results = fuse.search(searchQuery);
```

## Additional Optimizations
1. Incremental search results (show results as they're found)
2. Debounce search input to avoid excessive searches
3. Implement search result highlighting without DOM replacement
4. Add search history for quick re-search
5. Support regex searches
6. Show chapter names in search results
7. Highlight matches in context with more/less context options
8. Cache search results for common queries
9. Implement "search as you type" for short queries
10. Add option to search only current chapter vs entire book
