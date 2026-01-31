# HomeScreen Component - Too Large with Multiple Responsibilities

## Severity: Medium

## Affected Files
- `src/components/HomeScreen.vue:1-342`

## Description
The `HomeScreen.vue` component is a 342-line file that handles multiple responsibilities:

1. **Library Initialization**: `onMounted` hook initializes library store (lines 19-22)
2. **Cover Image Management**: Loading and caching cover images (lines 15-16, 31-39, 24-29)
3. **Book Operations**: Opening, exporting, removing books (lines 41-61, 49-61, 63-72)
4. **Drag and Drop Handling**: File drag/drop events (lines 82-92)
5. **File Upload**: File input management (lines 15, 104-108, 111-113)
6. **Date Formatting**: Formatting dates for display (lines 74-80)
7. **Template Rendering**: Large template with library grid, empty states, drag overlays (lines 116-341)

## Why This Is Problematic
- **Violates SRP**: Single component handles library management, file upload, cover loading, and rendering
- **Poor Testability**: Hard to unit test individual responsibilities
- **Maintenance Difficulty**: Changes to one feature risk breaking others
- **Large File**: 342 lines makes it hard to navigate and understand
- **Mixed Concerns**: Business logic mixed with presentation
- **Reusability**: Cannot reuse components (e.g., cover loading) elsewhere

## Implementation Plan

### Step 1: Extract Book Card Component

Create `src/components/BookCard.vue`:
```vue
<script setup lang="ts">
import { ref } from 'vue';
import type { BookMetadata } from '@/types/epub';

interface Props {
  book: BookMetadata;
  coverUrl?: string;
}

interface Emits {
  'open': [book: BookMetadata];
  'export': [book: BookMetadata];
  'remove': [id: string];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const isHovered = ref(false);

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

function handleOpen() {
  emit('open', props.book);
}

function handleExport(event: Event) {
  event.stopPropagation();
  emit('export', props.book);
}

function handleRemove(event: Event) {
  event.stopPropagation();
  emit('remove', props.book.id);
}
</script>

<template>
  <div
    class="relative rounded-xl overflow-hidden h-full"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <div
      class="absolute inset-0 -z-10 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 shadow-md group-hover:shadow-2xl transition-all duration-300 group-hover:-translate-y-1"
    />
    <div
      class="group relative z-10 cursor-pointer border border-gray-200 dark:border-gray-600 rounded-xl transition-all duration-300 hover:-translate-y-1"
      @click="handleOpen"
    >
      <div class="aspect-[2/3] relative overflow-hidden bg-gray-100 dark:bg-gray-700">
        <img
          v-if="coverUrl"
          :src="coverUrl"
          :alt="book.title"
          class="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
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

        <div class="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <div class="flex gap-1">
            <button
              @click="handleExport"
              class="flex-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm text-indigo-600 dark:text-indigo-400 px-2 py-1.5 rounded text-xs font-medium hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-0.5 shadow-lg"
              title="Export EPUB"
            >
              <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </button>
            <button
              @click="handleRemove"
              class="flex-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm text-red-600 dark:text-red-400 px-2 py-1.5 rounded text-xs font-medium hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-0.5 shadow-lg"
              title="Remove from library"
            >
              <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="p-4">
        <h3
          class="font-semibold text-sm line-clamp-2 mb-1 min-h-[2.5rem]"
          :title="book.title"
        >
          {{ book.title }}
        </h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 truncate mb-2">
          {{ book.author }}
        </p>
        <div class="flex items-center gap-1.5 text-xs">
          <div class="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
              :style="{ width: `${Math.round(book.progress)}%` }"
            />
          </div>
          <span class="text-gray-500 dark:text-gray-400 font-medium">
            {{ Math.round(book.progress) }}%
          </span>
        </div>
        <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {{ formatDate(book.lastReadAt) }}
        </div>
      </div>
    </div>
  </div>
</template>
```

### Step 2: Extract Empty State Component

Create `src/components/EmptyLibraryState.vue`:
```vue
<script setup lang="ts">
import type { ThemeClasses } from '@/types/props';

interface Props {
  themeClasses: ThemeClasses;
}

defineProps<Props>();
</script>

<template>
  <div class="h-full flex flex-col items-center justify-center py-8 px-6 text-center">
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
</template>
```

### Step 3: Extract Library Header Component

Create `src/components/LibraryHeader.vue`:
```vue
<script setup lang="ts">
import type { ThemeClasses } from '@/types/props';

interface Props {
  themeClasses: ThemeClasses;
  bookCount: number;
}

interface Emits {
  'add-book': [];
}

defineProps<Props>();
const emit = defineEmits<Emits>();

function handleAddBook() {
  emit('add-book');
}
</script>

<template>
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
          {{ bookCount }} book{{ bookCount !== 1 ? 's' : '' }}
        </p>
      </div>
    </div>
    <button
      @click="handleAddBook"
      class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
      title="Add Book to Library"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 4v16m8-8H4"
        />
      </svg>
      Add Book
    </button>
  </div>
</template>
```

### Step 4: Extract Drag Overlay Component

Create `src/components/DragOverlay.vue`:
```vue
<script setup lang="ts">
interface Props {
  message?: string;
}

withDefaults(defineProps<Props>(), {
  message: 'Drop your EPUB here to add it to the library',
});
</script>

<template>
  <div class="absolute inset-0 z-10 bg-indigo-500/10 backdrop-blur-sm rounded-2xl flex items-center justify-center">
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
        {{ message }}
      </p>
    </div>
  </div>
</template>
```

### Step 5: Refactor HomeScreen.vue

Update `src/components/HomeScreen.vue` to use extracted components:
```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { useBookStore } from '@/stores/book';
import { useCoverImages } from '@/composables/useCoverImages';
import { useTheme } from '@/composables/useTheme';
import BookCard from '@/components/BookCard.vue';
import EmptyLibraryState from '@/components/EmptyLibraryState.vue';
import LibraryHeader from '@/components/LibraryHeader.vue';
import DragOverlay from '@/components/DragOverlay.vue';

const emit = defineEmits<{
  'select-book': [file: File, shouldCache: boolean, existingBookId?: string];
}>();

const libraryStore = useLibraryStore();
const bookStore = useBookStore();
const { themeClasses } = useTheme();
const { coverUrls, loadCovers } = useCoverImages();

const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

onMounted(async () => {
  await libraryStore.init();
  await loadCovers();
});

onUnmounted(() => {
  // Cleanup handled by useCoverImages composable
});

async function openBook(metadata: BookMetadata) {
  const blob = await libraryStore.getBookBlob(metadata.id);
  if (blob) {
    const file = new File([blob], `${metadata.title}.epub`, { type: 'application/epub+zip' });
    emit('select-book', file, false, metadata.id);
  }
}

async function exportBook(metadata: BookMetadata) {
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

function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;

  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    emit('select-book', files[0], true);
  }
}

function handleLibraryFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    emit('select-book', target.files[0], true);
  }
}

function openLibraryFilePicker() {
  fileInput.value?.click();
}

function handleAddBook() {
  openLibraryFilePicker();
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
      <div class="flex h-full min-h-0">
        <div class="w-full flex flex-col min-h-0">
          <div
            class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 lg:p-8 border border-gray-200 dark:border-gray-700 flex flex-col h-full relative"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
            :class="{ 'ring-4 ring-indigo-500': isDragging }"
          >
            <LibraryHeader
              :theme-classes="themeClasses"
              :book-count="libraryStore.books.length"
              @add-book="handleAddBook"
            />

            <DragOverlay v-if="isDragging" />

            <div v-else-if="libraryStore.books.length > 0" class="absolute inset-0 pointer-events-none opacity-5 flex items-center justify-center">
              <div class="text-center">
                <svg class="w-32 h-32 mx-auto text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="0.5"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
            </div>

            <div class="flex-1 overflow-y-auto">
              <EmptyLibraryState
                v-if="libraryStore.books.length === 0"
                :theme-classes="themeClasses"
              />

              <div
                v-else
                class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 lg:gap-4"
              >
                <BookCard
                  v-for="book in libraryStore.books"
                  :key="book.id"
                  :book="book"
                  :cover-url="coverUrls.get(book.id)"
                  @open="openBook"
                  @export="exportBook"
                  @remove="removeBook"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".epub,.EPUB"
      class="hidden"
      @change="handleLibraryFileSelect"
    />
  </div>
</template>
```

### Step 6: Benefits After Refactoring
- **Smaller Files**: HomeScreen reduced from 342 to ~150 lines
- **Better Separation**: Each component has single responsibility
- **Improved Testability**: Individual components can be tested in isolation
- **Better Reusability**: BookCard can be reused elsewhere
- **Easier Maintenance**: Changes to book display don't affect library logic
- **Cleaner Code**: Each file is easier to understand and navigate

### Step 7: Additional Future Improvements
- Extract book operations (open, export, remove) to a composable
- Create separate composable for library initialization
- Add loading states to individual components
