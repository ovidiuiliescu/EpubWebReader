# Non-null Assertion Without Null Check in BookViewer

## Severity
High

## Affected Files
- `src/components/BookViewer.vue:159`

## Description
The code uses a non-null assertion (`!`) operator to access `containerRef.value` without ensuring it exists before accessing it.

```javascript
if (!hasRestoredScrollPosition && bookStore.currentScrollPosition > 0) {
  containerRef.value!.scrollTop = bookStore.currentScrollPosition;  // Line 159
  hasRestoredScrollPosition = true;
}
```

## Why This Is A Problem
The non-null assertion tells TypeScript to trust that `containerRef.value` is not null. However, this condition only checks `bookStore.currentScrollPosition`, not whether `containerRef.value` actually exists. If `containerRef.value` is null when this code executes (e.g., during rapid component unmounting, async rendering timing issues, or the ref not being properly initialized), the application will crash with:

```
Cannot read properties of null (reading 'scrollTop')
```

This violates the AGENTS.md guideline that states: "Avoid `any` type; use `unknown` when uncertain" and properly handle null/undefined cases.

## Implementation Plan

1. Add a proper null check for `containerRef.value` before accessing it:

```javascript
if (!hasRestoredScrollPosition && bookStore.currentScrollPosition > 0) {
  if (containerRef.value) {
    containerRef.value.scrollTop = bookStore.currentScrollPosition;
    hasRestoredScrollPosition = true;
  }
}
```

2. Alternatively, use optional chaining with a fallback:

```javascript
if (!hasRestoredScrollPosition && bookStore.currentScrollPosition > 0) {
  containerRef.value?.scrollTo({ top: bookStore.currentScrollPosition, behavior: 'instant' });
  if (containerRef.value) {
    hasRestoredScrollPosition = true;
  }
}
```

3. Ensure the `renderCurrentChapter` function also checks for null before accessing articleRef:

The function at line 141 already has a proper null check:
```javascript
if (!articleRef.value || !bookStore.currentBook) return;
```

Apply the same pattern to the scroll position restoration logic.

4. Consider using a `nextTick` to ensure the ref is available:

```javascript
if (!hasRestoredScrollPosition && bookStore.currentScrollPosition > 0) {
  await nextTick();
  if (containerRef.value) {
    containerRef.value.scrollTop = bookStore.currentScrollPosition;
    hasRestoredScrollPosition = true;
  }
}
```

This ensures the DOM is fully updated before attempting to access the ref.
