<script setup lang="ts">
import { useLibraryStore } from '@/stores/library';
import { useBookStore } from '@/stores/book';
import { useTheme } from '@/composables/useTheme';

const emit = defineEmits<{
  close: [];
}>();

const libraryStore = useLibraryStore();
const bookStore = useBookStore();
const { themeClasses } = useTheme();

async function openBook(metadata: any) {
  const blob = await libraryStore.getBookBlob(metadata.id);
  if (blob) {
    await bookStore.loadBook(
      new File([blob], metadata.title + '.epub', { type: 'application/epub+zip' })
    );
    emit('close');
  }
}

async function removeBook(id: string) {
  await libraryStore.removeBook(id);
  if (bookStore.metadata?.id === id) {
    bookStore.clearBook();
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}
</script>

<template>
  <div class="h-full flex flex-col" :class="themeClasses.bg">
    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="font-semibold">Library</h2>
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

    <div class="flex-1 overflow-y-auto p-4">
      <div v-if="libraryStore.books.length === 0" class="text-center py-8 text-gray-500">
        No books in library yet. Open an EPUB to add it.
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="book in libraryStore.books"
          :key="book.id"
          class="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer group"
          @click="openBook(book)"
        >
          <!-- Cover placeholder -->
          <div 
            class="w-12 h-16 flex-shrink-0 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center"
          >
            <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>

          <div class="flex-1 min-w-0">
            <h3 class="font-medium truncate" :class="themeClasses.text">
              {{ book.title }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 truncate">
              {{ book.author }}
            </p>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-xs text-gray-400">
                {{ formatDate(book.lastReadAt) }}
              </span>
              <span class="text-xs text-gray-400">
                {{ Math.round(book.progress) }}%
              </span>
            </div>
          </div>

          <button
            @click.stop="removeBook(book.id)"
            class="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-all"
            title="Remove from library"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div class="p-4 border-t border-gray-200 dark:border-gray-700">
      <button
        @click="libraryStore.clearLibrary()"
        class="w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
        :disabled="libraryStore.books.length === 0"
      >
        Clear Library
      </button>
    </div>
  </div>
</template>
