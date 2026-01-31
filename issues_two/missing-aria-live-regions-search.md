# Missing ARIA live regions for search results

## Severity
High

## Affected Files
- `src/components/SearchPanel.vue` (lines 97-143)

## Detailed Description
The SearchPanel component displays dynamic search results without ARIA live regions. When users perform a search, the results appear dynamically but screen readers are not notified of:
1. The search in progress (loading state)
2. The number of results found
3. When results are available
4. When no results are found

This makes the search functionality significantly less accessible for screen reader users who may not realize that new content has appeared.

The loading spinner (lines 99-104), no results message (lines 107-112), results list (lines 115-133), and empty state (lines 137-142) all need to be wrapped in or annotated with ARIA live regions.

## WCAG 2.1 Criteria Violated
- **4.1.3 Status Messages**: In content implemented using markup languages, status messages can be programmatically determined through role or properties such that they can be presented to the user without receiving focus
- **2.4.4 Link Purpose**: Users are notified when dynamic content changes

## Implementation Plan

### Code Changes Required

1. **Add aria-live region to search results container** (lines 97-143):
```vue
<div class="flex-1 overflow-y-auto p-4">
  <!-- Loading state with live announcement -->
  <div v-if="search.isSearching.value" class="flex justify-center py-8" role="status" aria-live="polite" aria-busy="true">
    <svg class="animate-spin h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <span class="sr-only">Searching...</span>
  </div>

  <!-- No results with live announcement -->
  <div
    v-else-if="searchQuery && search.results.value.length === 0"
    class="text-center py-8 text-gray-500"
    role="status"
    aria-live="polite"
  >
    No results found for "{{ searchQuery }}"
  </div>

  <!-- Results list with live announcement -->
  <div v-else-if="search.results.value.length > 0" class="space-y-3">
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4" role="status" aria-live="polite">
      {{ search.results.value.length }} result{{ search.results.value.length !== 1 ? 's' : '' }} found
    </p>

    <button
      v-for="(result, index) in search.results.value"
      :key="index"
      @click="goToResult(result)"
      class="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      :aria-label="`Go to ${result.chapterTitle}. Match: ${result.previewText}`"
    >
      <p class="font-medium text-sm mb-1" :class="themeClasses.text">
        {{ result.chapterTitle }}
      </p>
      <p
        class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2"
        v-html="result.excerpt"
        aria-hidden="true"
      />
    </button>
  </div>

  <!-- Empty state -->
  <div
    v-else
    class="text-center py-8 text-gray-500"
    role="status"
  >
    Enter a search term to find content in this book
  </div>
</div>
```

2. **Add aria-label to search input** (lines 78-84):
```vue
<input
  ref="searchInput"
  v-model="searchQuery"
  type="text"
  placeholder="Search in book..."
  class="w-full px-4 py-2 pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
  :class="themeClasses.text"
  aria-label="Search in book"
/>
```

3. **Hide decorative search icon from screen readers** (lines 86-93):
```vue
<svg
  class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
  fill="none"
  stroke="currentColor"
  viewBox="0 0 24 24"
  aria-hidden="true"
>
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
</svg>
```

### Additional Considerations
- The `aria-live="polite"` region will announce changes without interrupting users
- For the search results buttons, add a preview text attribute to the result object to provide meaningful aria-labels
- Consider adding `aria-label` to the close button (line 65-73) for consistency

### Testing Requirements
- Test with screen readers to ensure search announcements are properly communicated
- Verify that the loading state is announced
- Verify that results count is announced
- Verify that "no results" message is announced
- Ensure announcements don't interrupt user input
