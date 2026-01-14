import { ref } from 'vue';
import type { SearchResult } from '@/types/epub';

export function useSearch() {
  const results = ref<SearchResult[]>([]);
  const isSearching = ref(false);
  const query = ref('');

  async function searchInBook(
    book: any,
    searchQuery: string,
    chapters: Array<{ href: string; title: string }>
  ): Promise<SearchResult[]> {
    if (!searchQuery.trim()) {
      results.value = [];
      return [];
    }

    isSearching.value = true;
    query.value = searchQuery;
    const searchResults: SearchResult[] = [];

    try {
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        
        try {
          const chapterDoc = await book.loaded.navigation.get(chapter.href);
          if (chapterDoc && chapterDoc.document) {
            const text = chapterDoc.document.body.textContent || '';
            const lowerText = text.toLowerCase();
            const lowerQuery = searchQuery.toLowerCase();
            
            let index = lowerText.indexOf(lowerQuery);
          while (index !== -1) {
              const start = Math.max(0, index - 50);
              const end = Math.min(text.length, index + searchQuery.length + 50);
              let excerpt = text.substring(start, end);
              
              if (start > 0) excerpt = '...' + excerpt;
              if (end < text.length) excerpt = excerpt + '...';
              
              excerpt = excerpt.replace(
                new RegExp(`(${escapeRegex(searchQuery)})`, 'gi'),
                '<mark>$1</mark>'
              );

              const cfi = chapterDoc.href;

              searchResults.push({
                chapterIndex: i,
                chapterTitle: chapter.title,
                excerpt,
                cfi,
              });

              index = lowerText.indexOf(lowerQuery, index + 1);
            }
          }
        } catch {
          console.warn(`Failed to search chapter: ${chapter.title}`);
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
