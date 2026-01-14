import { defineStore } from 'pinia';
import { ref } from 'vue';
import { openDB, type IDBPDatabase } from 'idb';
import type { BookMetadata } from '@/types/epub';

const DB_NAME = 'epub-web-reader';
const DB_VERSION = 1;
const MAX_CACHED_BOOKS = 10;

interface CachedBook {
  id: string;
  metadata: BookMetadata;
  epubBlob: Blob;
  addedAt: Date;
}

export const useLibraryStore = defineStore('library', () => {
  const books = ref<BookMetadata[]>([]);
  const db = ref<IDBPDatabase<{ books: CachedBook }> | null>(null);
  const isInitialized = ref(false);

  async function init(): Promise<void> {
    if (isInitialized.value) return;

    db.value = await openDB<{ books: CachedBook }>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('books')) {
          const store = database.createObjectStore('books', { keyPath: 'id' });
          store.createIndex('addedAt', 'addedAt');
        }
      },
    });

    await loadBooks();
    isInitialized.value = true;
  }

  async function loadBooks(): Promise<void> {
    if (!db.value) return;

    const cached = await db.value.getAll('books');
    books.value = cached
      .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
      .map(book => book.metadata);
  }

  async function cacheBook(metadata: BookMetadata, epubBlob: Blob): Promise<void> {
    if (!db.value) return;

    const existing = await db.value.get('books', metadata.id);
    if (existing) {
      await db.value.put('books', { ...existing, metadata });
    } else {
      await checkCacheLimit();
      await db.value.add('books', {
        id: metadata.id,
        metadata,
        epubBlob,
        addedAt: new Date(),
      });
    }

    await loadBooks();
  }

  async function removeBook(id: string): Promise<void> {
    if (!db.value) return;
    await db.value.delete('books', id);
    await loadBooks();
  }

  async function getBookBlob(id: string): Promise<Blob | null> {
    if (!db.value) return null;
    const book = await db.value.get('books', id);
    return book?.epubBlob || null;
  }

  async function checkCacheLimit(): Promise<void> {
    if (!db.value) return;

    const count = await db.value.count('books');
    if (count >= MAX_CACHED_BOOKS) {
      const allBooks = await db.value.getAllFromIndex('books', 'addedAt');
      if (allBooks.length > 0) {
        const oldest = allBooks[0];
        await db.value.delete('books', oldest.id);
      }
    }
  }

  async function clearLibrary(): Promise<void> {
    if (!db.value) return;
    await db.value.clear('books');
    books.value = [];
  }

  return {
    books,
    isInitialized,
    init,
    cacheBook,
    removeBook,
    getBookBlob,
    clearLibrary,
  };
});
