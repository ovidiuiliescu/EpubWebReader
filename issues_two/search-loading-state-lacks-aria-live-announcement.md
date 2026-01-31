# Search results loading state lacks ARIA live announcement

## Severity
High

## Affected Files
- `src/components/SearchPanel.vue` (lines 99-104)

## Detailed Description
The SearchPanel component shows a loading spinner when searching, but this state is not announced to screen readers. The loading indicator is purely visual with no ARIA attributes to indicate:

1. **That a search operation is in progress**
2. **That the region has live updates**
3. **That the content is busy/loading**

While there is a loading state display, screen reader users may not be aware that a search is happening or when it completes. This creates a poor user experience as users may:
- Not realize their search query was registered
- Think the application is unresponsive
- Not know when results are available
- Not be aware that "no results found" message appeared

## WCAG 2.1 Criteria Violated
- **4.1.3 Status Messages**: Status messages can be programmatically determined through role or properties such that they can be presented to the user without receiving focus
- **2.4.6 Headings and Labels**: Status indicators describe their purpose

## Implementation Plan

### Code Changes Required

1. **Update loading state with ARIA attributes** (lines 99-104):
```vue
<!-- Loading state -->
<div
  v-if="search.isSearching.value"
  role="status"
  aria-live="polite"
  aria-busy="true"
  class="flex justify-center py-8"
>
  <svg
    class="animate-spin h-6 w-6 text-indigo-600"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
  <span class="sr-only">Searching...</span>
</div>
```

2. **Ensure proper ARIA attributes on no results state** (lines 107-112):
```vue
<!-- No results -->
<div
  v-else-if="searchQuery && search.results.value.length === 0"
  role="status"
  aria-live="polite"
  class="text-center py-8 text-gray-500"
>
  No results found for "{{ searchQuery }}"
</div>
```

3. **Ensure results count is announced** (lines 116-118):
```vue
<p
  v-if="search.results.value.length > 0"
  class="text-sm text-gray-500 dark:text-gray-400 mb-4"
  role="status"
  aria-live="polite"
>
  {{ search.results.value.length }} result{{ search.results.value.length !== 1 ? 's' : '' }} found
</p>
```

4. **Add aria-busy to the main container during search** (lines 97-143):
```vue
<div
  class="flex-1 overflow-y-auto p-4"
  :aria-busy="search.isSearching.value"
>
  <!-- Loading, no results, results list, and empty state sections -->
</div>
```

### Additional Considerations
- `role="status"` indicates this is a status message region
- `aria-live="polite"` ensures announcements don't interrupt user input
- `aria-busy="true"` indicates the region is currently loading/updating
- Added `aria-hidden="true"` to the decorative spinner SVG
- Added `sr-only` text "Searching..." to provide a text alternative to the visual spinner
- When `aria-busy` is set on the container, screen readers will announce that content is loading

### Alternative: Use Hidden Loading Text

For better compatibility across screen readers, you might prefer to show/hide text:

```vue
<!-- Loading state with text announcement -->
<div
  v-if="search.isSearching.value"
  role="status"
  aria-live="polite"
  class="flex flex-col items-center justify-center py-8"
>
  <svg
    v-if="!prefersReducedMotion"
    class="animate-spin h-6 w-6 text-indigo-600 mb-2"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
  <span class="text-gray-500">Searching...</span>
</div>
```

### Testing Requirements
- Test with screen readers (NVDA, JAWS, VoiceOver) to verify loading announcements
- Ensure "Searching..." is announced when search begins
- Verify that results count is announced when search completes
- Verify that "No results found" is announced when appropriate
- Test that announcements don't interrupt typing in the search input
- Ensure the loading state respects `prefers-reduced-motion` preference
- Verify the `sr-only` class is defined in global styles:
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
