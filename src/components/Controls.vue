<script setup lang="ts">
import { computed } from 'vue';
import { useBookStore } from '@/stores/book';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/composables/useTheme';

const emit = defineEmits<{
  'toggle-toc': [];
  'toggle-search': [];
  'toggle-library': [];
}>();

const bookStore = useBookStore();
const settingsStore = useSettingsStore();
const { themeLabel, themeClasses } = useTheme();

const fontSizeLabel = computed(() => `${settingsStore.preferences.fontSize}px`);

function increaseFontSize() {
  settingsStore.setFontSize(settingsStore.preferences.fontSize + 2);
}

function decreaseFontSize() {
  settingsStore.setFontSize(settingsStore.preferences.fontSize - 2);
}

function cycleTheme() {
  useTheme().cycleTheme();
}
</script>

<template>
  <header 
    class="sticky top-0 z-30 border-b border-gray-200 dark:border-gray-700 backdrop-blur-sm bg-white/80 dark:bg-gray-900/80"
    :class="themeClasses.bg"
  >
    <div class="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
      <!-- Left: Title & Nav -->
      <div class="flex items-center space-x-4">
        <!-- Mobile: Simple nav indicator -->
        <div class="flex items-center space-x-2 sm:hidden">
          <button
            @click="bookStore.prevChapter()"
            :disabled="bookStore.currentChapter === 0"
            class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            :class="themeClasses.text"
            title="Previous chapter"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <span class="text-sm font-medium" :class="themeClasses.text">
            {{ bookStore.currentChapter + 1 }} / {{ bookStore.chapters.length }}
          </span>
          
          <button
            @click="bookStore.nextChapter()"
            :disabled="bookStore.currentChapter >= bookStore.chapters.length - 1"
            class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            :class="themeClasses.text"
            title="Next chapter"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <!-- Desktop: Title and nav -->
        <h1 class="text-lg font-semibold truncate max-w-[200px] hidden sm:block">
          {{ bookStore.metadata?.title || 'EpubWebReader' }}
        </h1>
        
        <div class="hidden sm:flex items-center space-x-2">
          <button
            @click="bookStore.prevChapter()"
            :disabled="bookStore.currentChapter === 0"
            class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Previous chapter"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <span class="text-sm text-gray-500 dark:text-gray-400">
            {{ bookStore.currentChapter + 1 }} / {{ bookStore.chapters.length }}
          </span>
          
          <button
            @click="bookStore.nextChapter()"
            :disabled="bookStore.currentChapter >= bookStore.chapters.length - 1"
            class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Next chapter"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Right: Controls -->
      <div class="flex items-center space-x-2">
        <!-- Font size controls -->
        <div class="hidden sm:flex items-center space-x-1 border-r border-gray-200 dark:border-gray-700 pr-3 mr-1">
          <button
            @click="decreaseFontSize"
            class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Decrease font size"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
            </svg>
          </button>
          
          <span class="w-12 text-center text-sm font-medium">{{ fontSizeLabel }}</span>
          
          <button
            @click="increaseFontSize"
            class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Increase font size"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        </div>

        <!-- Theme toggle -->
        <button
          @click="cycleTheme"
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          :title="`Current theme: ${themeLabel}`"
        >
          <svg v-if="settingsStore.preferences.theme === 'light'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <svg v-else-if="settingsStore.preferences.theme === 'dark'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
          <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </button>

        <!-- Wide mode toggle -->
        <button
          @click="settingsStore.toggleWideMode()"
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 hidden sm:block"
          :title="settingsStore.preferences.wideMode ? 'Wide screen mode on' : 'Wide screen mode off'"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>

        <!-- Search button -->
        <button
          @click="emit('toggle-search')"
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Search"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>

        <!-- TOC button -->
        <button
          @click="emit('toggle-toc')"
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Table of contents"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <!-- Library button -->
        <button
          @click="emit('toggle-library')"
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Library"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Progress bar -->
    <div class="h-1 bg-gray-200 dark:bg-gray-700">
      <div 
        class="h-full bg-indigo-600 transition-all duration-300"
        :style="{ width: `${bookStore.metadata?.progress || 0}%` }"
      />
    </div>
  </header>
</template>
