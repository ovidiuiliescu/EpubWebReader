<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onUpdated, watch } from 'vue';
import { useBookStore } from '@/stores/book';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/composables/useTheme';

const bookStore = useBookStore();
const settingsStore = useSettingsStore();
const { themeClasses } = useTheme();

const contentRef = ref<HTMLDivElement | null>(null);
let scrollTimer: number | null = null;

const contentMaxWidth = computed(() => 
  settingsStore.preferences.wideMode ? 'max-w-5xl' : 'max-w-2xl'
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
    if (!contentRef.value || !bookStore.currentBook) return;
    
    const scrollTop = contentRef.value.scrollTop;
    const scrollHeight = contentRef.value.scrollHeight - contentRef.value.clientHeight;
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

function resetScroll() {
  if (contentRef.value) {
    contentRef.value.scrollTop = 0;
  }
}

function renderCurrentChapter() {
  if (!contentRef.value || !bookStore.currentBook) return;
  
  const chapter = bookStore.chapters[bookStore.currentChapter];
  if (!chapter) {
    contentRef.value.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">No chapter content available.</p>';
    resetScroll();
    return;
  }
  
  contentRef.value.innerHTML = chapter.content || '<p class="text-center text-gray-500 dark:text-gray-400">Empty chapter.</p>';
  resetScroll();
}

watch(() => bookStore.currentChapter, () => {
  renderCurrentChapter();
});

onUpdated(() => {
  resetScroll();
});

onMounted(() => {
  renderCurrentChapter();
});

onUnmounted(() => {
  if (scrollTimer) clearTimeout(scrollTimer);
});
</script>

<template>
  <div class="flex justify-center h-full py-6 px-4">
    <div 
      ref="contentRef"
      class="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
      :class="[contentMaxWidth, themeClasses.bg, themeClasses.text]"
      :style="contentStyle"
      @scroll="handleScroll"
    >
      <article 
        class="prose prose-lg max-w-none prose-p:leading-loose prose-p:mb-5 prose-headings:font-semibold prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-img:rounded-lg"
        :class="[
          themeClasses.prose,
          settingsStore.preferences.fontFamily === 'georgia' || settingsStore.preferences.fontFamily === 'campote' ? 'prose-serif' : 'prose-sans'
        ]"
      />
    </div>
  </div>
</template>
