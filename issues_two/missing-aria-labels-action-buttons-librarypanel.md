# Missing ARIA labels on action buttons in LibraryPanel

## Severity
High

## Affected Files
- `src/components/LibraryPanel.vue` (lines 262-270, 277-283)

## Detailed Description
The LibraryPanel component contains icon-only buttons for removing books and clearing the library that lack proper ARIA labels. While the remove button has a `title` attribute, the clear library button has no accessibility attributes at all.

**Issues identified:**
1. **Remove book button** (lines 262-270): Only has `title` attribute, no `aria-label`
2. **Clear Library button** (lines 277-283): No `title` or `aria-label` attribute
3. **Buttons are only visible on hover** (remove button has `opacity-0 group-hover:opacity-100`), making them even more difficult for screen reader users to discover

Screen reader users rely on ARIA labels to understand button functionality, especially for icon-only buttons. The `title` attribute is not sufficient as it's not announced on focus or activation.

## WCAG 2.1 Criteria Violated
- **2.4.6 Headings and Labels**: Headings and labels describe topic or purpose
- **4.1.2 Name, Role, Value**: For all user interface components, the name and role can be programmatically determined
- **2.4.4 Link Purpose**: The purpose of each link/button can be determined from the text alone

## Implementation Plan

### Code Changes Required

1. **Add aria-label to remove book button** (lines 262-270):
```vue
<button
  @click.stop="removeBook(book.id)"
  class="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-all focus:opacity-100"
  :aria-label="`Remove ${book.title} by ${book.author} from library`"
  :title="`Remove ${book.title} from library`"
>
  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
</button>
```

2. **Add aria-label and title to Clear Library button** (lines 277-283):
```vue
<button
  @click="libraryStore.clearLibrary()"
  class="w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
  :disabled="libraryStore.books.length === 0"
  :aria-label="`Clear library. This will remove all ${libraryStore.books.length} books from your library. This action cannot be undone.`"
  title="Clear Library"
>
  Clear Library
</button>
```

### Additional Improvements

3. **Make remove button more discoverable** - Consider making the remove button always visible or providing a keyboard shortcut:

```vue
<button
  @click.stop="removeBook(book.id)"
  class="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
  :class="{'opacity-0 group-hover:opacity-100 focus:opacity-100': true}"
  :aria-label="`Remove ${book.title} by ${book.author} from library`"
  :title="`Remove ${book.title} from library`"
>
  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
</button>
```

4. **Add confirmation dialog for Clear Library** - For better UX and to prevent accidental deletion:
```typescript
async function confirmClearLibrary() {
  if (confirm(`Are you sure you want to remove all ${libraryStore.books.length} books from your library? This action cannot be undone.`)) {
    await libraryStore.clearLibrary();
  }
}
```

Then update the button:
```vue
<button
  @click="confirmClearLibrary"
  class="w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
  :disabled="libraryStore.books.length === 0"
  :aria-label="`Clear library. This will remove all ${libraryStore.books.length} books from your library. This action cannot be undone.`"
  title="Clear Library"
>
  Clear Library
</button>
```

### Additional Considerations
- Added `focus:opacity-100` to make remove button visible when keyboard focused
- Added `aria-hidden="true"` to the decorative SVG icon
- Enhanced aria-labels with context (book title and author)
- Consider adding a confirmation step for destructive actions
- The remove button should be keyboard accessible - add `tabindex="0"` if not using a button element

### Testing Requirements
- Test with screen readers to verify buttons are properly announced
- Verify remove button is keyboard accessible
- Ensure remove button becomes visible when focused via keyboard
- Test that aria-labels provide clear context about button actions
- Verify that destructive actions have appropriate warnings or confirmations
- Test that Clear Library button announces the number of books that will be removed
