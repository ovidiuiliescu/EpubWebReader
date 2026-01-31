# Missing ARIA announcements for chapter changes

## Severity
Medium

## Affected Files
- `src/components/BookViewer.vue` (lines 329-346, 141-166)

## Detailed Description
The BookViewer component dynamically renders chapter content without providing any ARIA announcements when the chapter changes. When a user navigates to a new chapter, the content updates silently, and screen reader users are not notified of:

1. That a chapter change has occurred
2. The title of the new chapter being displayed
3. The chapter number within the book

This makes it difficult for screen reader users to track their position in the book and understand navigation context. The component uses `innerHTML` to render content (line 156), which doesn't trigger proper screen reader announcements without explicit management.

Additionally, the article element (lines 338-344) lacks a proper `aria-label` or `role` to identify it as the main content area.

## WCAG 2.1 Criteria Violated
- **4.1.3 Status Messages**: Status messages can be programmatically determined through role or properties
- **2.4.6 Headings and Labels**: Sections of content have descriptive labels
- **2.4.1 Bypass Blocks**: Mechanisms are available to bypass blocks of content

## Implementation Plan

### Code Changes Required

1. **Add aria-live region for chapter announcements** - Add a hidden announcement element near the article:
```vue
<template>
  <div class="flex flex-col flex-1 h-full overflow-hidden">
    <div
      :key="bookStore.currentChapter"
      ref="containerRef"
      class="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent scroll-smooth mx-auto"
      :class="[contentWidth, themeClasses.bg, themeClasses.text]"
      @scroll="handleScroll"
    >
      <!-- Hidden live region for chapter announcements -->
      <div
        aria-live="polite"
        aria-atomic="true"
        class="sr-only"
      >
        {{ chapterAnnouncement }}
      </div>

      <article
        ref="articleRef"
        :aria-label="currentChapterLabel"
        class="prose max-w-none prose-p:leading-loose prose-p:mb-5 prose-headings:font-semibold prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-img:rounded-lg px-4 py-6 mx-auto"
        :class="themeClasses.prose"
        :style="contentStyle"
        @click="handleLinkClick"
      />
    </div>
  </div>
</template>
```

2. **Add computed property for chapter announcements** - In the script section:
```typescript
const currentChapterLabel = computed(() => {
  if (!bookStore.currentBook) return '';
  const chapter = bookStore.chapters[bookStore.currentChapter];
  if (!chapter) return '';
  const chapterNumber = bookStore.currentChapter + 1;
  const totalChapters = bookStore.chapters.length;
  const chapterTitle = chapter.title || `Chapter ${chapterNumber}`;
  return `${chapterTitle}. Chapter ${chapterNumber} of ${totalChapters}`;
});

const chapterAnnouncement = ref('');
```

3. **Update renderCurrentChapter to trigger announcements** - Modify the function:
```typescript
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

  // Trigger live announcement
  const chapterNumber = bookStore.currentChapter + 1;
  const totalChapters = bookStore.chapters.length;
  const chapterTitle = chapter.title || `Chapter ${chapterNumber}`;
  chapterAnnouncement.value = `Now reading: ${chapterTitle}. Chapter ${chapterNumber} of ${totalChapters}`;

  if (bookStore.searchHighlight && bookStore.searchHighlight.chapterIndex === bookStore.currentChapter) {
    nextTick(() => scrollToFirstHighlight());
  }

  // Clear announcement after it's read to prevent re-announcing
  setTimeout(() => {
    chapterAnnouncement.value = '';
  }, 1000);
}
```

### Additional Considerations
- The `aria-live="polite"` region will announce chapter changes without interrupting users
- The `aria-atomic="true"` ensures the entire announcement is read, even if only part updates
- The `sr-only` class (if not already defined) should be added to hide the announcement visually while keeping it available to screen readers:
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```
- The announcement is cleared after 1 second to prevent unnecessary re-announcements
- The `aria-label` on the article provides context for screen readers when focus enters the content

### Testing Requirements
- Test with screen readers to verify chapter changes are announced
- Ensure announcements are clear and include chapter number and title
- Verify that announcements don't interrupt reading flow excessively
- Test that search highlighting still works correctly with the announcements
- Ensure focus management is handled properly when chapters change
