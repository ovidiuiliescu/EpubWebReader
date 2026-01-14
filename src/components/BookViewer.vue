<script setup lang="ts">
import { ref, computed, onUnmounted, nextTick, watchEffect, watch } from 'vue';
import { useBookStore } from '@/stores/book';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/composables/useTheme';

const bookStore = useBookStore();
const settingsStore = useSettingsStore();
const { themeClasses } = useTheme();

const containerRef = ref<HTMLDivElement | null>(null);
const articleRef = ref<HTMLDivElement | null>(null);
let scrollTimer: number | null = null;
let settingsTimer: number | null = null;
let hasRestoredScrollPosition = false;

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
  scrollTimer = window.setTimeout(async () => {
    if (!containerRef.value || !bookStore.currentBook) return;

    const scrollTop = containerRef.value.scrollTop;
    const scrollHeight = containerRef.value.scrollHeight - containerRef.value.clientHeight;
    const currentChapterProgress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
    const totalChapters = bookStore.chapters.length;
    
    const overallProgress = totalChapters > 0 
      ? ((bookStore.currentChapter + currentChapterProgress) / totalChapters) * 100 
      : 0;

    await bookStore.updateProgress({
      bookId: bookStore.metadata!.id,
      cfi: '',
      scrollPosition: scrollTop,
      chapterIndex: bookStore.currentChapter,
      percentage: Math.round(overallProgress),
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

  let content = chapter.content || '<p class="text-center text-gray-500 dark:text-gray-400">Empty chapter.</p>';

  if (bookStore.searchHighlight && bookStore.searchHighlight.chapterIndex === bookStore.currentChapter) {
    content = highlightSearchText(content, bookStore.searchHighlight.searchText);
  }

  articleRef.value.innerHTML = content;

  if (!hasRestoredScrollPosition && bookStore.currentScrollPosition > 0) {
    containerRef.value!.scrollTop = bookStore.currentScrollPosition;
    hasRestoredScrollPosition = true;
  }

  if (bookStore.searchHighlight && bookStore.searchHighlight.chapterIndex === bookStore.currentChapter) {
    nextTick(() => scrollToFirstHighlight());
  }
}

function highlightSearchText(html: string, searchText: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;

  if (!body) return html;

  const regex = new RegExp(`(${escapeRegex(searchText)})`, 'gi');
  const walker = document.createTreeWalker(
    body,
    NodeFilter.SHOW_TEXT,
    null
  );

  const nodesToReplace: { node: Text; parent: Node }[] = [];
  let node: Node | null;

  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      if (regex.test(textNode.textContent || '')) {
        const parent = textNode.parentNode;
        if (parent && parent.nodeName !== 'SCRIPT' && parent.nodeName !== 'STYLE') {
          nodesToReplace.push({ node: textNode, parent });
        }
      }
    }
  }

  let matchCount = 0;
  const targetIndex = bookStore.searchHighlight?.matchIndex ?? 0;

  for (const { node, parent } of nodesToReplace) {
    const matches = (node.textContent || '').matchAll(regex);
    const parts: (string | HTMLElement)[] = [];
    let lastIndex = 0;

    for (const match of matches) {
      if (match.index !== undefined) {
        parts.push(node.textContent!.substring(lastIndex, match.index));
        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        if (matchCount === targetIndex) {
          mark.classList.add('active');
        }
        mark.textContent = match[0];
        parts.push(mark);
        lastIndex = match.index + match[0].length;
        matchCount++;
      }
    }

    if (lastIndex < (node.textContent || '').length) {
      parts.push(node.textContent!.substring(lastIndex));
    }

    const span = document.createElement('span');
    parts.forEach(part => {
      if (typeof part === 'string') {
        span.appendChild(document.createTextNode(part));
      } else {
        span.appendChild(part);
      }
    });
    parent.replaceChild(span, node);
  }

  return body.innerHTML;
}

function scrollToFirstHighlight() {
  const highlights = articleRef.value?.querySelectorAll('.search-highlight');
  if (highlights && highlights.length > 0) {
    const targetIndex = bookStore.searchHighlight?.matchIndex ?? 0;
    const targetHighlight = highlights[Math.min(targetIndex, highlights.length - 1)];
    if (targetHighlight) {
      targetHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

watchEffect(() => {
  if (articleRef.value && bookStore.currentBook && bookStore.chapters.length > 0) {
    nextTick(() => renderCurrentChapter());
  }
});

watch(
  () => bookStore.searchHighlight,
  () => {
    if (articleRef.value) {
      nextTick(() => renderCurrentChapter());
    }
  }
);

watch(
  () => bookStore.currentChapter,
  async () => {
    if (!bookStore.currentBook) return;
    const totalChapters = bookStore.chapters.length;
    const overallProgress = totalChapters > 0 
      ? ((bookStore.currentChapter / totalChapters) * 100)
      : 0;

    await bookStore.updateProgress({
      bookId: bookStore.metadata!.id,
      cfi: '',
      scrollPosition: 0,
      chapterIndex: bookStore.currentChapter,
      percentage: Math.round(overallProgress),
      timestamp: new Date(),
    });
  }
);

watch(
  () => [
    settingsStore.preferences.wideMode,
    settingsStore.preferences.fontSize,
    settingsStore.preferences.fontFamily,
    settingsStore.preferences.lineHeight,
  ],
  () => {
    if (settingsTimer) clearTimeout(settingsTimer);
    settingsTimer = window.setTimeout(async () => {
      if (!containerRef.value || !bookStore.currentBook) return;
      
      await nextTick();
      
      const scrollTop = containerRef.value.scrollTop;
      const scrollHeight = containerRef.value.scrollHeight - containerRef.value.clientHeight;
      const currentChapterProgress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
      const totalChapters = bookStore.chapters.length;
      
      const overallProgress = totalChapters > 0 
        ? ((bookStore.currentChapter + currentChapterProgress) / totalChapters) * 100 
        : 0;

      await bookStore.updateProgress({
        bookId: bookStore.metadata!.id,
        cfi: '',
        scrollPosition: scrollTop,
        chapterIndex: bookStore.currentChapter,
        percentage: Math.round(overallProgress),
        timestamp: new Date(),
      });
    }, 500);
  }
);

onUnmounted(() => {
  if (scrollTimer) clearTimeout(scrollTimer);
  if (settingsTimer) clearTimeout(settingsTimer);
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
