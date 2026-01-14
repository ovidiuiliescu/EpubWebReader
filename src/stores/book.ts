import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { EpubBook, ReadingProgress, SearchHighlight } from '@/types/epub';

export const useBookStore = defineStore('book', () => {
  const currentBook = ref<EpubBook | null>(null);
  const currentChapter = ref<number>(0);
  const isLoading = ref(false);
  const error = ref<Error | null>(null);
  const readingProgress = ref<Map<string, ReadingProgress>>(new Map());
  const searchHighlight = ref<SearchHighlight | null>(null);

  const metadata = computed(() => currentBook.value?.metadata);
  const chapters = computed(() => currentBook.value?.chapters || []);
  const toc = computed(() => currentBook.value?.toc || []);
  const currentChapterData = computed(() => 
    currentBook.value?.chapters[currentChapter.value]
  );

  async function loadBook(file: File): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const { epub } = await import('@/composables/useEpub');
      const book = await epub.loadEpub(file);
      currentBook.value = book;
      currentChapter.value = 0;
      
      const savedProgress = readingProgress.value.get(book.metadata.id);
      if (savedProgress) {
        currentChapter.value = savedProgress.chapterIndex;
      }
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Failed to load book');
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  function setChapter(index: number): void {
    if (index >= 0 && index < chapters.value.length) {
      currentChapter.value = index;
    }
  }

  function nextChapter(): void {
    if (currentChapter.value < chapters.value.length - 1) {
      currentChapter.value++;
    }
  }

  function prevChapter(): void {
    if (currentChapter.value > 0) {
      currentChapter.value--;
    }
  }

  function updateProgress(session: ReadingProgress): void {
    readingProgress.value.set(session.bookId, session);
    if (currentBook.value) {
      currentBook.value.metadata.progress = session.percentage;
      currentBook.value.metadata.lastReadAt = new Date();
      currentBook.value.metadata.currentChapter = session.chapterIndex;
    }
  }

  function clearBook(): void {
    currentBook.value = null;
    currentChapter.value = 0;
    error.value = null;
  }

  function setSearchHighlight(highlight: SearchHighlight | null): void {
    searchHighlight.value = highlight;
  }

  return {
    currentBook,
    currentChapter,
    isLoading,
    error,
    metadata,
    chapters,
    toc,
    currentChapterData,
    searchHighlight,
    loadBook,
    setChapter,
    nextChapter,
    prevChapter,
    updateProgress,
    clearBook,
    setSearchHighlight,
  };
});
