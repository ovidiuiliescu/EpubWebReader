<script setup lang="ts">
import { ref, computed, onUnmounted, nextTick, watchEffect } from 'vue';
import { useBookStore } from '@/stores/book';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/composables/useTheme';

const bookStore = useBookStore();
const settingsStore = useSettingsStore();
const { themeClasses } = useTheme();

const containerRef = ref<HTMLDivElement | null>(null);
const articleRef = ref<HTMLDivElement | null>(null);
let scrollTimer: number | null = null;

const contentWidth = computed(() => 
  settingsStore.preferences.wideMode ? 'max-w-full' : 'max-w-2xl'
);

const contentStyle = computed(() => ({
  fontSize: `${settingsStore.preferences.fontSize}px`,
  fontFamily: getFontFamily(settingsStore.preferences.fontFamily),
  lineHeight: settingsStore.preferences.lineHeight,
}));

function getFontFamily(font: string): string {
  const fonts: Record<string, string> = {
    georgia: 'Georgia, Cambria, "Times New Roman", serif',
    campote: '"Campote", Georgia, serif',
    arial: 'Arial, Helvetica, sans-serif',
    verdana: 'Verdana, Arial, sans-serif',
  };
  return fonts[font] || fonts.georgia;
}

function handleScroll() {
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = window.setTimeout(() => {
    if (!containerRef.value || !bookStore.currentBook) return;
    
    const scrollTop = containerRef.value.scrollTop;
    const scrollHeight = containerRef.value.scrollHeight - containerRef.value.clientHeight;
    const percentage = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    
    bookStore.updateProgress({
      bookId: bookStore.metadata!.id,
      cfi: '',
      scrollPosition: scrollTop,
      chapterIndex: bookStore.currentChapter,
      percentage: Math.round(percentage),
      timestamp: new Date(),
    });
  }, 500);
}

function renderCurrentChapter() {
  if (!articleRef.value || !bookStore.currentBook) return;
  
  const chapter = bookStore.chapters[bookStore.currentChapter];
  if (!chapter) {
    articleRef.value.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">No chapter content available.</p>';
    return;
  }
  
  articleRef.value.innerHTML = chapter.content || '<p class="text-center text-gray-500 dark:text-gray-400">Empty chapter.</p>';
}

watchEffect(() => {
  if (articleRef.value && bookStore.currentBook && bookStore.chapters.length > 0) {
    nextTick(() => renderCurrentChapter());
  }
});

onUnmounted(() => {
  if (scrollTimer) clearTimeout(scrollTimer);
});
</script>

<template>
  <div class="flex justify-center h-full py-6 px-4">
    <div
      :key="bookStore.currentChapter"
      ref="containerRef"
      class="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent scroll-smooth"
      :class="[contentWidth, themeClasses.bg, themeClasses.text]"
      @scroll="handleScroll"
    >
      <div
        ref="articleRef"
        class="prose max-w-none prose-p:leading-loose prose-p:mb-5 prose-headings:font-semibold prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-img:rounded-lg"
        :class="themeClasses.prose"
        :style="contentStyle"
      />
    </div>
  </div>
</template>
