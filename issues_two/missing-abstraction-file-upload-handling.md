# Missing Abstraction - File Upload and Drop Handling

## Severity: Medium

## Affected Files
- `src/components/DropZone.vue:1-129`
- `src/components/HomeScreen.vue:82-113`
- `src/components/LibraryPanel.vue:157-173`
- `src/App.vue:19-27`

## Description
File upload and drag-and-drop handling logic is duplicated and scattered across multiple components without a unified abstraction:

**DropZone.vue** - Dedicated drop zone component
- Handles drag over, drag leave, drop events
- File input management
- Emits 'drop' event with File object

**HomeScreen.vue** - Has its own drop handling
- Lines 82-113: Drag over/leave/drop handlers
- Lines 18, 23-28, 32-37, 42, 111: File input management

**LibraryPanel.vue** - Also has its own drop handling
- Lines 82-102: Drag over/leave/drop handlers
- Lines 15, 33, 61-63, 105-108, 111: File input management

**App.vue** - File validation logic
- Lines 19-27: Basic validation (checks .epub extension)

## Why This Is Problematic
- **Code Duplication**: Drag-and-drop logic duplicated 3+ times
- **Inconsistent Validation**: File validation is only in one place (App.vue)
- **Maintenance Burden**: Changes to file handling require updates in multiple files
- **Poor Reusability**: Cannot easily add new drop zones without duplicating code
- **Inconsistent UX**: Different behaviors may emerge across different drop zones
- **Error Handling**: Each component handles errors differently

## Implementation Plan

### Step 1: Create File Upload Composable

Create `src/composables/useFileUpload.ts`:
```typescript
import { ref } from 'vue';

export interface FileUploadOptions {
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in bytes
  onValidationError?: (error: ValidationError) => void;
  onFileSelect?: (files: File[]) => void;
}

export type ValidationError =
  | { type: 'invalid-extension'; extensions: string[] }
  | { type: 'file-too-large'; maxSize: number }
  | { type: 'no-files' }
  | { type: 'invalid-type' };

export interface FileUploadReturn {
  isDragging: boolean;
  fileInputRef: Ref<HTMLInputElement | null>;
  handleDragOver: (event: DragEvent) => void;
  handleDragLeave: (event: DragEvent) => void;
  handleDrop: (event: DragEvent) => void;
  handleFileSelect: (event: Event) => void;
  openFileDialog: () => void;
}

export function useFileUpload(options: FileUploadOptions = {}): FileUploadReturn {
  const {
    accept = '.epub,.EPUB',
    multiple = false,
    maxSize,
    onValidationError,
    onFileSelect,
  } = options;

  const isDragging = ref(false);
  const fileInputRef = ref<HTMLInputElement | null>(null);

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragging.value = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    // Only clear if we're actually leaving the drop zone
    const relatedTarget = event.relatedTarget as Node;
    const currentTarget = event.currentTarget as HTMLElement;
    if (!currentTarget.contains(relatedTarget)) {
      isDragging.value = false;
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging.value = false;

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) {
      onValidationError?.({ type: 'no-files' });
      return;
    }

    validateAndProcessFiles(Array.from(files));
  }

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (!files || files.length === 0) {
      onValidationError?.({ type: 'no-files' });
      return;
    }

    validateAndProcessFiles(Array.from(files));
  }

  function validateAndProcessFiles(files: File[]) {
    const acceptedExtensions = accept
      .split(',')
      .map(ext => ext.trim().replace('.', '').toLowerCase());

    const validatedFiles: File[] = [];

    for (const file of files) {
      // Check file extension
      const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
      if (!acceptedExtensions.includes(fileExt)) {
        onValidationError?.({
          type: 'invalid-extension',
          extensions: acceptedExtensions,
        });
        continue;
      }

      // Check file size
      if (maxSize && file.size > maxSize) {
        onValidationError?.({
          type: 'file-too-large',
          maxSize,
        });
        continue;
      }

      validatedFiles.push(file);
    }

    if (validatedFiles.length > 0) {
      onFileSelect?.(multiple ? validatedFiles : [validatedFiles[0]]);
    }
  }

  function openFileDialog() {
    fileInputRef.value?.click();
  }

  return {
    isDragging,
    fileInputRef,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    openFileDialog,
  };
}
```

### Step 2: Create Reusable DropZone Component

Create `src/components/UniversalDropZone.vue`:
```vue
<script setup lang="ts">
import { useFileUpload } from '@/composables/useFileUpload';
import type { FileUploadOptions } from '@/composables/useFileUpload';

interface Props {
  options?: FileUploadOptions;
  variant?: 'full-screen' | 'compact' | 'inline';
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'full-screen',
});

const emit = defineEmits<{
  'drop': [files: File[]];
  'error': [error: Error];
}>();

const upload = useFileUpload({
  ...props.options,
  onValidationError: (error) => {
    emit('error', new Error(`Validation error: ${JSON.stringify(error)}`));
  },
  onFileSelect: (files) => {
    emit('drop', files);
  },
});
</script>

<template>
  <div
    class="relative"
    :class="[
      variant === 'full-screen' ? 'min-h-screen' : 'min-h-0',
      variant === 'compact' ? 'flex-1' : '',
    ]"
    @dragover="upload.handleDragOver"
    @dragleave="upload.handleDragLeave"
    @drop="upload.handleDrop"
  >
    <div
      class="transition-all duration-300"
      :class="[
        upload.isDragging ? 'scale-105 ring-4 ring-indigo-500' : '',
      ]"
    >
      <slot :is-dragging="upload.isDragging" :open-dialog="upload.openFileDialog" />
    </div>

    <input
      ref="upload.fileInputRef"
      type="file"
      :accept="upload.options?.accept || '.epub,.EPUB'"
      :multiple="upload.options?.multiple || false"
      class="hidden"
      @change="upload.handleFileSelect"
    />
  </div>
</template>
```

### Step 3: Update DropZone Component

Refactor `src/components/DropZone.vue` to use the composable:
```vue
<script setup lang="ts">
import { useFileUpload } from '@/composables/useFileUpload';

const emit = defineEmits<{
  drop: [file: File];
}>();

defineProps<{
  compact?: boolean;
}>();

const upload = useFileUpload({
  accept: '.epub,.EPUB',
  multiple: false,
  onFileSelect: (files) => {
    emit('drop', files[0]);
  },
});
</script>

<template>
  <div
    class="flex flex-col items-center justify-center"
    :class="compact ? 'flex-1 min-h-0' : 'min-h-screen'"
    @dragover="upload.handleDragOver"
    @dragleave="upload.handleDragLeave"
    @drop="upload.handleDrop"
  >
    <div
      class="w-full text-center border-4 border-dashed rounded-3xl transition-all duration-300 cursor-pointer"
      :class="[
        compact ? 'p-12' : 'p-16 max-w-2xl',
        upload.isDragging
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 scale-105'
          : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'
      ]"
      @click="upload.openFileDialog"
      @keydown.enter="upload.openFileDialog"
      tabindex="0"
      role="button"
      :aria-label="'Drop EPUB file or click to browse'"
    >
      <!-- Rest of template remains the same -->
    </div>
  </div>
</template>
```

### Step 4: Update HomeScreen Component

Simplify `src/components/HomeScreen.vue`:
```vue
<script setup lang="ts">
import { useFileUpload } from '@/composables/useFileUpload';
import { useCoverImages } from '@/composables/useCoverImages';
import { useLibraryStore } from '@/stores/library';
import { useBookStore } from '@/stores/book';

const emit = defineEmits<{
  'select-book': [file: File, shouldCache: boolean, existingBookId?: string];
}>();

const libraryStore = useLibraryStore();
const bookStore = useBookStore();
const { coverUrls, loadCovers } = useCoverImages();

const upload = useFileUpload({
  accept: '.epub,.EPUB',
  onFileSelect: (files) => {
    emit('select-book', files[0], true);
  },
});

// Remove handleLibraryDragOver, handleLibraryDragLeave, handleLibraryDrop, handleLibraryFileSelect
// Use upload.* instead
</script>

<template>
  <!-- Replace custom drag handlers with upload handlers -->
  <div
    class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 lg:p-8 border border-gray-200 dark:border-gray-700 flex flex-col h-full relative"
    @dragover="upload.handleDragOver"
    @dragleave="upload.handleDragLeave"
    @drop="upload.handleDrop"
    :class="{ 'ring-4 ring-indigo-500': upload.isDragging }"
  >
    <!-- Rest of template -->
    <input
      ref="upload.fileInputRef"
      type="file"
      accept=".epub,.EPUB"
      class="hidden"
      @change="upload.handleFileSelect"
    />
  </div>
</template>
```

### Step 5: Update LibraryPanel Component

Similarly refactor `src/components/LibraryPanel.vue` to use the composable.

### Step 6: Update App.vue

Simplify validation in `src/App.vue`:
```typescript
import { useFileUpload } from '@/composables/useFileUpload';

const upload = useFileUpload({
  accept: '.epub,.EPUB',
  onValidationError: (error) => {
    if (error.type === 'invalid-extension') {
      console.warn('Invalid file type:', error.extensions.join(', '));
    }
  },
  onFileSelect: (files) => {
    handleFileDrop(files[0], true);
  },
});

function handleFileDrop(file: File, shouldCache: boolean = true, existingBookId?: string) {
  bookStore.loadBook(file, shouldCache, existingBookId).catch(err => {
    console.error('Failed to load book:', err);
  });
}
```

### Step 7: Add Error Display Component

Create `src/components/UploadError.vue`:
```vue
<script setup lang="ts">
interface Props {
  error?: string;
}

defineProps<Props>();
</script>

<template>
  <div
    v-if="error"
    class="fixed top-4 right-4 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg"
  >
    <div class="flex items-center">
      <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
      </svg>
      <span>{{ error }}</span>
    </div>
  </div>
</template>
```

### Step 8: Add Unit Tests

```typescript
// tests/composables/useFileUpload.test.ts
import { describe, it, expect, vi } from 'vitest';
import { useFileUpload } from '@/composables/useFileUpload';

describe('useFileUpload', () => {
  it('validates file extensions correctly', () => {
    const upload = useFileUpload({ accept: '.epub' });
    // Test validation logic
  });

  it('validates file size when maxSize is set', () => {
    const upload = useFileUpload({ maxSize: 10 * 1024 * 1024 }); // 10MB
    // Test size validation
  });

  it('calls onFileSelect with valid files', () => {
    const onFileSelect = vi.fn();
    const upload = useFileUpload({ onFileSelect });
    // Test callback
  });
});
```

### Benefits After Refactoring
- Single source of truth for file upload logic
- Consistent validation across all drop zones
- Better error handling
- Easier to add new drop zones
- Improved testability
- Better user experience with consistent behavior
