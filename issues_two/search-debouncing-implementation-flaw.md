# Search Debouncing Implementation Flaw

## Severity
High

## Affected Files
- `src/components/SearchPanel.vue:44-49`

## Description
The search debouncing implementation has a critical flaw. The `setTimeout` is stored but never properly cleared between user keystrokes because the cleanup function is only called when the component unmounts, not on each re-trigger.

```typescript
watch(searchQuery, () => {
  const timer = setTimeout(() => {
    performSearch();
  }, 300);
  return () => clearTimeout(timer);  // This only runs on unmount!
});
```

This means:
1. Every keystroke creates a new timeout
2. Multiple timeouts can fire in parallel
3. Search operations can run out of order
4. CPU usage spikes during typing

## Impact on User Experience
- Multiple concurrent search operations consuming CPU
- Results appearing out of sync with current query
- UI freezing during rapid typing
- Potential race conditions causing incorrect results
- Wasted computational resources

## Implementation Plan

### Fix: Proper Debounce Pattern
Replace the current watch with a proper debounce implementation:

```typescript
import { ref, watch, onUnmounted } from 'vue';
import { useDebounceFn } from '@vueuse/core';

// Option 1: Use VueUse's debounce function (if available)
const performSearchDebounced = useDebounceFn(performSearch, 300);

watch(searchQuery, () => {
  performSearchDebounced();
});
```

### Option 2: Manual Implementation with proper cleanup

```typescript
let searchTimer: ReturnType<typeof setTimeout> | null = null;

watch(searchQuery, () => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  searchTimer = setTimeout(() => {
    performSearch();
    searchTimer = null;
  }, 300);
});

onUnmounted(() => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
});
```

### Option 3: Composable approach (recommended for reusability)

```typescript
// Create a new composable: composables/useDebouncedSearch.ts
import { ref, watch, onUnmounted } from 'vue';

export function useDebouncedSearch<T>(
  callback: (query: string) => void | Promise<void>,
  delay: number = 300
) {
  const query = ref('');
  let timer: ReturnType<typeof setTimeout> | null = null;

  watch(query, (newQuery) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      callback(newQuery);
      timer = null;
    }, delay);
  });

  onUnmounted(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });

  return { query };
}
```

Usage in SearchPanel.vue:
```typescript
const { query: searchQuery } = useDebouncedSearch(async (query) => {
  await performSearch(query);
}, 300);
```

## Additional Improvements
1. Cancel in-flight search requests when a new search is initiated
2. Show loading state during debounced operations
3. Add minimum query length threshold (e.g., 2-3 characters)
4. Consider implementing "search as you type" with immediate results for exact matches
5. Add search cancel button to stop in-progress searches
