<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useBookStore } from '@/stores/book';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/composables/useTheme';

const bookStore = useBookStore();
const settingsStore = useSettingsStore();
const { themeClasses } = useTheme();

const contentRef = ref<HTMLDivElement | null>(null);
let scrollTimer: number | null = null;

const contentStyle = computed(() => ({
  fontSize: `${settingsStore.preferences.fontSize}px`,
  fontFamily: getFontFamily(settingsStore.preferences.fontFamily),
  lineHeight: settingsStore.preferences.lineHeight,
  padding: `${settingsStore.preferences.padding}px`,
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

function renderCurrentChapter() {
  if (!contentRef.value || !bookStore.currentBook) return;
  
  const chapter = bookStore.chapters[bookStore.currentChapter];
  if (!chapter) {
    contentRef.value.innerHTML = '<p class="text-center text-gray-500">No chapter content available.</p>';
    return;
  }
  
  contentRef.value.innerHTML = chapter.content || '<p class="text-center text-gray-500">Empty chapter.</p>';
  contentRef.value.scrollTop = 0;
}

watch(() => bookStore.currentChapter, () => {
  renderCurrentChapter();
});

onMounted(() => {
  renderCurrentChapter();
});

onUnmounted(() => {
  if (scrollTimer) clearTimeout(scrollTimer);
});
</script>

<template>
  <div class="flex justify-center">
    <div 
      ref="contentRef"
      class="w-full max-w-3xl min-h-screen overflow-y-auto scrollbar-thin"
      :class="[themeClasses.bg, themeClasses.text]"
      :style="contentStyle"
      @scroll="handleScroll"
    >
      <div class="py-8">
        <article 
          class="prose prose-lg max-w-none"
          :class="[
            themeClasses.prose,
            settingsStore.preferences.fontFamily === 'georgia' || settingsStore.preferences.fontFamily === 'campote' ? 'prose-serif' : 'prose-sans'
          ]"
        />
      </div>
    </div>
  </div>
</template>
