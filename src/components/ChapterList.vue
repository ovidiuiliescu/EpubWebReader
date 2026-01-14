<script setup lang="ts">
import { useBookStore } from '@/stores/book';
import { useTheme } from '@/composables/useTheme';

const emit = defineEmits<{
  close: [];
}>();

const bookStore = useBookStore();
const { themeClasses } = useTheme();

function selectChapter(index: number) {
  bookStore.setChapter(index);
  emit('close');
}
</script>

<template>
  <div class="h-full flex flex-col" :class="themeClasses.bg">
    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="font-semibold">Table of Contents</h2>
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

    <nav class="flex-1 overflow-y-auto p-4">
      <ul class="space-y-1">
        <li v-for="(chapter, index) in bookStore.chapters" :key="chapter.id">
          <button
            @click="selectChapter(index)"
            class="w-full text-left px-3 py-2 rounded-lg transition-colors duration-200"
            :class="[
              index === bookStore.currentChapter
                ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-medium'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            ]"
          >
            <span 
              class="block text-sm truncate"
              :style="{ paddingLeft: `${chapter.level * 16 + 8}px` }"
            >
              {{ chapter.title || `Chapter ${index + 1}` }}
            </span>
          </button>
        </li>
      </ul>

      <div v-if="bookStore.chapters.length === 0" class="text-center py-8 text-gray-500">
        No table of contents available
      </div>
    </nav>
  </div>
</template>
