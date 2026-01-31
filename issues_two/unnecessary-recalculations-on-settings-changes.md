# Unnecessary Recalculations on Settings Changes

## Severity
Low

## Affected Files
- `src/components/BookViewer.vue:288-321`
- `src/components/BookViewer.vue:18-26`

## Description
When settings change (font size, theme, etc.), the application triggers unnecessary recalculations and progress updates:

```typescript
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

      await bookStore.updateProgress({  // Unnecessary!
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
```

Issues:
1. Settings changes trigger progress updates even though reading progress hasn't actually changed
2. The `contentStyle` computed property recalculates on every settings change, even when only one setting changes
3. Reading progress is recalculated from scroll position which is already known
4. This causes unnecessary IndexedDB writes (covered in separate issue)
5. The watch triggers for any of the 4 settings, even when they're set independently

The `contentStyle` computed also recalculates unnecessarily:

```typescript
const contentStyle = computed(() => ({
  fontSize: `${settingsStore.preferences.fontSize}px`,
  fontFamily: getFontFamily(settingsStore.preferences.fontFamily),
  lineHeight: settingsStore.preferences.lineHeight,
}));
```

Every time `settingsStore.preferences` changes (even just `wideMode`), this recalculates.

## Impact on User Experience
- Unnecessary CPU usage when changing settings
- UI lag during theme/font size changes
- Unnecessary IndexedDB writes
- Extra rendering cycles
- Poor perceived performance when adjusting settings

## Implementation Plan

### Fix 1: Remove Progress Updates from Settings Changes

```typescript
// Settings changes should NOT update reading progress
// The scroll handler already handles progress updates

watch(
  () => [
    settingsStore.preferences.wideMode,
    settingsStore.preferences.fontSize,
    settingsStore.preferences.fontFamily,
    settingsStore.preferences.lineHeight,
  ],
  () => {
    if (settingsTimer) clearTimeout(settingsTimer);
    settingsTimer = window.setTimeout(() => {
      // Just trigger a re-render if needed, don't update progress
      // The computed properties will handle style updates automatically
    }, 500);
  }
);
```

Or better yet, remove this watch entirely since:
- `contentWidth` computed handles `wideMode` changes
- `contentStyle` computed handles `fontSize`, `fontFamily`, `lineHeight` changes
- These changes are automatically reflected in the template

### Fix 2: Individual Computed Properties

```typescript
// Create individual computed properties to avoid recalculating everything
const contentFontSize = computed(() => `${settingsStore.preferences.fontSize}px`);
const contentFontFamily = computed(() => getFontFamily(settingsStore.preferences.fontFamily));
const contentLineHeight = computed(() => settingsStore.preferences.lineHeight);

const contentStyle = computed(() => ({
  fontSize: contentFontSize.value,
  fontFamily: contentFontFamily.value,
  lineHeight: contentLineHeight.value,
}));
```

Now only the specific computed property recalculates when its dependency changes.

### Fix 3: Memoize Font Family Lookup

```typescript
// Font family lookup result is always the same for the same input
const fontFamilyCache = new Map<string, string>();

function getFontFamily(font: string): string {
  if (fontFamilyCache.has(font)) {
    return fontFamilyCache.get(font)!;
  }

  const fonts: Record<string, string> = {
    georgia: 'Georgia, Cambria, "Times New Roman", serif',
    campote: '"Campote", Georgia, serif',
    arial: 'Arial, Helvetica, sans-serif',
    verdana: 'Verdana, Arial, sans-serif',
  };
  const result = fonts[font] || fonts.georgia;
  fontFamilyCache.set(font, result);
  return result;
}
```

Or use a const object with frozen values:

```typescript
const FONT_FAMILIES = Object.freeze({
  georgia: 'Georgia, Cambria, "Times New Roman", serif',
  campote: '"Campote", Georgia, serif',
  arial: 'Arial, Helvetica, sans-serif',
  verdana: 'Verdana, Arial, sans-serif',
} as const);

function getFontFamily(font: string): string {
  return FONT_FAMILIES[font as keyof typeof FONT_FAMILIES] || FONT_FAMILIES.georgia;
}
```

### Fix 4: Use CSS Variables for Settings (Best Practice)

Instead of inline styles computed by Vue, use CSS variables that are updated directly:

```typescript
// In a composable or directly in component
function updateThemeVariables() {
  const root = document.documentElement;
  root.style.setProperty('--reader-font-size', `${settingsStore.preferences.fontSize}px`);
  root.style.setProperty('--reader-line-height', String(settingsStore.preferences.lineHeight));
  root.style.setProperty('--reader-font-family', getFontFamily(settingsStore.preferences.fontFamily));
}

watch(
  () => [
    settingsStore.preferences.fontSize,
    settingsStore.preferences.fontFamily,
    settingsStore.preferences.lineHeight,
  ],
  updateThemeVariables,
  { immediate: true }
);
```

In template/CSS:
```html
<article
  ref="articleRef"
  class="prose max-w-none prose-p:leading-loose px-4 py-6 mx-auto"
  :style="{
    fontSize: 'var(--reader-font-size)',
    fontFamily: 'var(--reader-font-family)',
    lineHeight: 'var(--reader-line-height)'
  }"
  @click="handleLinkClick"
/>
```

This way, Vue doesn't need to recompute styles - the browser handles CSS variable updates efficiently.

### Fix 5: Debounce Settings Changes if Needed

If you need to debounce rapid settings changes (e.g., user clicking font size multiple times quickly):

```typescript
import { useDebounceFn } from '@vueuse/core';

const updateSettingsDebounced = useDebounceFn(() => {
  // Any debounced settings update logic
}, 100);
```

## Additional Optimizations
1. Use `style` binding only for dynamic values, use static classes for others
2. Consider using Tailwind's `@apply` with CSS variables for theme styles
3. Implement smooth transitions for font size changes
4. Add loading state while settings are being applied
5. Consider using a transition component for smooth visual updates
6. Implement settings preview before applying
7. Add keyboard shortcuts for common settings (e.g., +/- for font size)
8. Cache computed style objects to avoid object creation
9. Use `shallowRef` for settings that don't need deep watching
10. Consider using a CSS-in-JS solution for better performance
