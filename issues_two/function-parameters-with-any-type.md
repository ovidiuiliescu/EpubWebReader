# Function Parameters with 'any' Type

**Severity:** High

**Affected Files:**
- `src/components/HomeScreen.vue:41,49`
- `src/components/LibraryPanel.vue:65`
- `src/components/SearchPanel.vue:51`

## Description

Several functions use `any` as their parameter types, which defeats TypeScript's type checking for function arguments and can lead to runtime errors when incorrect data is passed.

### Specific Issues:

**src/components/HomeScreen.vue - Lines 41, 49:**
```typescript
async function openBook(metadata: any) {  // Line 41
  const blob = await libraryStore.getBookBlob(metadata.id);
  if (blob) {
    const file = new File([blob], `${metadata.title}.epub`, { type: 'application/epub+zip' });
    emit('select-book', file, false, metadata.id);
  }
}

async function exportBook(metadata: any) {  // Line 49
  const blob = await libraryStore.exportBook(metadata.id);
  if (blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata.title}.epub`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
```

**src/components/LibraryPanel.vue - Line 65:**
```typescript
async function openBook(metadata: any) {
  const blob = await libraryStore.getBookBlob(metadata.id);
  if (blob) {
    await bookStore.loadBook(
      new File([blob], metadata.title + '.epub', { type: 'application/epub+zip' }),
      false,
      metadata.id
    );
    emit('close');
  }
}
```

**src/components/SearchPanel.vue - Line 51:**
```typescript
function goToResult(result: any) {
  bookStore.setSearchHighlight({
    chapterIndex: result.chapterIndex,
    searchText: result.searchText,
    matchIndex: result.matchIndex,
  });
  bookStore.setChapter(result.chapterIndex);
}
```

## Why This is Problematic

1. **No Type Safety**: Functions accept any value, even if it doesn't have the required properties (`id`, `title`, `chapterIndex`, `searchText`, `matchIndex`).

2. **Runtime Errors**: If a malformed object is passed, accessing properties like `metadata.id` will throw a runtime error.

3. **Poor Documentation**: The function signature doesn't communicate what structure the parameter should have.

4. **Refactoring Risk**: If the `BookMetadata` interface changes, TypeScript won't warn about these functions using the old structure.

5. **IDE Support**: No auto-completion when accessing properties on the `any` parameter.

6. **Property Typos**: Typo in property names (e.g., `metadta.id`) won't be caught by TypeScript.

## Implementation Plan

### Step 1: Update HomeScreen.vue Parameters

Replace `any` with proper types:

```typescript
// src/components/HomeScreen.vue
import type { BookMetadata } from '@/types/epub';

async function openBook(metadata: BookMetadata): Promise<void> {
  const blob = await libraryStore.getBookBlob(metadata.id);
  if (blob) {
    const file = new File([blob], `${metadata.title}.epub`, { type: 'application/epub+zip' });
    emit('select-book', file, false, metadata.id);
  }
}

async function exportBook(metadata: BookMetadata): Promise<void> {
  const blob = await libraryStore.exportBook(metadata.id);
  if (blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata.title}.epub`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
```

### Step 2: Update LibraryPanel.vue Parameter

```typescript
// src/components/LibraryPanel.vue
import type { BookMetadata } from '@/types/epub';

async function openBook(metadata: BookMetadata): Promise<void> {
  const blob = await libraryStore.getBookBlob(metadata.id);
  if (blob) {
    await bookStore.loadBook(
      new File([blob], `${metadata.title}.epub`, { type: 'application/epub+zip' }),
      false,
      metadata.id
    );
    emit('close');
  }
}
```

### Step 3: Update SearchPanel.vue Parameter

```typescript
// src/components/SearchPanel.vue
import type { SearchResult } from '@/types/epub';

function goToResult(result: SearchResult): void {
  bookStore.setSearchHighlight({
    chapterIndex: result.chapterIndex,
    searchText: result.searchText,
    matchIndex: result.matchIndex,
  });
  bookStore.setChapter(result.chapterIndex);
}
```

### Step 4: Add Type Guards for Runtime Validation (Optional but Recommended)

For extra safety, add runtime validation when dealing with data that might come from external sources:

```typescript
// src/components/HomeScreen.vue
import type { BookMetadata } from '@/types/epub';

function isBookMetadata(value: unknown): value is BookMetadata {
  return (
    value !== null &&
    typeof value === 'object' &&
    'id' in value &&
    'title' in value &&
    typeof (value as BookMetadata).id === 'string' &&
    typeof (value as BookMetadata).title === 'string'
  );
}

async function openBook(metadata: unknown): Promise<void> {
  if (!isBookMetadata(metadata)) {
    console.error('Invalid book metadata:', metadata);
    return;
  }
  
  const blob = await libraryStore.getBookBlob(metadata.id);
  if (blob) {
    const file = new File([blob], `${metadata.title}.epub`, { type: 'application/epub+zip' });
    emit('select-book', file, false, metadata.id);
  }
}
```

**Note**: In this case, the `BookMetadata` interface is already being used from the store, so type guards may not be necessary. However, they can be useful if the data comes from an external source like an API or local storage.

### Step 5: Ensure Proper Type Imports

Make sure all files have the correct type imports:

**src/components/HomeScreen.vue:**
```typescript
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { useBookStore } from '@/stores/book';
import { useTheme } from '@/composables/useTheme';
import type { BookMetadata } from '@/types/epub';  // Add this import

// ... rest of the code
```

**src/components/LibraryPanel.vue:**
```typescript
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { useBookStore } from '@/stores/book';
import { useTheme } from '@/composables/useTheme';
import type { BookMetadata } from '@/types/epub';  // Add this import

// ... rest of the code
```

**src/components/SearchPanel.vue:**
```typescript
<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { useBookStore } from '@/stores/book';
import { useSearch } from '@/composables/useSearch';
import { useTheme } from '@/composables/useTheme';
import type { SearchResult } from '@/types/epub';  // Add this import

// ... rest of the code
```

## Priority Order

1. **CRITICAL**: Replace `any` with `BookMetadata` in HomeScreen.vue (line 41, 49)
2. **CRITICAL**: Replace `any` with `BookMetadata` in LibraryPanel.vue (line 65)
3. **CRITICAL**: Replace `any` with `SearchResult` in SearchPanel.vue (line 51)
4. **LOW**: Consider adding type guards for runtime validation if data comes from untrusted sources

## Testing Considerations

After implementing these changes:
- Verify that opening books from the library still works
- Verify that exporting books still works
- Verify that clicking on search results still navigates correctly
- Test with malformed data to ensure type errors are caught (if using type guards)
- Run TypeScript compiler to verify no type errors are introduced
