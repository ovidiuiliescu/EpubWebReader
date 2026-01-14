<script setup lang="ts">
import { ref, watch } from 'vue';
import { useBookStore } from '@/stores/book';
import { useSearch } from '@/composables/useSearch';
import { useTheme } from '@/composables/useTheme';

const emit = defineEmits<{
  close: [];
}>();

const bookStore = useBookStore();
const search = useSearch();
const { themeClasses } = useTheme();

const searchQuery = ref('');
const searchInput = ref<HTMLInputElement | null>(null);
const book = ref<any>(null);

async function performSearch() {
  if (!searchQuery.value.trim() || !book.value) return;
  
  await search.searchInBook(
    book.value,
    searchQuery.value,
    bookStore.chapters
  );
}

watch(searchQuery, () => {
  const timer = setTimeout(() => {
    performSearch();
  }, 300);
  return () => clearTimeout(timer);
});

function goToResult(result: any) {
  bookStore.setChapter(result.chapterIndex);
  emit('close');
}
</script>

<template>
  <div class="h-full flex flex-col" :class="themeClasses.bg">
    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="font-semibold">Search</h2>
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

    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
      <div class="relative">
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          placeholder="Search in book..."
          class="w-full px-4 py-2 pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          :class="themeClasses.text"
        />
        <svg 
          class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      <!-- Loading state -->
      <div v-if="search.isSearching.value" class="flex justify-center py-8">
        <svg class="animate-spin h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      <!-- No results -->
      <div 
        v-else-if="searchQuery && search.results.value.length === 0" 
        class="text-center py-8 text-gray-500"
      >
        No results found for "{{ searchQuery }}"
      </div>

      <!-- Results list -->
      <div v-else-if="search.results.value.length > 0" class="space-y-3">
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {{ search.results.value.length }} results found
        </p>
        
        <button
          v-for="(result, index) in search.results.value"
          :key="index"
          @click="goToResult(result)"
          class="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <p class="font-medium text-sm mb-1" :class="themeClasses.text">
            {{ result.chapterTitle }}
          </p>
          <p 
            class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2"
            v-html="result.excerpt"
          />
        </button>
      </div>

      <!-- Empty state -->
      <div 
        v-else 
        class="text-center py-8 text-gray-500"
      >
        Enter a search term to find content in this book
      </div>
    </div>
  </div>
</template>
