# Missing skip-to-content link for keyboard navigation

## Severity
Critical

## Affected Files
- `src/components/App.vue` (lines 54-61)

## Detailed Description
The application lacks a "skip to content" link at the top of the page. Skip links are essential for keyboard users who navigate through web applications repeatedly. Without a skip link, keyboard users must tab through all navigation controls before reaching the main content on each page view.

For a book reader application where users may frequently navigate back to the library or between books, this becomes especially problematic. Users would need to tab through potentially many interactive elements (navigation, controls, etc.) to reach the main reading content each time.

The skip link should:
- Appear at the very top of the document (before all other content)
- Be the first element in the tab order
- Be visible only when focused
- Skip directly to the main content area
- Use appropriate ARIA attributes

## WCAG 2.1 Criteria Violated
- **2.4.1 Bypass Blocks**: A mechanism is available to bypass blocks of content that are repeated on multiple Web pages
- **2.1.1 Keyboard**: All functionality is available from a keyboard

## Implementation Plan

### Code Changes Required

1. **Add skip link to App.vue template** - Add at the very beginning of the template (line 54):
```vue
<template>
  <!-- Skip to main content link -->
  <a
    href="#main-content"
    class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
    @click.prevent="skipToContent"
  >
    Skip to main content
  </a>

  <div
    id="main-content"
    :class="[
      'min-h-screen transition-colors duration-300',
      themeClasses.bg,
      themeClasses.text
    ]"
  >
    <!-- No Book Loaded State -->
    <HomeScreen
      v-if="!bookStore.currentBook"
      @select-book="handleFileDrop"
    />

    <!-- Loading State -->
    <div
      v-else-if="bookStore.isLoading"
      role="status"
      aria-live="polite"
      aria-busy="true"
      class="flex flex-col items-center justify-center min-h-screen"
      :class="[themeClasses.bg, themeClasses.text]"
    >
      <svg
        v-if="!prefersReducedMotion"
        class="animate-spin h-12 w-12 text-indigo-600 mb-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-lg" role="alert">Loading book...</p>
    </div>

    <!-- Book Loaded State -->
    <template v-else>
      <div class="flex flex-col h-screen">
        <!-- Top Controls -->
        <Controls
          @toggle-toc="toggleToc"
          @toggle-search="toggleSearch"
          @toggle-library="toggleLibrary"
        />

        <!-- Main Content Area -->
        <div class="flex flex-1 overflow-hidden">
          <!-- TOC Sidebar -->
          <aside
            v-if="showToc"
            ref="tocPanel"
            role="dialog"
            aria-modal="true"
            aria-label="Table of contents"
            class="fixed top-16 bottom-0 right-0 z-50 w-72 overflow-y-auto border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl transition-transform duration-300"
            :class="themeClasses.bg"
            @keydown.esc="toggleToc"
          >
            <ChapterList @close="toggleToc" />
          </aside>

          <!-- Book Content -->
          <main
            id="book-content"
            role="main"
            aria-label="Book content"
            class="flex-1 transition-all duration-300 overflow-hidden flex justify-center"
            :class="{ 'mr-72': showToc, 'mr-80': showSearch || showLibrary }"
          >
            <BookViewer class="w-full" />
          </main>

          <!-- Search Panel -->
          <div
            v-if="showSearch"
            ref="searchPanel"
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            class="fixed top-16 bottom-0 right-0 z-50 w-80 overflow-y-auto border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl"
            :class="themeClasses.bg"
            @keydown.esc="toggleSearch"
          >
            <SearchPanel @close="toggleSearch" />
          </div>

          <!-- Library Panel -->
          <div
            v-if="showLibrary"
            ref="libraryPanel"
            role="dialog"
            aria-modal="true"
            aria-label="Library"
            class="fixed top-16 bottom-0 right-0 z-50 w-80 overflow-y-auto border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl"
            :class="themeClasses.bg"
            @keydown.esc="toggleLibrary"
          >
            <LibraryPanel @close="toggleLibrary" />
          </div>
        </div>
      </div>
    </template>

    <!-- Overlay for mobile when panels are open -->
    <div
      v-if="showToc || showSearch || showLibrary"
      class="fixed inset-0 bg-black/50 z-40 lg:hidden"
      @click="closePanels"
      aria-hidden="true"
    />
  </div>
</template>
```

2. **Add skipToContent function** - In script section:
```typescript
function skipToContent() {
  const bookContent = document.getElementById('book-content');
  if (bookContent) {
    bookContent.focus();
    bookContent.scrollIntoView({ behavior: 'auto' });
  }
}
```

3. **Add sr-only utility class** - In main.css (see "Missing sr-only utility class" issue):
```css
@layer utilities {
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

  .not-sr-only {
    position: static;
    width: auto;
    height: auto;
    padding: 0;
    margin: 0;
    overflow: visible;
    clip: auto;
    white-space: normal;
  }
}
```

### Additional Considerations
- The skip link should appear first in the DOM order to ensure it's the first tab stop
- Use `sr-only` class to hide it from visual display until focused
- Use `focus:not-sr-only` to make it visible when keyboard focused
- Add appropriate visual styling for the focused state
- The link should point to the main content area (`#book-content`)
- Ensure the target element (`id="book-content"`) is focusable (add `tabindex="-1"` to the main element if needed)
- Consider adding additional skip links for common destinations:
  - "Skip to navigation" (for screen reader users)
  - "Skip to search"
  - "Skip to library"

### Enhanced Skip Links

For better accessibility, consider multiple skip links:
```vue
<div class="flex gap-2 sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100]">
  <a
    href="#main-content"
    class="px-4 py-2 bg-indigo-600 text-white rounded shadow-lg outline-none ring-2 ring-indigo-400 ring-offset-2"
    @click.prevent="skipToContent"
  >
    Skip to content
  </a>
  <a
    href="#navigation"
    class="px-4 py-2 bg-indigo-600 text-white rounded shadow-lg outline-none ring-2 ring-indigo-400 ring-offset-2"
  >
    Skip to navigation
  </a>
</div>
```

### Testing Requirements
- Test that the skip link is the first element in the tab order
- Verify the link becomes visible when keyboard focused
- Ensure the link skips directly to the main content when activated
- Test that focus moves to the appropriate location
- Verify the link works in both home screen and book viewer modes
- Test with different screen readers to ensure proper behavior
