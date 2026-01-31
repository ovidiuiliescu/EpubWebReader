# BookViewer Component - Multiple Responsibilities Violation

## Severity: High

## Affected Files
- `src/components/BookViewer.vue:1-348`

## Description
The `BookViewer` component violates the Single Responsibility Principle by handling multiple distinct concerns within a single 348-line file. It manages:

1. Chapter rendering and display
2. Scroll position tracking and progress calculation
3. Internal link navigation and chapter switching
4. Search highlighting and text manipulation
5. Font settings application (font family, size, line height)
6. DOM manipulation and HTML parsing
7. Watch effects for chapter changes and settings changes

## Why This Is Problematic
- **Unmaintainable**: The component is too large and complex to understand at a glance
- **Hard to test**: Multiple responsibilities make unit testing difficult
- **Tight coupling**: Changes to one feature (e.g., search) can affect unrelated features (e.g., scrolling)
- **Poor reusability**: Logic cannot be extracted for use in other components
- **Difficult debugging**: Issues are harder to isolate when so many concerns are mixed together

## Implementation Plan

### Step 1: Extract Chapter Rendering Logic
Create a new composable `src/composables/useChapterRenderer.ts`:
```typescript
export function useChapterRenderer(articleRef: Ref<HTMLElement | null>) {
  function renderChapter(chapter: Chapter) {
    if (!articleRef.value) return;
    articleRef.value.innerHTML = chapter.content || '<p>No content</p>';
  }

  return { renderChapter };
}
```

### Step 2: Extract Scroll Tracking Logic
Create a new composable `src/composables/useScrollTracking.ts`:
```typescript
export function useScrollTracking(containerRef: Ref<HTMLElement | null>, bookStore: any) {
  function handleScroll() {
    // Move scroll handling logic from BookViewer.vue lines 38-61
  }

  return { handleScroll };
}
```

### Step 3: Extract Link Navigation Logic
Create a new composable `src/composables/useLinkNavigation.ts`:
```typescript
export function useLinkNavigation(articleRef: Ref<HTMLElement | null>, bookStore: any) {
  function handleLinkClick(event: MouseEvent) {
    // Move link handling logic from BookViewer.vue lines 63-139
  }

  return { handleLinkClick };
}
```

### Step 4: Extract Search Highlighting Logic
Create a new composable `src/composables/useSearchHighlighting.ts`:
```typescript
export function useSearchHighlighting(articleRef: Ref<HTMLElement | null>) {
  function highlightSearchText(html: string, searchText: string): string {
    // Move highlighting logic from BookViewer.vue lines 168-236
  }

  function scrollToFirstHighlight() {
    // Move scroll logic from BookViewer.vue lines 238-247
  }

  return { highlightSearchText, scrollToFirstHighlight };
}
```

### Step 5: Create Progress Calculation Utility
Create a new utility file `src/utils/progress.ts`:
```typescript
export function calculateOverallProgress(
  currentChapter: number,
  scrollPosition: number,
  scrollHeight: number,
  totalChapters: number
): number {
  if (totalChapters === 0) return 0;
  const currentChapterProgress = scrollHeight > 0 ? scrollPosition / scrollHeight : 0;
  return ((currentChapter + currentChapterProgress) / totalChapters) * 100;
}
```

### Step 6: Refactor BookViewer Component
Update `src/components/BookViewer.vue`:
```vue
<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { useBookStore } from '@/stores/book';
import { useSettingsStore } from '@/stores/settings';
import { useChapterRenderer } from '@/composables/useChapterRenderer';
import { useScrollTracking } from '@/composables/useScrollTracking';
import { useLinkNavigation } from '@/composables/useLinkNavigation';
import { useSearchHighlighting } from '@/composables/useSearchHighlighting';

const bookStore = useBookStore();
const settingsStore = useSettingsStore();

const containerRef = ref<HTMLDivElement | null>(null);
const articleRef = ref<HTMLDivElement | null>(null);

const { renderChapter } = useChapterRenderer(articleRef);
const { handleScroll } = useScrollTracking(containerRef, bookStore);
const { handleLinkClick } = useLinkNavigation(articleRef, bookStore);
const { highlightSearchText, scrollToFirstHighlight } = useSearchHighlighting(articleRef);

// Simplified component logic
</script>
```

### Step 7: Update Watch Effects
Simplify the watch effects in BookViewer to only handle re-rendering when necessary:
```typescript
watchEffect(() => {
  if (articleRef.value && bookStore.currentChapterData) {
    renderChapter(bookStore.currentChapterData);
  }
});
```

### Step 8: Update Settings Watch
Move settings-related watch to a separate composable or handle it differently to avoid duplicate progress calculation logic.

### Testing Strategy
1. Test each composable independently
2. Ensure BookViewer component still works correctly after refactoring
3. Verify no regressions in scroll tracking, navigation, or search highlighting
