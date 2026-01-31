# Empty Catch Block Swallows Errors in LibraryPanel

## Severity
Medium

## Affected Files
- `src/components/LibraryPanel.vue:84-91`

## Description
The `handleFileUpload` function contains an empty catch block that swallows all errors without providing any user feedback:

```javascript
async function handleFileUpload(file: File) {
  try {
    await bookStore.loadBook(file, true);
    emit('close');
  } catch (err) {
    console.error('Failed to load book:', err);
  }
}
```

## Why This Is A Problem
The AGENTS.md guideline explicitly states: "Never use empty catch blocks; always handle or log errors". While this code does log the error to the console, it provides no user-facing feedback, which creates a poor user experience:

1. **Silent failures**: If a book fails to load, the panel closes but no error is shown to the user
2. **No retry mechanism**: Users don't know what went wrong or how to fix it
3. **Confusion**: The UI state remains unchanged, making it unclear whether the operation succeeded or failed
4. **Debugging difficulty**: Console errors are not visible to non-technical users

The code also logs to console but does not inform the user, violating best practices for error handling in user-facing applications.

## Implementation Plan

1. Add an error state to the component:

```javascript
const error = ref<string | null>(null);
const isLoading = ref(false);
```

2. Update the `handleFileUpload` function to handle errors properly:

```javascript
async function handleFileUpload(file: File) {
  error.value = null;
  isLoading.value = true;
  
  try {
    await bookStore.loadBook(file, true);
    emit('close');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load book';
    error.value = errorMessage;
    console.error('Failed to load book:', err);
  } finally {
    isLoading.value = false;
  }
}
```

3. Add error display in the template (near the upload button or header):

```javascript
<div v-if="error" class="p-4 mb-4 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg">
  <div class="flex items-center gap-2">
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span class="text-sm">{{ error }}</span>
  </div>
</div>
```

4. Show loading state during upload:

```javascript
<button
  @click="openFilePicker"
  class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  :disabled="isLoading"
  title="Add Book to Library"
>
  <svg v-if="!isLoading" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
  </svg>
  <svg v-else class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
  <span>{{ isLoading ? 'Loading...' : 'Add Book' }}</span>
</button>
```

5. Add a close button to dismiss the error:

```javascript
<button
  v-if="error"
  @click="error = null"
  class="absolute top-2 right-2 p-1 rounded hover:bg-red-200 dark:hover:bg-red-800/50"
  aria-label="Dismiss error"
>
  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
  </svg>
</button>
```

6. Optionally, create a reusable error banner component that can be used across the application.
