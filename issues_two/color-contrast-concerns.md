# Color contrast concerns for text and UI elements

## Severity
Medium

## Affected Files
- Multiple components using Tailwind color utilities that may not meet WCAG AA contrast requirements

## Detailed Description
The application uses several color combinations that should be verified for WCAG 2.1 AA compliance. While the specific contrast ratios depend on the exact color values from Tailwind, there are several areas of concern:

### Potentially Insufficient Contrast Areas:

1. **Gray-500 text** (`text-gray-500`) on light backgrounds:
   - Used in: LibraryPanel (lines 124-125, 200, 241-242, 246-247, 249, 251)
   - Used in: ChapterList (line 55)
   - Used in: SearchPanel (lines 109, 116, 140)
   - Used in: HomeScreen (lines 123, 154, 220, 306, 309, 316, 320)
   - Used in: Controls (line 88)
   - Tailwind gray-500: `rgb(107, 114, 128)` - contrast with white (255,255,255) is approximately 2.07:1 (fails AA 4.5:1)

2. **Gray-400 text** (`text-gray-400`) on light backgrounds:
   - Used in: SearchPanel (line 87)
   - Used in: HomeScreen (lines 193, 195)
   - Tailwind gray-400: `rgb(156, 163, 175)` - contrast with white is approximately 1.63:1 (fails AA)

3. **Dark mode text-gray-400 and text-gray-500** on dark backgrounds:
   - Used in multiple components with `dark:text-gray-400` and `dark:text-gray-500`
   - These lighter grays on dark backgrounds also need verification

4. **Indigo-400** text (`text-indigo-400`) in dark mode:
   - Used in: SearchPanel (line 83)
   - Used in multiple components
   - Tailwind indigo-400: `rgb(129, 140, 248)` - needs verification against dark backgrounds

5. **Progress bar backgrounds**:
   - `bg-gray-200` and `bg-gray-700` as track colors with colored progress bars
   - Need to verify that the progress bar fill color has sufficient contrast against the track

6. **Disabled state styling**:
   - `disabled:opacity-50` - Opacity at 50% may reduce contrast below acceptable levels

### WCAG 2.1 AA Requirements:
- **Normal text**: Minimum contrast ratio of 4.5:1
- **Large text (18pt+ or 14pt+ bold)**: Minimum contrast ratio of 3:1
- **Graphical objects and UI components**: Minimum contrast ratio of 3:1

## WCAG 2.1 Criteria Violated
- **1.4.3 Contrast (Minimum)**: The visual presentation of text and images of text has a contrast ratio of at least 4.5:1
- **1.4.11 Non-text Contrast**: The visual presentation of user interface components and graphical objects has a contrast ratio of at least 3:1

## Implementation Plan

### Option 1: Verify and Update Color Utilities (Recommended)

1. **Verify actual contrast ratios** - Use a color contrast checker tool:
   - https://webaim.org/resources/contrastchecker/
   - https://contrast-ratio.com/
   - Browser dev tools extensions

2. **Update problematic colors** - Replace with darker/more contrasting colors:

**For gray-500 (rgb 107, 114, 128) - use gray-600 or gray-700:**
- Tailwind gray-600: `rgb(75, 85, 99)` - contrast with white ~2.77:1 (still below AA)
- Tailwind gray-700: `rgb(55, 65, 81)` - contrast with white ~3.59:1 (meets AA for large text)

**Recommendation:** Use `text-gray-600` or `text-gray-700` instead of `text-gray-500` for normal text, and `text-gray-500` only for large text (18pt+).

### Code Changes Required

1. **LibraryPanel.vue** - Update gray-500 to gray-600 for better contrast:
```vue
<!-- Line 124-125 -->
<span class="text-sm text-gray-600 dark:text-gray-400">
  ({{ libraryStore.books.length }})
</span>

<!-- Line 200 -->
<p class="text-gray-600 dark:text-gray-400 mb-2">
  Drop an EPUB file here or use the upload button to get started
</p>

<!-- Line 241-242 -->
<p class="text-sm text-gray-600 dark:text-gray-400 truncate">
  {{ book.author }}
</p>

<!-- Line 246-247, 249, 251 -->
<span class="text-xs text-gray-600 dark:text-gray-500">
```

2. **ChapterList.vue** - Update no results message:
```vue
<!-- Line 55 -->
<div v-if="bookStore.chapters.length === 0" class="text-center py-8 text-gray-600">
  No table of contents available
</div>
```

3. **SearchPanel.vue** - Update search results messages:
```vue
<!-- Line 109 -->
<div 
  v-else-if="searchQuery && search.results.value.length === 0" 
  class="text-center py-8 text-gray-600"
  role="status"
  aria-live="polite"
>
  No results found for "{{ searchQuery }}"
</div>

<!-- Line 116 -->
<p class="text-sm text-gray-600 dark:text-gray-400 mb-4" role="status" aria-live="polite">
  {{ search.results.value.length }} results found
</p>

<!-- Line 140 -->
<div 
  v-else 
  class="text-center py-8 text-gray-600"
  role="status"
>
  Enter a search term to find content in this book
</div>

<!-- Line 87 -->
<svg 
  class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" 
  fill="none" 
  stroke="currentColor" 
  viewBox="0 0 24 24"
  aria-hidden="true"
>
```

4. **HomeScreen.vue** - Update gray text colors:
```vue
<!-- Line 123 -->
<p class="text-gray-700 dark:text-gray-400 text-lg">
  Your personal library in the cloud... wait, it's all local!
</p>

<!-- Line 154 -->
<p class="text-sm text-gray-600 dark:text-gray-400">
  {{ libraryStore.books.length }} book{{ libraryStore.books.length !== 1 ? 's' : '' }}
</p>

<!-- Line 220 -->
<p class="text-sm text-gray-600 dark:text-gray-400">
  Upload your first EPUB to get started
</p>

<!-- Line 306, 309, 316, 320 -->
<p class="text-xs text-gray-600 dark:text-gray-400 truncate mb-2">
  {{ book.author }}
</p>

<!-- Line 193, 195 -->
<div v-else-if="libraryStore.books.length > 0" class="absolute inset-0 pointer-events-none opacity-5 flex items-center justify-center">
  <div class="text-center">
    <svg class="w-32 h-32 mx-auto text-gray-600 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
```

5. **Controls.vue** - Update chapter counter:
```vue
<!-- Line 88 -->
<span class="text-sm text-gray-600 dark:text-gray-400">
  {{ bookStore.currentChapter + 1 }} / {{ bookStore.chapters.length }}
</span>
```

6. **Update disabled state opacity** - Instead of opacity-50, use a more accessible approach:
```vue
<!-- Instead of: -->
<button
  :disabled="disabled"
  class="disabled:opacity-50 ..."
>

<!-- Use: -->
<button
  :disabled="disabled"
  class="disabled:text-gray-400 disabled:cursor-not-allowed disabled:opacity-75 ..."
  :aria-disabled="disabled"
>
```

### Option 2: Define Custom Color Palette (Alternative)

If Tailwind's default grays don't provide sufficient contrast, define custom accessible grays in tailwind.config.js:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        gray: {
          // Custom accessible grays
          'a11y-400': '#525252',  // ~4.52:1 on white
          'a11y-500': '#404040',  // ~6.09:1 on white (meets AAA)
          'a11y-600': '#262626',  // ~10.32:1 on white
        }
      }
    }
  }
}
```

### Additional Considerations

- Test in both light and dark modes
- Verify contrast ratios for all interactive states (hover, focus, active, disabled)
- Check that color is not the only means of conveying information (use icons, underlines, patterns, etc.)
- For progress bars, ensure the filled portion has sufficient contrast against both the track and background
- Consider using a tool like axe DevTools or Lighthouse to automatically detect contrast issues

### Testing Requirements

1. **Automated Testing:**
   - Run Lighthouse accessibility audit
   - Use axe DevTools Chrome extension
   - Use WAVE Web Accessibility Evaluation Tool

2. **Manual Testing:**
   - Use color contrast checkers for each text/background combination
   - Test with screen zoom up to 200% to ensure text remains readable
   - Test with simulated color blindness (protanopia, deuteranopia, tritanopia)
   - Verify that all text passes the appropriate contrast ratio (4.5:1 for normal text, 3:1 for large text)

3. **User Testing:**
   - Test with users with visual impairments
   - Get feedback on readability in various lighting conditions
   - Test on different devices and screen sizes
