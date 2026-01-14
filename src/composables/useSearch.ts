import { ref } from 'vue';
import type { SearchResult, Chapter } from '@/types/epub';

export function useSearch() {
  const results = ref<SearchResult[]>([]);
  const isSearching = ref(false);
  const query = ref('');

  async function searchInBook(
    searchQuery: string,
    chapters: Chapter[]
  ): Promise<SearchResult[]> {
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

        while (index !== -1 && resultsInChapter < maxResultsPerChapter) {
          const contextLength = 50;
          const start = Math.max(0, index - contextLength);
          const end = Math.min(text.length, index + searchQuery.length + contextLength);
          let excerpt = text.substring(start, end);
          const matchedText = text.substring(index, index + searchQuery.length);

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
