# Memory Leak in Watch Cleanup Function

## Severity
High

## Affected Files
- `src/components/SearchPanel.vue:44-49`

## Description
The watch cleanup function returns a cleanup callback, but Vue 3's watch API expects this to be returned from the watch effect function, not from within the callback. The cleanup function is created but never called.

```javascript
watch(searchQuery, () => {
  const timer = setTimeout(() => {
    performSearch();
  }, 300);
  return () => clearTimeout(timer);  // This cleanup is NEVER called
});
```

## Why This Is A Problem
This is a Vue 3 Composition API anti-pattern that causes a memory leak:

1. **Timer never cleared**: Each time `searchQuery` changes, a new timer is created, but the previous timer is never cleared because the cleanup function returned from the callback is not executed by Vue's watch API.

2. **Accumulating timers**: As the user types, multiple timers accumulate in memory. If the user types quickly, there could be dozens or hundreds of pending timers.

3. **Outdated search queries**: Old searches may still execute after newer ones complete, causing UI inconsistencies and wasted CPU cycles.

4. **Resource waste**: Memory is allocated for each timer and never released, potentially causing performance degradation.

The correct pattern in Vue 3's watch API is:
- For `watch(source, callback)`: The cleanup should be returned from the callback function
- For `watchEffect(effect)`: The cleanup should be returned from the effect function

In this case, the code is using `watch()` but the cleanup function's return value is not being properly handled by Vue.

## Implementation Plan

1. Use the `watchEffect` API instead, which properly handles cleanup functions:

```javascript
import { watchEffect, onScopeDispose } from 'vue';

let searchTimer: number | null = null;

watchEffect((onCleanup) => {
  if (searchQuery.value.trim()) {
    if (searchTimer !== null) {
      clearTimeout(searchTimer);
    }
    
    searchTimer = window.setTimeout(() => {
      performSearch();
      searchTimer = null;
    }, 300);
    
    onCleanup(() => {
      if (searchTimer !== null) {
        clearTimeout(searchTimer);
        searchTimer = null;
      }
    });
  }
});

// Additional cleanup on component unmount
onScopeDispose(() => {
  if (searchTimer !== null) {
    clearTimeout(searchTimer);
  }
});
```

2. Alternative solution using `watch` with proper cleanup in the callback:

```javascript
import { ref, watch, onUnmounted } from 'vue';

let searchTimer: number | null = null;

watch(searchQuery, () => {
  if (searchTimer !== null) {
    clearTimeout(searchTimer);
  }
  
  searchTimer = window.setTimeout(() => {
    performSearch();
    searchTimer = null;
  }, 300);
});

// Cleanup on component unmount
onUnmounted(() => {
  if (searchTimer !== null) {
    clearTimeout(searchTimer);
  }
});
```

3. Even better: Create a debounced utility composable:

```javascript
// composables/useDebounce.ts
import { ref, watch, onUnmounted } from 'vue';

export function useDebounce<T>(value: Ref<T>, delay: number): Ref<T> {
  const debouncedValue = ref(value.value);
  let timer: number | null = null;

  watch(value, (newValue) => {
    if (timer !== null) {
      clearTimeout(timer);
    }

    timer = window.setTimeout(() => {
      debouncedValue.value = newValue;
      timer = null;
    }, delay);
  });

  onUnmounted(() => {
    if (timer !== null) {
      clearTimeout(timer);
    }
  });

  return debouncedValue;
}
```

Then use it in SearchPanel:

```javascript
import { watch } from 'vue';
import { useDebounce } from '@/composables/useDebounce';

const debouncedQuery = useDebounce(searchQuery, 300);

watch(debouncedQuery, () => {
  if (debouncedQuery.value.trim()) {
    performSearch();
  }
});
```

This approach is more reusable and follows Vue 3 best practices for debounced values.
