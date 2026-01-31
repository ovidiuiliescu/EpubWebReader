# Missing focus-visible indicators across components

## Severity
Medium

## Affected Files
- `src/components/Controls.vue` (lines 42-101, 109-191)
- `src/components/LibraryPanel.vue` (lines 129-153, 206-272)
- `src/components/ChapterList.vue` (lines 36-51)
- `src/components/HomeScreen.vue` (lines 54-110, 229-324)

## Detailed Description
Interactive elements throughout the application have hover states but lack explicit `:focus-visible` styling. While browsers provide default focus indicators (usually a blue outline), these may be overridden or insufficiently visible, especially in the dark theme.

The current implementation uses `:focus` styles or relies on browser defaults. This creates several accessibility issues:

1. **No distinction between keyboard and mouse focus**: Users who navigate with mouse will see focus indicators when they shouldn't (visual clutter)
2. **Inconsistent focus indicators**: Different browsers render focus differently
3. **Theme-inconsistent focus styles**: Focus indicators may not be visible in both light and dark themes
4. **Missing focus states on some elements**: Some interactive elements lack explicit focus styling

The `:focus-visible` CSS pseudo-class allows for styling elements only when they receive keyboard focus, providing a better experience for both keyboard and mouse users.

## WCAG 2.1 Criteria Violated
- **2.4.7 Focus Visible**: Any keyboard operable user interface has a mode of operation where the keyboard focus indicator is visible

## Implementation Plan

### Code Changes Required

1. **Create a focus-visible utility class** - Add to global CSS or tailwind config:
```css
/* In src/styles/main.css or appropriate stylesheet */
.focus-visible-ring {
  outline: none;
}

.focus-visible-ring:focus-visible {
  outline: 2px solid rgb(99 102 241);
  outline-offset: 2px;
  border-radius: 4px;
}

.focus-visible-ring-light:focus-visible {
  outline: 2px solid rgb(99 102 241);
  outline-offset: 2px;
  border-radius: 4px;
}

.focus-visible-ring-dark:focus-visible {
  outline: 2px solid rgb(165 180 252);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Or extend Tailwind config if using Tailwind */
```

2. **Update Controls.vue buttons** (apply to all interactive buttons):
```vue
<!-- Navigation buttons -->
<button
  @click="bookStore.prevChapter()"
  :disabled="bookStore.currentChapter === 0"
  class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
  :class="themeClasses.text"
  title="Previous chapter"
>
```

3. **Update LibraryPanel.vue interactive elements** (lines 129-153, 206-272):
```vue
<!-- Upload button -->
<button
  @click="openFilePicker"
  class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-indigo-600 dark:text-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
  aria-label="Upload Book"
>
```

```vue
<!-- Book card -->
<div
  class="group relative z-10 cursor-pointer border border-gray-200 dark:border-gray-600 rounded-xl transition-all duration-300 hover:-translate-y-1 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2"
  @click="openBook(book)"
  tabindex="0"
  @keydown.enter="openBook(book)"
  @keydown.space.prevent="openBook(book)"
  :aria-label="`Open ${book.title} by ${book.author}`"
  role="button"
>
```

4. **Update ChapterList.vue chapter buttons** (lines 36-51):
```vue
<button
  @click="selectChapter(index)"
  :aria-current="index === bookStore.currentChapter ? 'page' : undefined"
  class="w-full text-left px-3 py-2 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
  :class="[
    index === bookStore.currentChapter
      ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-medium'
      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
  ]"
>
```

5. **Update DropZone.vue** (lines 54-67):
```vue
<div
  class="w-full text-center border-4 border-dashed rounded-3xl transition-all duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-4"
  :class="[
    compact ? 'p-12' : 'p-16 max-w-2xl',
    isDragging
      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 scale-105'
      : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'
  ]"
  @click="openFilePicker"
  @keydown.enter="openFilePicker"
  tabindex="0"
  role="button"
  :aria-label="'Drop EPUB file or click to browse'"
>
```

### Additional Considerations
- Use Tailwind's built-in `focus-visible:` modifier if available, or add custom CSS
- Ensure focus indicators have sufficient contrast against both light and dark backgrounds
- Focus indicators should be at least 2px thick (WCAG recommends 2px)
- Consider adding `focus-visible:ring-offset-2` or similar to ensure visibility against all backgrounds
- Test focus indicators on different elements (buttons, links, interactive divs)
- Ensure focus indicators don't create layout shifts

### Testing Requirements
- Test keyboard navigation (Tab, Shift+Tab) through all interactive elements
- Verify focus indicators are visible in both light and dark themes
- Ensure focus indicators don't appear on mouse click (only on keyboard navigation)
- Test with different browsers to ensure consistent appearance
- Verify focus order is logical and intuitive
