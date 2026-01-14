<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { useBookStore } from '@/stores/book';
import { useTheme } from '@/composables/useTheme';

const emit = defineEmits<{
  close: [];
}>();

const libraryStore = useLibraryStore();
const bookStore = useBookStore();
const { themeClasses } = useTheme();

const fileInput = ref<HTMLInputElement | null>(null);
const coverUrls = ref<Map<string, string>>(new Map());
const isDragging = ref(false);

onMounted(async () => {
  if (!libraryStore.isInitialized) {
    await libraryStore.init();
  }
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

function handleDragOver(event: DragEvent) {
  event.preventDefault();
  isDragging.value = true;
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault();
  if (!event.relatedTarget || !(event.currentTarget as HTMLElement)?.contains(event.relatedTarget as Node)) {
    isDragging.value = false;
  }
}

async function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;

  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    await handleFileUpload(files[0]);
  }
}

async function openBook(metadata: any) {
  const blob = await libraryStore.getBookBlob(metadata.id);
  if (blob) {
    await bookStore.loadBook(
      new File([blob], metadata.title + '.epub', { type: 'application/epub+zip' }),
      false,
      metadata.id
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

async function handleFileUpload(file: File) {
  try {
    await bookStore.loadBook(file, true);
    emit('close');
  } catch (err) {
    console.error('Failed to load book:', err);
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    handleFileUpload(target.files[0]);
  }
}

function openFilePicker() {
  fileInput.value?.click();
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
  <div
    class="h-full flex flex-col"
    :class="themeClasses.bg"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-2">
        <h2 class="font-semibold">Library</h2>
        <span class="text-sm text-gray-500 dark:text-gray-400">
          ({{ libraryStore.books.length }})
        </span>
      </div>
      <div class="flex items-center gap-1">
        <button
          @click="openFilePicker"
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-indigo-600 dark:text-indigo-400"
          aria-label="Upload Book"
          title="Upload Book"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </button>
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
    </div>

    <div class="flex-1 overflow-y-auto relative">
      <div v-if="isDragging" class="absolute inset-0 z-10 bg-indigo-500/10 backdrop-blur-sm border-4 border-dashed border-indigo-500 rounded-lg flex items-center justify-center">
        <div class="text-center">
          <svg class="w-16 h-16 mx-auto text-indigo-600 dark:text-indigo-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p class="text-lg font-semibold text-indigo-600 dark:text-indigo-400">
            Drop your EPUB here to add it to the library
          </p>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
            or select a book from your collection
          </p>
        </div>
      </div>

      <div class="p-4">
        <div v-if="libraryStore.books.length === 0" class="text-center py-16">
          <div class="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center mx-auto mb-4">
            <svg class="w-10 h-10 text-indigo-400 dark:text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <h3 class="text-lg font-semibold mb-2" :class="themeClasses.text">Your library is empty</h3>
          <p class="text-gray-500 dark:text-gray-400 mb-2">
            Drop an EPUB file here or use the upload button to get started
          </p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="book in libraryStore.books"
            :key="book.id"
            class="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer group"
            @click="openBook(book)"
          >
            <div
              class="w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center"
            >
              <img
                v-if="coverUrls.has(book.id)"
                :src="coverUrls.get(book.id)"
                :alt="book.title"
                class="w-full h-full object-cover"
              />
              <svg
                v-else
                class="w-6 h-6 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>

            <div class="flex-1 min-w-0">
              <h3 class="font-medium truncate" :class="themeClasses.text">
                {{ book.title }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 truncate">
                {{ book.author }}
              </p>
              <div class="mt-2">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-xs text-gray-400">
                    {{ formatDate(book.lastReadAt) }}
                  </span>
                  <span class="text-xs text-gray-400">
                    {{ Math.round(book.progress) }}%
                  </span>
                </div>
                <div class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                    :style="{ width: `${Math.round(book.progress)}%` }"
                  />
                </div>
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

    <input
      ref="fileInput"
      type="file"
      accept=".epub,.EPUB"
      class="hidden"
      @change="handleFileSelect"
    />
  </div>
</template>
