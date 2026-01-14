<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { useBookStore } from '@/stores/book';
import { useTheme } from '@/composables/useTheme';
import DropZone from './DropZone.vue';

const emit = defineEmits<{
  'select-book': [file: File, shouldCache: boolean, existingBookId?: string];
}>();

const libraryStore = useLibraryStore();
const bookStore = useBookStore();
const { themeClasses } = useTheme();

const coverUrls = ref<Map<string, string>>(new Map());

onMounted(async () => {
  await libraryStore.init();
  await loadCovers();
});

onUnmounted(() => {
  coverUrls.value.forEach((url) => {
    URL.revokeObjectURL(url);
  });
  coverUrls.value.clear();
});

async function loadCovers() {
  for (const book of libraryStore.books) {
    const cover = await libraryStore.getCoverImage(book.id);
    if (cover) {
      const url = URL.createObjectURL(cover);
      coverUrls.value.set(book.id, url);
    }
  }
}

async function openBook(metadata: any) {
  const blob = await libraryStore.getBookBlob(metadata.id);
  if (blob) {
    const file = new File([blob], `${metadata.title}.epub`, { type: 'application/epub+zip' });
    emit('select-book', file, false, metadata.id);
  }
}

async function exportBook(metadata: any) {
  const blob = await libraryStore.exportBook(metadata.id);
  if (blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata.title}.epub`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

async function removeBook(id: string) {
  await libraryStore.removeBook(id);
  if (bookStore.metadata?.id === id) {
    bookStore.clearBook();
  }
  if (coverUrls.value.has(id)) {
    URL.revokeObjectURL(coverUrls.value.get(id)!);
    coverUrls.value.delete(id);
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

function handleFileDrop(file: File) {
  emit('select-book', file, true);
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-950 flex flex-col">
    <div class="container mx-auto px-4 py-6 lg:py-8 flex-shrink-0">
      <header class="text-center mb-6 lg:mb-8">
        <h1 class="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent mb-3">
          EpubWebReader
        </h1>
        <p class="text-gray-600 dark:text-gray-400 text-lg">
          Your personal library in the cloud... wait, it's all local!
        </p>
      </header>
    </div>

    <div class="container mx-auto px-4 pb-6 lg:pb-8 flex-1 min-h-0">
      <div class="flex flex-col lg:flex-row gap-6 h-full min-h-0">
        <div class="lg:w-5/12 flex flex-col min-h-0">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 lg:p-8 border border-gray-200 dark:border-gray-700 flex flex-col h-full">
            <div class="flex items-center gap-3 mb-4 flex-shrink-0">
              <div class="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <svg class="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <h2 class="text-xl font-bold" :class="themeClasses.text">Add New Book</h2>
            </div>
            <DropZone @drop="handleFileDrop" compact />
          </div>
        </div>

        <div class="lg:w-7/12 flex flex-col min-h-0">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 lg:p-8 border border-gray-200 dark:border-gray-700 flex flex-col h-full">
            <div class="flex items-center justify-between mb-6 flex-shrink-0">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <svg class="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <div>
                  <h2 class="text-xl font-bold" :class="themeClasses.text">My Library</h2>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ libraryStore.books.length }} book{{ libraryStore.books.length !== 1 ? 's' : '' }}
                  </p>
                </div>
              </div>
            </div>

            <div class="flex-1 overflow-y-auto">
              <div
                v-if="libraryStore.books.length === 0"
                class="h-full flex flex-col items-center justify-center py-8 px-6 text-center"
              >
                <div class="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center mb-4">
                  <svg class="w-10 h-10 text-indigo-400 dark:text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                </div>
                <h3 class="text-base font-semibold mb-2" :class="themeClasses.text">Your library is empty</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Upload your first EPUB to get started
                </p>
              </div>

              <div
                v-else
                class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-4 lg:gap-6"
              >
                <div
                  v-for="book in libraryStore.books"
                  :key="book.id"
                  class="group relative bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer border border-gray-200 dark:border-gray-600"
                  @click="openBook(book)"
                >
                  <div class="aspect-[2/3] relative overflow-hidden">
                    <img
                      v-if="coverUrls.has(book.id)"
                      :src="coverUrls.get(book.id)"
                      :alt="book.title"
                      class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div
                      v-else
                      class="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 dark:from-indigo-600 dark:to-purple-700 flex items-center justify-center"
                    >
                      <svg class="w-20 h-20 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="1"
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                      </svg>
                    </div>

                    <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    <div class="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      <div class="flex gap-2">
                        <button
                          @click.stop="exportBook(book)"
                          class="flex-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm text-indigo-600 dark:text-indigo-400 px-3 py-2 rounded-lg text-sm font-medium hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-1 shadow-lg"
                          title="Export EPUB"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                          Export
                        </button>
                        <button
                          @click.stop="removeBook(book.id)"
                          class="flex-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm text-red-600 dark:text-red-400 px-3 py-2 rounded-lg text-sm font-medium hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-1 shadow-lg"
                          title="Remove from library"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="p-4">
                    <h3
                      class="font-semibold text-sm line-clamp-2 mb-1"
                      :class="themeClasses.text"
                    >
                      {{ book.title }}
                    </h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate mb-2">
                      {{ book.author }}
                    </p>
                    <div class="flex items-center justify-between text-xs">
                      <div class="flex items-center gap-1.5">
                        <div class="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                            :style="{ width: `${Math.round(book.progress)}%` }"
                          />
                        </div>
                        <span class="text-gray-500 dark:text-gray-400 font-medium">
                          {{ Math.round(book.progress) }}%
                        </span>
                      </div>
                      <span class="text-gray-400 dark:text-gray-500">
                        {{ formatDate(book.lastReadAt) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
