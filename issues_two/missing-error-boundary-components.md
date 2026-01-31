# Missing Error Boundary Components

## Severity: High

## Affected Files
- `src/App.vue`
- `src/components/BookViewer.vue`
- `src/components/HomeScreen.vue`
- `src/stores/book.ts`
- `src/composables/useEpub.ts`

## Description
The application lacks error boundary components to catch and handle runtime errors gracefully. Current error handling is inconsistent:

**App.vue - No error boundary:**
- Only has basic try-catch for file loading (lines 21-23)
- No protection against component-level errors

**BookViewer.vue - No error boundary:**
- Large component with many operations that could fail
- No protection against rendering errors
- Uses `console.error` and `console.warn` extensively

**HomeScreen.vue - No error boundary:**
- Multiple async operations without error boundaries
- Loading covers, opening books can fail without user feedback

**book.ts store - Limited error handling:**
- Line 59: Only catches errors in `loadBook`
- No error boundary for store operations

**useEpub.ts - Console-only error handling:**
- Lines 207, 212, 307, 348, 394, 398, 405, 433: Uses `console.warn` for errors
- No user-facing error messages
- Errors can silently fail

## Why This Is Problematic
- **Poor User Experience**: Errors cause app to crash or show blank screens
- **Silent Failures**: Errors logged to console but users aren't informed
- **Debugging Difficulty**: Hard to track where errors originate
- **No Recovery Path**: Users cannot recover from errors without refreshing
- **Accessibility Issues**: Screen readers announce errors poorly
- **No Error Reporting**: No way to track or report errors

## Implementation Plan

### Step 1: Create Error Boundary Component

Create `src/components/ErrorBoundary.vue`:
```vue
<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';

interface Props {
  fallback?: 'message' | 'component';
  onError?: (error: Error, vm: any, info: string) => void;
}

const props = withDefaults(defineProps<Props>(), {
  fallback: 'message',
});

const error = ref<Error | null>(null);
const errorInfo = ref<string>('');

onErrorCaptured((err: Error, vm: any, info: string) => {
  error.value = err;
  errorInfo.value = info;

  props.onError?.(err, vm, info);

  // Log error to error tracking service
  logErrorToService(err, vm, info);

  // Prevent error from propagating further
  return false;
});

function logErrorToService(error: Error, vm: any, info: string) {
  // Could integrate with Sentry, LogRocket, etc.
  console.error('Error captured by boundary:', error, info);
}

function reset() {
  error.value = null;
  errorInfo.value = '';
}

function reload() {
  window.location.reload();
}
</script>

<template>
  <slot v-if="!error" />

  <!-- Fallback UI when error occurs -->
  <div v-else class="error-boundary">
    <div class="error-boundary-content">
      <div class="error-icon">
        <svg class="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      <h2 class="error-title">Something went wrong</h2>

      <p class="error-message">
        An unexpected error occurred while rendering this component.
      </p>

      <details v-if="error" class="error-details">
        <summary>Error Details</summary>
        <div class="error-stack">
          <strong>Error:</strong> {{ error.message }}
          <pre v-if="error.stack" class="stack-trace">{{ error.stack }}</pre>
        </div>
      </details>

      <div class="error-actions">
        <button @click="reset" class="btn btn-primary">
          Try Again
        </button>
        <button @click="reload" class="btn btn-secondary">
          Reload Page
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 2rem;
}

.error-boundary-content {
  max-width: 500px;
  text-align: center;
}

.error-icon {
  margin-bottom: 1.5rem;
}

.error-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1rem;
}

.error-message {
  color: #6b7280;
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

.error-details {
  text-align: left;
  margin-bottom: 1.5rem;
}

.error-stack {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-top: 0.5rem;
}

.stack-trace {
  font-size: 0.75rem;
  color: #6b7280;
  overflow-x: auto;
  white-space: pre-wrap;
}

.error-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.btn {
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  font-weight: 500;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background: #4f46e5;
  color: white;
}

.btn-primary:hover {
  background: #4338ca;
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #f9fafb;
}

@media (prefers-color-scheme: dark) {
  .error-title {
    color: #f9fafb;
  }

  .error-message {
    color: #9ca3af;
  }

  .error-stack {
    background: #1f2937;
    border-color: #374151;
    color: #9ca3af;
  }

  .btn-secondary {
    background: #1f2937;
    color: #f9fafb;
    border-color: #4b5563;
  }

  .btn-secondary:hover {
    background: #374151;
  }
}
</style>
```

### Step 2: Create Async Error Composable

Create `src/composables/useAsyncError.ts`:
```typescript
import { ref, Ref } from 'vue';

export interface AsyncErrorOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export interface AsyncErrorResult<T> {
  data: Ref<T | null>;
  error: Ref<Error | null>;
  isLoading: Ref<boolean>;
  execute: () => Promise<void>;
  reset: () => void;
}

export function useAsyncError<T>(
  asyncFn: () => Promise<T>,
  options: AsyncErrorOptions<T> = {}
): AsyncErrorResult<T> {
  const { onSuccess, onError } = options;

  const data = ref<T | null>(null);
  const error = ref<Error | null>(null);
  const isLoading = ref(false);

  async function execute() {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await asyncFn();
      data.value = result;
      onSuccess?.(result);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      error.value = errorObj;
      onError?.(errorObj);
      throw errorObj; // Re-throw for error boundary to catch
    } finally {
      isLoading.value = false;
    }
  }

  function reset() {
    data.value = null;
    error.value = null;
    isLoading.value = false;
  }

  return {
    data,
    error,
    isLoading,
    execute,
    reset,
  };
}
```

### Step 3: Create Toast Notification Component

Create `src/components/ToastNotification.vue`:
```vue
<script setup lang="ts">
import { ref, watch, computed } from 'vue';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

const toasts = ref<Toast[]>([]);

function addToast(message: string, type: Toast['type'] = 'info', duration = 5000) {
  const id = Date.now().toString();
  toasts.value.push({ id, message, type, duration });

  if (duration > 0) {
    setTimeout(() => removeToast(id), duration);
  }
}

function removeToast(id: string) {
  const index = toasts.value.findIndex(t => t.id === id);
  if (index > -1) {
    toasts.value.splice(index, 1);
  }
}

// Provide globally
provide('toast', {
  addToast,
  removeToast,
});

const iconMap = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
};

const typeClassMap = {
  success: 'bg-green-100 text-green-800 border-green-400 dark:bg-green-900/30 dark:text-green-300 dark:border-green-600',
  error: 'bg-red-100 text-red-800 border-red-400 dark:bg-red-900/30 dark:text-red-300 dark:border-red-600',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-400 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-600',
  info: 'bg-blue-100 text-blue-800 border-blue-400 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-600',
};
</script>

<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', typeClassMap[toast.type]]"
        >
          <span class="toast-icon">{{ iconMap[toast.type] }}</span>
          <span class="toast-message">{{ toast.message }}</span>
          <button @click="removeToast(toast.id)" class="toast-close">×</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border-left: 4px solid;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  min-width: 300px;
  max-width: 450px;
}

.toast-icon {
  font-weight: 600;
  font-size: 1.125rem;
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
}

.toast-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.25rem;
  line-height: 1;
  padding: 0;
  color: inherit;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.toast-close:hover {
  opacity: 1;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>
```

### Step 4: Create Error Logger Utility

Create `src/utils/errorLogger.ts`:
```typescript
interface ErrorLog {
  timestamp: Date;
  message: string;
  stack?: string;
  component?: string;
  additionalInfo?: Record<string, unknown>;
}

class ErrorLogger {
  private logs: ErrorLog[] = [];
  private maxLogs = 100;

  log(error: Error, context?: { component?: string; additionalInfo?: Record<string, unknown> }) {
    const logEntry: ErrorLog = {
      timestamp: new Date(),
      message: error.message,
      stack: error.stack,
      component: context?.component,
      additionalInfo: context?.additionalInfo,
    };

    this.logs.push(logEntry);

    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Send to external service (if configured)
    this.sendToService(logEntry);

    // Log to console
    console.error('[ErrorLogger]', error, context);
  }

  getLogs(): ErrorLog[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }

  private sendToService(log: ErrorLog) {
    // Integrate with error tracking service here
    // e.g., Sentry.captureException, etc.
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const errorLogger = new ErrorLogger();
```

### Step 5: Wrap Components with Error Boundaries

Update `src/App.vue`:
```vue
<script setup lang="ts">
import ErrorBoundary from '@/components/ErrorBoundary.vue';
import ToastNotification from '@/components/ToastNotification.vue';
// ... other imports
</script>

<template>
  <ErrorBoundary>
    <ToastNotification />
    <div :class="[themeClasses.bg, themeClasses.text]">
      <!-- Rest of app content -->
    </div>
  </ErrorBoundary>
</template>
```

Wrap specific risky components:
```vue
<ErrorBoundary>
  <BookViewer />
</ErrorBoundary>

<ErrorBoundary>
  <SearchPanel />
</ErrorBoundary>
```

### Step 6: Improve Error Handling in Stores

Update `src/stores/book.ts`:
```typescript
import { errorLogger } from '@/utils/errorLogger';

async function loadBook(file: File, shouldCache: boolean = true, existingBookId?: string): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    const { epub } = await import('@/composables/useEpub');
    const libraryStore = useLibraryStore();
    const book = await epub.loadEpub(file, existingBookId);

    const libraryProgress = await libraryStore.getReadingProgress(book.metadata.id);

    if (libraryProgress) {
      book.metadata.progress = libraryProgress.percentage;
      book.metadata.lastReadAt = new Date();
      book.metadata.currentChapter = libraryProgress.chapterIndex;
    }

    currentBook.value = book;
    currentChapter.value = 0;
    currentScrollPosition.value = 0;

    const savedProgress = readingProgress.value.get(book.metadata.id);

    if (savedProgress) {
      currentChapter.value = savedProgress.chapterIndex;
    }

    if (libraryProgress) {
      currentChapter.value = libraryProgress.chapterIndex;
      currentScrollPosition.value = libraryProgress.scrollPosition;
    }

    if (shouldCache) {
      const epubBlob = new Blob([await file.arrayBuffer()], { type: 'application/epub+zip' });
      await libraryStore.cacheBook(book.metadata, epubBlob, book.coverBlob);
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Failed to load book');
    error.value = error;

    // Log detailed error context
    errorLogger.log(error, {
      component: 'bookStore',
      additionalInfo: {
        fileName: file.name,
        fileSize: file.size,
        shouldCache,
        existingBookId,
      },
    });

    throw error;
  } finally {
    isLoading.value = false;
  }
}
```

### Step 7: Create Global Error Handler

Add to `src/main.ts`:
```typescript
import { errorLogger } from '@/utils/errorLogger';

app.config.errorHandler = (err, vm, info) => {
  console.error('Global error handler:', err);
  errorLogger.log(err instanceof Error ? err : new Error(String(err)), {
    component: vm?.$options?.name || 'Unknown',
    additionalInfo: { info },
  });
};

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  errorLogger.log(
    event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
    {
      component: 'Global',
      additionalInfo: { type: 'unhandledrejection' },
    }
  );
});
```

### Benefits After Refactoring
- Graceful error recovery
- Better user experience
- Error tracking and reporting
- Consistent error handling
- Easier debugging
