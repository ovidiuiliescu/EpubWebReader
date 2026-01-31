# Code Duplication - Cover Loading Logic

## Severity: Medium

## Affected Files
- `src/components/HomeScreen.vue:31-39`
- `src/components/LibraryPanel.vue:33-41`

## Description
Cover image loading logic is duplicated across `HomeScreen.vue` and `LibraryPanel.vue` with nearly identical implementations:

**HomeScreen.vue:**
```typescript
async function loadCovers() {
  for (const book of libraryStore.books) {
    const cover = await libraryStore.getCoverImage(book.id);
    if (cover) {
      const url = URL.createObjectURL(cover);
      coverUrls.value.set(book.id, url);
    }
  }
}
```

**LibraryPanel.vue:**
```typescript
async function loadCovers() {
  for (const book of libraryStore.books) {
    const cover = await libraryStore.getCoverImage(book.id);
    if (cover) {
      const url = URL.createObjectURL(cover);
      coverUrls.value.set(book.id, url);
    }
  }
}
```

Additionally, both components have identical cleanup logic in `onUnmounted`.

## Why This Is Problematic
- **DRY Violation**: Identical logic exists in two places
- **Memory Leak Risk**: Both components manually manage `URL.revokeObjectURL`, increasing risk of mistakes
- **Inconsistent Behavior**: If one component's implementation diverges, users may see different behaviors
- **Poor Reusability**: The cover loading logic could be useful elsewhere but is trapped in components
- **Testing Overhead**: Same logic must be tested in multiple components

## Implementation Plan

### Step 1: Create Cover Management Composable
Create a new composable `src/composables/useCoverImages.ts`:
```typescript
import { ref, onUnmounted } from 'vue';
import { useLibraryStore } from '@/stores/library';

export function useCoverImages() {
  const libraryStore = useLibraryStore();
  const coverUrls = ref<Map<string, string>>(new Map());

  async function loadCovers() {
    for (const book of libraryStore.books) {
      const cover = await libraryStore.getCoverImage(book.id);
      if (cover) {
        const url = URL.createObjectURL(cover);
        coverUrls.value.set(book.id, url);
      }
    }
  }

  async function loadCover(bookId: string): Promise<string | null> {
    const cover = await libraryStore.getCoverImage(bookId);
    if (cover) {
      const url = URL.createObjectURL(cover);
      coverUrls.value.set(bookId, url);
      return url;
    }
    return null;
  }

  function getCoverUrl(bookId: string): string | undefined {
    return coverUrls.value.get(bookId);
  }

  function hasCover(bookId: string): boolean {
    return coverUrls.value.has(bookId);
  }

  function revokeCover(bookId: string): void {
    const url = coverUrls.value.get(bookId);
    if (url) {
      URL.revokeObjectURL(url);
      coverUrls.value.delete(bookId);
    }
  }

  function clearAllCovers(): void {
    coverUrls.value.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    coverUrls.value.clear();
  }

  onUnmounted(() => {
    clearAllCovers();
  });

  return {
    coverUrls,
    loadCovers,
    loadCover,
    getCoverUrl,
    hasCover,
    revokeCover,
    clearAllCovers,
  };
}
```

### Step 2: Update HomeScreen.vue
Refactor `src/components/HomeScreen.vue` to use the new composable:
```typescript
// Replace coverUrls ref and loadCovers function with:
import { useCoverImages } from '@/composables/useCoverImages';

const { coverUrls, loadCovers } = useCoverImages();

// Remove the onUnmounted cleanup logic (lines 24-29)
// It's now handled by the composable
```

### Step 3: Update LibraryPanel.vue
Refactor `src/components/LibraryPanel.vue` to use the new composable:
```typescript
// Replace coverUrls ref and loadCovers function with:
import { useCoverImages } from '@/composables/useCoverImages';

const { coverUrls, loadCovers } = useCoverImages();

// Remove the onUnmounted cleanup logic (lines 26-31)
// It's now handled by the composable
```

### Step 4: Update Remove Book Logic
When removing a book, ensure the cover URL is revoked:
```typescript
// In HomeScreen.vue or LibraryPanel.vue
async function removeBook(id: string) {
  await libraryStore.removeBook(id);
  if (bookStore.metadata?.id === id) {
    bookStore.clearBook();
  }
  // Use the composable's revokeCover method
  revokeCover(id);
}
```

### Step 5: Add Unit Tests
Create tests for the composable:
```typescript
// tests/composables/useCoverImages.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCoverImages } from '@/composables/useCoverImages';

describe('useCoverImages', () => {
  it('loads covers from library store', async () => {
    const { coverUrls, loadCovers } = useCoverImages();
    await loadCovers();
    expect(coverUrls.value.size).toBeGreaterThan(0);
  });

  it('cleans up URLs on unmount', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const { clearAllCovers } = useCoverImages();
    clearAllCovers();
    expect(revokeSpy).toHaveBeenCalled();
  });
});
```

### Step 6: Consider Adding Cache Layer
For better performance, consider adding a cache layer to avoid reloading covers:
```typescript
// Store cache in localStorage or session storage
// Check cache before loading from library store
```

### Step 7: Add Error Handling
Improve error handling in the composable:
```typescript
async function loadCovers() {
  try {
    for (const book of libraryStore.books) {
      try {
        const cover = await libraryStore.getCoverImage(book.id);
        if (cover) {
          const url = URL.createObjectURL(cover);
          coverUrls.value.set(book.id, url);
        }
      } catch (err) {
        console.warn(`Failed to load cover for book: ${book.id}`, err);
      }
    }
  } catch (err) {
    console.error('Failed to load covers:', err);
    throw err;
  }
}
```
