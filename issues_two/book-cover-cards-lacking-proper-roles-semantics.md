# Book cover cards lacking proper roles and semantics

## Severity
Medium

## Affected Files
- `src/components/HomeScreen.vue` (lines 229-324)

## Detailed Description
The book cover cards in HomeScreen.vue are implemented as clickable `div` elements without proper semantic roles or keyboard accessibility. These cards lack:

1. **Proper role attribute**: No `role="button"` or appropriate semantic role
2. **Keyboard accessibility**: No keyboard event handlers (`@keydown.enter`, `@keydown.space`)
3. **tabindex**: No `tabindex="0"` to make them keyboard focusable
4. **ARIA labels**: No `aria-label` describing the book being opened
5. **Focus management**: No visible focus indicators for keyboard navigation
6. **Link/button semantics**: Users expect book cards to be links or buttons, not generic divs

The cards are currently structured as nested divs that respond to click events, which is not accessible. Screen reader users won't know they can interact with these cards, and keyboard users won't be able to navigate to them.

## WCAG 2.1 Criteria Violated
- **4.1.2 Name, Role, Value**: Name and role can be programmatically determined
- **2.1.1 Keyboard**: All functionality is available from a keyboard
- **2.4.1 Bypass Blocks**: Mechanisms are available to bypass blocks of content
- **1.3.1 Info and Relationships**: Relationships conveyed through presentation can be programmatically determined

## Implementation Plan

### Code Changes Required

1. **Convert book card div to proper button element** (lines 229-324):
```vue
<button
  v-for="book in libraryStore.books"
  :key="book.id"
  class="relative rounded-xl overflow-hidden h-full text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 group"
  @click="openBook(book)"
  :aria-label="`Open ${book.title} by ${book.author}. Last read ${formatDate(book.lastReadAt)}. Progress: ${Math.round(book.progress)}%`"
>
  <div
    class="absolute inset-0 -z-10 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 shadow-md group-hover:shadow-2xl transition-all duration-300 group-hover:-translate-y-1"
    :class="{ 'motion-reduce': prefersReducedMotion }"
  />

  <div class="group relative z-10 border border-gray-200 dark:border-gray-600 rounded-xl transition-all duration-300 hover:-translate-y-1" :class="{ 'motion-reduce': prefersReducedMotion }">
    <div class="aspect-[2/3] relative overflow-hidden bg-gray-100 dark:bg-gray-700">
      <img
        v-if="coverUrls.has(book.id)"
        :src="coverUrls.get(book.id)"
        :alt="`Cover of ${book.title}`"
        class="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
        :class="{ 'motion-reduce': prefersReducedMotion }"
      />
      <div
        v-else
        class="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 dark:from-indigo-600 dark:to-purple-700 flex items-center justify-center"
      >
        <svg class="w-20 h-20 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      </div>

      <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" :class="{ 'motion-reduce': prefersReducedMotion }" />

      <div class="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300" :class="{ 'motion-reduce': prefersReducedMotion }">
        <div class="flex gap-1">
          <button
            @click.stop="exportBook(book)"
            class="flex-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm text-indigo-600 dark:text-indigo-400 px-2 py-1.5 rounded text-xs font-medium hover:bg-white dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            :aria-label="`Export ${book.title} by ${book.author}`"
            title="Export EPUB"
          >
            <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button
            @click.stop="removeBook(book.id)"
            class="flex-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm text-red-600 dark:text-red-400 px-2 py-1.5 rounded text-xs font-medium hover:bg-white dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            :aria-label="`Remove ${book.title} by ${book.author} from library`"
            title="Remove from library"
          >
            <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div class="p-4">
      <h3
        class="font-semibold text-sm line-clamp-2 mb-1 min-h-[2.5rem]"
        :class="themeClasses.text"
      >
        {{ book.title }}
      </h3>
      <p class="text-xs text-gray-500 dark:text-gray-400 truncate mb-2">
        {{ book.author }}
      </p>
      <div class="flex items-center gap-1.5 text-xs">
        <div
          role="progressbar"
          :aria-label="`Reading progress for ${book.title}`"
          :aria-valuenow="Math.round(book.progress)"
          aria-valuemin="0"
          aria-valuemax="100"
          class="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
        >
          <div
            class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
            :class="{ 'motion-reduce': prefersReducedMotion }"
            :style="{ width: `${Math.round(book.progress)}%` }"
          />
        </div>
        <span class="text-gray-500 dark:text-gray-400 font-medium" aria-hidden="true">
          {{ Math.round(book.progress) }}%
        </span>
      </div>
      <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
        {{ formatDate(book.lastReadAt) }}
      </div>
    </div>
  </div>
</button>
```

### Alternative Solution: Use Link Element

If the book opening action is better represented as a link (since it navigates to a new view), use an anchor element instead:

```vue
<a
  v-for="book in libraryStore.books"
  :key="book.id"
  class="relative rounded-xl overflow-hidden h-full text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 group"
  href="#"
  @click.prevent="openBook(book)"
  :aria-label="`Open ${book.title} by ${book.author}. Last read ${formatDate(book.lastReadAt)}. Progress: ${Math.round(book.progress)}%`"
>
  <!-- same inner content as above -->
</a>
```

### Additional Considerations
- Using `<button>` is preferred since this is an action (opening a book), not navigation
- Added comprehensive aria-label with book title, author, last read date, and progress
- Decorative SVGs have `aria-hidden="true"`
- Added visible focus indicators with `focus:ring` classes
- Inner action buttons (export, remove) now have proper focus indicators and aria-labels
- Progress bar now has proper ARIA attributes (see previous issue)
- Consider adding `prefersReducedMotion` composable import and usage

### Testing Requirements
- Test keyboard navigation through book cards using Tab key
- Verify book cards are announced by screen readers with descriptive labels
- Ensure Enter and Space keys activate the book card
- Test that focus indicators are visible in both light and dark themes
- Verify nested buttons (export, remove) maintain proper keyboard accessibility
- Test that clicking inner buttons doesn't trigger the card click event (already handled with `@click.stop`)
