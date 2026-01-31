# Missing sr-only and other accessibility utility classes

## Severity
Medium

## Affected Files
- `src/styles/main.css` (no sr-only utility defined)

## Detailed Description
The application lacks essential accessibility utility classes, most importantly the `sr-only` class. The `sr-only` (screen reader only) class is critical for:

1. **Providing text alternatives for visual elements** (e.g., "Loading...", "Searching...", decorative icons)
2. **Adding context for screen readers without visual clutter**
3. **Implementing skip-to-content links** (visible only on focus)
4. **Adding ARIA labels and descriptions**
5. **Hiding elements from screen readers** (using the inverse)

Without these utility classes, developers cannot:
- Add screen-reader-only text for images, icons, or visual indicators
- Implement accessible skip links
- Provide alternative text for loading states
- Create visually hidden but screen-reader-accessible labels

The `sr-only` pattern is a standard accessibility utility that should be available in the global CSS.

## WCAG 2.1 Criteria Violated
- **1.3.1 Info and Relationships**: Information, structure, and relationships conveyed through presentation can be programmatically determined
- **2.4.6 Headings and Labels**: Labels describe topic or purpose
- **2.5.3 Label in Name**: Labels are included in the accessible name

## Implementation Plan

### Code Changes Required

1. **Add accessibility utility classes to main.css** (lines 21-59):

```css
@layer utilities {
  /* Screen reader only - hide visually, keep available to screen readers */
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

  /* Inverse - hide from screen readers but keep visible */
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

  /* Hide from both screen readers and visual display */
  .hidden-a11y {
    display: none !important;
    visibility: hidden;
  }

  /* Focus visible only - show only when element has focus */
  .focus-visible-only {
    opacity: 0;
  }

  .focus-visible-only:focus-visible {
    opacity: 1;
  }

  /* Hide visually but keep in layout */
  .visually-hidden {
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

  /* Maintain visibility but hide from screen readers */
  .a11y-hidden {
    position: absolute;
    overflow: hidden;
    clip: rect(0 0 0 0);
    height: 1px;
    width: 1px;
    margin: -1px;
    padding: 0;
    border: 0;
  }

  /* Make container focusable when it has no interactive content */
  .focusable {
    cursor: pointer;
  }

  .focusable:focus {
    outline: 2px solid rgb(99 102 241);
    outline-offset: 2px;
  }

  /* Existing scrollbar utilities */
  .scrollbar-thin {
    scrollbar-width: thin;
    scrollbar-color: theme('colors.gray.400') transparent;
  }

  .scrollbar-thin::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    background-color: theme('colors.gray.400');
    border-radius: 4px;
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }

    .animate-spin,
    .animate-pulse,
    .animate-bounce {
      animation: none !important;
    }
  }

  /* Search highlight styles */
  .search-highlight {
    background-color: #fef08a;
    padding: 0 2px;
    border-radius: 2px;
    font-weight: 500;
  }

  .dark .search-highlight {
    background-color: #ca8a04;
    color: white;
  }

  .search-highlight.active {
    background-color: #f97316;
    color: white;
    outline: 2px solid #ea580c;
    outline-offset: 1px;
  }
}
```

### Usage Examples

These utility classes can now be used throughout the application:

**1. Screen reader only text:**
```vue
<svg class="animate-spin h-6 w-6 text-indigo-600" aria-hidden="true">
  <!-- spinner paths -->
</svg>
<span class="sr-only">Loading...</span>
```

**2. Skip link (hidden until focused):**
```vue
<a
  href="#main"
  class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
>
  Skip to main content
</a>
```

**3. Hide decorative elements from screen readers:**
```vue
<svg class="w-5 h-5 a11y-hidden" fill="none" stroke="currentColor">
  <!-- icon paths -->
</svg>
```

**4. Add accessible label to decorative icon button:**
```vue
<button aria-label="Close" title="Close">
  <svg class="w-5 h-5 a11y-hidden" aria-hidden="true">
    <!-- close icon -->
  </svg>
  <span class="sr-only">Close</span>
</button>
```

**5. Make container focusable:**
```vue
<div
  class="focusable"
  role="button"
  tabindex="0"
  @click="handleClick"
  @keydown.enter="handleClick"
>
  <!-- content -->
</div>
```

### Additional Considerations

The `sr-only` class is the most critical and widely used pattern. Other useful utility classes include:

- **`visually-hidden`**: Alternative name for `sr-only` (more semantic)
- **`a11y-hidden`**: Hide from screen readers but keep visible
- **`focus-visible-only`**: Show only when keyboard focused
- **`focusable`**: Make non-interactive elements focusable
- **`hidden-a11y`**: Hide completely from all users

If using Tailwind, these utilities can be configured to be available as Tailwind classes. Alternatively, consider using a library like `tailwindcss-accessibility` which provides these utilities out of the box.

### Testing Requirements
- Test that `sr-only` elements are visible to screen readers but not visually
- Test that `a11y-hidden` elements are visible but not announced by screen readers
- Verify that `focus-visible-only` elements appear only when keyboard focused
- Ensure `visually-hidden` elements don't affect layout (but maintain position)
- Test that `focusable` containers work properly with keyboard navigation
