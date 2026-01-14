<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useBookStore } from '@/stores/book';
import { useLibraryStore } from '@/stores/library';
import DropZone from '@/components/DropZone.vue';
import BookViewer from '@/components/BookViewer.vue';
import Controls from '@/components/Controls.vue';
import ChapterList from '@/components/ChapterList.vue';
import SearchPanel from '@/components/SearchPanel.vue';
import LibraryPanel from '@/components/LibraryPanel.vue';
import { useTheme } from '@/composables/useTheme';

const bookStore = useBookStore();
const libraryStore = useLibraryStore();
const { themeClasses } = useTheme();

const showToc = ref(false);
const showSearch = ref(false);
const showLibrary = ref(false);

onMounted(() => {
  libraryStore.init();
});

function handleFileDrop(file: File) {
  if (file.name.endsWith('.epub') || file.name.endsWith('. EPUB')) {
    console.log('Loading file:', file.name);
    bookStore.loadBook(file).catch(err => {
      console.error('Failed to load book:', err);
    });
  } else {
    console.warn('Invalid file type:', file.name);
  }
}

function toggleToc() {
  showToc.value = !showToc.value;
  showSearch.value = false;
  showLibrary.value = false;
}

function toggleSearch() {
  showSearch.value = !showSearch.value;
  showToc.value = false;
  showLibrary.value = false;
}

function toggleLibrary() {
  showLibrary.value = !showLibrary.value;
  showToc.value = false;
  showSearch.value = false;
}

function closePanels() {
  showToc.value = false;
  showSearch.value = false;
  showLibrary.value = false;
}
</script>

<template>
  <div 
    :class="[
      'min-h-screen transition-colors duration-300',
      themeClasses.bg,
      themeClasses.text
    ]"
  >
    <!-- No Book Loaded State -->
    <DropZone 
      v-if="!bookStore.currentBook"
      @drop="handleFileDrop"
    />

    <!-- Loading State -->
    <div 
      v-else-if="bookStore.isLoading"
      class="flex flex-col items-center justify-center min-h-screen"
      :class="[themeClasses.bg, themeClasses.text]"
    >
      <svg class="animate-spin h-12 w-12 text-indigo-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-lg">Loading book...</p>
    </div>

    <!-- Book Loaded State -->
    <template v-else>
      <div class="flex flex-col h-screen">
        <!-- Top Controls -->
        <Controls
          @toggle-toc="toggleToc"
          @toggle-search="toggleSearch"
          @toggle-library="toggleLibrary"
        />

        <!-- Main Content Area -->
        <div class="flex flex-1 overflow-hidden">
          <!-- TOC Sidebar -->
          <aside
            v-if="showToc"
            class="fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl transition-transform duration-300"
            :class="themeClasses.bg"
          >
            <ChapterList @close="showToc = false" />
          </aside>

          <!-- Book Content -->
          <main
            class="flex-1 transition-all duration-300 overflow-hidden"
            :class="{ 'ml-72': showToc, 'mr-80': showSearch }"
          >
            <BookViewer />
          </main>

          <!-- Search Panel -->
          <div
            v-if="showSearch"
            class="fixed inset-y-0 right-0 z-50 w-80 overflow-y-auto border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl"
            :class="themeClasses.bg"
          >
            <SearchPanel @close="showSearch = false" />
          </div>

          <!-- Library Panel -->
          <div
            v-if="showLibrary"
            class="fixed inset-y-0 right-0 z-50 w-80 overflow-y-auto border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl"
            :class="themeClasses.bg"
          >
            <LibraryPanel @close="showLibrary = false" />
          </div>
        </div>
      </div>
    </template>

    <!-- Overlay for mobile when panels are open -->
    <div 
      v-if="showToc || showSearch || showLibrary"
      class="fixed inset-0 bg-black/50 z-40 lg:hidden"
      @click="closePanels"
    />
  </div>
</template>
