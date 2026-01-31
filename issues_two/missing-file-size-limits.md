# Missing File Size Limits

## Severity
High

## Affected Files
- `src/stores/book.ts:22-64` (loadBook function)
- `src/stores/library.ts:54-80` (cacheBook function)
- `src/composables/useEpub.ts:79-137` (loadEpub function)

## Description
The application does not implement any file size limits for EPUB uploads. This creates several security and availability issues:

1. **No Maximum File Size Limit**: Users can upload arbitrarily large EPUB files
2. **No Per-User Storage Limits**: IndexedDB can be filled by a single user
3. **Memory Exhaustion**: Large files can cause the browser to crash
4. **Disk Space Exhaustion**: Cached books can fill up browser storage
5. **Denial of Service**: Attackers can upload files large enough to crash the application

```typescript
// Lines 22-64 in src/stores/book.ts - loadBook function
async function loadBook(file: File, shouldCache: boolean = true, existingBookId?: string): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    const { epub } = await import('@/composables/useEpub');
    const libraryStore = useLibraryStore();
    const book = await epub.loadEpub(file, existingBookId); // NO SIZE CHECK
    
    // ... rest of function ...
    
    if (shouldCache) {
      const epubBlob = new Blob([await file.arrayBuffer()], { type: 'application/epub+zip' });
      await libraryStore.cacheBook(book.metadata, epubBlob, book.coverBlob); // NO SIZE CHECK
    }
  } catch (err) {
    error.value = err instanceof Error ? err : new Error('Failed to load book');
    throw err;
  } finally {
    isLoading.value = false;
  }
}
```

## Potential Attack Vectors

### 1. Memory Exhaustion (Browser Crash)
```javascript
// Attacker creates or uploads a very large EPUB file
// Example: 1GB EPUB file containing uncompressed content

// When the application processes it:
// - file.arrayBuffer() allocates 1GB of memory
// - EPUB parsing creates additional memory overhead
// - Chrome/Firefox may crash or become unresponsive
```

### 2. IndexedDB Quota Exhaustion
```javascript
// IndexedDB has different quotas across browsers:
// Chrome: 60% of available disk space
// Firefox: 50MB per origin (can be increased by user)
// Safari: 1GB (approximate)

// An attacker uploads 50 large books (100MB each)
// Total: 5GB storage required
// Result: IndexedDB quota exceeded, application breaks for all books
```

### 3. Storage Pollution Attack
```javascript
// Attacker uploads many large books to fill storage
for (let i = 0; i < 100; i++) {
  const largeBook = createLargeEPUB(100 * 1024 * 1024); // 100MB each
  uploadBook(largeBook);
}
// User's browser storage is filled with 10GB of data
// Application becomes unusable
```

### 4. Cache Poisoning via Large Files
```javascript
// Attack vector: Upload book that exceeds cache limit
// Current implementation (MAX_CACHED_BOOKS = 10) doesn't account for size

const attackFile = createBookWithLargeCover(50 * 1024 * 1024); // 50MB cover image
// This single book can consume the entire allocated storage
```

## Implementation Plan

### Step 1: Define size limits in constants
Create `src/constants/storage.ts`:
```typescript
/**
 * Maximum size for a single EPUB file upload (100MB)
 */
export const MAX_EPUB_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Minimum size for a valid EPUB file (1KB)
 */
export const MIN_EPUB_FILE_SIZE = 1024; // 1KB

/**
 * Maximum size for cover images (5MB)
 */
export const MAX_COVER_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Maximum total storage for cached books (500MB)
 */
export const MAX_TOTAL_CACHE_SIZE = 500 * 1024 * 1024; // 500MB

/**
 * Maximum number of cached books (already defined, but ensure it's enforced)
 */
export const MAX_CACHED_BOOKS = 10;

/**
 * Safe storage margin (keep 20% free)
 */
export const STORAGE_MARGIN_PERCENT = 20;

/**
 * Estimated storage overhead per book (metadata, progress, etc.)
 */
export const BOOK_METADATA_OVERHEAD = 50 * 1024; // 50KB per book

/**
 * Maximum number of concurrent file uploads
 */
export const MAX_CONCURRENT_UPLOADS = 3;

/**
 * Maximum memory for file processing (per file)
 */
export const MAX_PROCESSING_MEMORY = 500 * 1024 * 1024; // 500MB
```

### Step 2: Create storage validation utility
Create `src/utils/storageValidation.ts`:
```typescript
import {
  MAX_EPUB_FILE_SIZE,
  MIN_EPUB_FILE_SIZE,
  MAX_COVER_IMAGE_SIZE,
  MAX_TOTAL_CACHE_SIZE,
  MAX_CACHED_BOOKS,
  BOOK_METADATA_OVERHEAD,
  STORAGE_MARGIN_PERCENT
} from '@/constants/storage';

export interface StorageQuota {
  used: number;
  quota: number;
  remaining: number;
  usagePercent: number;
  isNearLimit: boolean;
  isOverLimit: boolean;
}

/**
 * Get current storage usage and quota
 */
export async function getStorageQuota(): Promise<StorageQuota> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || Infinity;
      const remaining = quota - used;
      const usagePercent = (used / quota) * 100;
      
      // Consider "near limit" when using 80% of quota
      const isNearLimit = usagePercent > (100 - STORAGE_MARGIN_PERCENT);
      const isOverLimit = used >= quota;

      return { used, quota, remaining, usagePercent, isNearLimit, isOverLimit };
    } catch (error) {
      console.warn('Failed to get storage quota:', error);
    }
  }

  // Fallback: estimate from IndexedDB
  return estimateIndexedDBUsage();
}

/**
 * Estimate IndexedDB usage (fallback method)
 */
async function estimateIndexedDBUsage(): Promise<StorageQuota> {
  try {
    const db = await openDB('epub-web-reader', 2);
    const transaction = db.transaction('books', 'readonly');
    const store = transaction.objectStore('books');
    const allBooks = await store.getAll();
    
    let totalSize = 0;
    for (const book of allBooks) {
      // Estimate size
      totalSize += estimateObjectSize(book);
    }
    
    // Default quota estimate (conservative)
    const quota = 100 * 1024 * 1024; // 100MB default
    const usagePercent = (totalSize / quota) * 100;
    const remaining = quota - totalSize;
    
    return {
      used: totalSize,
      quota,
      remaining,
      usagePercent,
      isNearLimit: usagePercent > (100 - STORAGE_MARGIN_PERCENT),
      isOverLimit: totalSize >= quota
    };
  } catch (error) {
    console.warn('Failed to estimate IndexedDB usage:', error);
    return {
      used: 0,
      quota: Infinity,
      remaining: Infinity,
      usagePercent: 0,
      isNearLimit: false,
      isOverLimit: false
    };
  }
}

/**
 * Estimate object size for storage calculation
 */
function estimateObjectSize(obj: any): number {
  if (!obj) return 0;

  const jsonString = JSON.stringify(obj);
  return jsonString.length * 2; // UTF-16 = 2 bytes per character
}

/**
 * Validate file size before upload
 */
export function validateFileSize(
  file: File,
  maxSize: number = MAX_EPUB_FILE_SIZE,
  minSize: number = MIN_EPUB_FILE_SIZE
): { valid: boolean; error?: string } {
  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty'
    };
  }

  if (file.size < minSize) {
    return {
      valid: false,
      error: `File is too small. Minimum size is ${formatBytes(minSize)}`
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File is too large. Maximum size is ${formatBytes(maxSize)} (file is ${formatBytes(file.size)})`
    };
  }

  return { valid: true };
}

/**
 * Validate cover image size
 */
export function validateCoverSize(
  blob: Blob,
  maxSize: number = MAX_COVER_IMAGE_SIZE
): { valid: boolean; error?: string } {
  if (blob.size > maxSize) {
    return {
      valid: false,
      error: `Cover image is too large. Maximum size is ${formatBytes(maxSize)}`
    };
  }

  return { valid: true };
}

/**
 * Check if there's enough storage space for a new book
 */
export async function checkStorageSpace(
  bookSize: number,
  maxTotalSize: number = MAX_TOTAL_CACHE_SIZE
): Promise<{ valid: boolean; error?: string; currentUsage?: number }> {
  try {
    const quota = await getStorageQuota();
    
    // Calculate expected size including overhead
    const expectedSize = bookSize + BOOK_METADATA_OVERHEAD;
    
    // Check against browser quota
    if (quota.remaining < expectedSize) {
      return {
        valid: false,
        error: `Not enough storage space. Required: ${formatBytes(expectedSize)}, Available: ${formatBytes(quota.remaining)}`
      };
    }

    // Check against application limit
    const currentUsage = quota.used;
    if (currentUsage + expectedSize > maxTotalSize) {
      return {
        valid: false,
        error: `Cache size limit reached. Total cache cannot exceed ${formatBytes(maxTotalSize)} (currently using ${formatBytes(currentUsage)})`
      };
    }

    // Check if near limit
    if (quota.isNearLimit) {
      return {
        valid: true,
        error: `Warning: Storage is ${quota.usagePercent.toFixed(1)}% full. Consider removing old books.`,
        currentUsage: quota.used
      };
    }

    return { valid: true, currentUsage: quota.used };
  } catch (error) {
    console.warn('Failed to check storage space:', error);
    // Allow operation if we can't check
    return { valid: true };
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Get storage usage for books store
 */
async function getBooksStorageUsage(): Promise<number> {
  try {
    const { openDB } = await import('idb');
    const db = await openDB('epub-web-reader', 2);
    const transaction = db.transaction('books', 'readonly');
    const store = transaction.objectStore('books');
    const allBooks = await store.getAll();
    db.close();

    let totalSize = 0;
    for (const book of allBooks) {
      // Estimate size of book data
      const epubSize = book.epubBlob?.size || 0;
      const coverSize = book.coverImage?.size || 0;
      const metadataSize = estimateObjectSize(book.metadata);
      const progressSize = estimateObjectSize(book.readingProgress);
      
      totalSize += epubSize + coverSize + metadataSize + progressSize;
    }

    return totalSize;
  } catch (error) {
    console.warn('Failed to calculate storage usage:', error);
    return 0;
  }
}
```

### Step 3: Update book store with validation
Update `src/stores/book.ts`:
```typescript
import {
  validateFileSize,
  checkStorageSpace,
  formatBytes
} from '@/utils/storageValidation';
import { MAX_EPUB_FILE_SIZE } from '@/constants/storage';

async function loadBook(file: File, shouldCache: boolean = true, existingBookId?: string): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    // VALIDATE FILE SIZE
    const sizeValidation = validateFileSize(file, MAX_EPUB_FILE_SIZE);
    if (!sizeValidation.valid) {
      const error = new Error(sizeValidation.error);
      error.name = 'FileValidationError';
      throw error;
    }

    // CHECK STORAGE SPACE
    if (shouldCache) {
      const spaceValidation = await checkStorageSpace(file.size);
      if (!spaceValidation.valid) {
        const error = new Error(spaceValidation.error);
        error.name = 'StorageQuotaError';
        throw error;
      }
      
      // Show warning if near limit
      if (spaceValidation.error) {
        console.warn(spaceValidation.error);
        // You could also show a toast notification to user
      }
    }

    const { epub } = await import('@/composables/useEpub');
    const libraryStore = useLibraryStore();
    const book = await epub.loadEpub(file, existingBookId);
    
    // ... rest of existing code ...

    if (shouldCache) {
      const epubBlob = new Blob([await file.arrayBuffer()], { type: 'application/epub+zip' });
      await libraryStore.cacheBook(book.metadata, epubBlob, book.coverBlob);
    }
  } catch (err) {
    error.value = err instanceof Error ? err : new Error('Failed to load book');
    throw err;
  } finally {
    isLoading.value = false;
  }
}
```

### Step 4: Update library store with size checking
Update `src/stores/library.ts`:
```typescript
import {
  validateCoverSize,
  getBooksStorageUsage,
  formatBytes
} from '@/utils/storageValidation';
import {
  MAX_TOTAL_CACHE_SIZE,
  MAX_CACHED_BOOKS,
  BOOK_METADATA_OVERHEAD
} from '@/constants/storage';

async function cacheBook(
  metadata: BookMetadata,
  epubBlob: Blob,
  coverImage?: Blob
): Promise<void> {
  if (!db.value) return;

  // VALIDATE COVER IMAGE SIZE
  if (coverImage) {
    const coverValidation = validateCoverSize(coverImage);
    if (!coverValidation.valid) {
      console.warn(coverValidation.error);
      // Remove cover if too large
      coverImage = undefined;
    }
  }

  // CHECK CACHE LIMITS
  const currentUsage = await getBooksStorageUsage();
  const newSize = epubBlob.size + 
                 (coverImage?.size || 0) + 
                 BOOK_METADATA_OVERHEAD;
  
  const existing = await db.value.get('books', metadata.id);
  const existingSize = existing ? 
    (existing.epubBlob?.size || 0) + 
    (existing.coverImage?.size || 0) + 
    BOOK_METADATA_OVERHEAD : 0;
  
  const totalWithNew = currentUsage - existingSize + newSize;
  
  if (totalWithNew > MAX_TOTAL_CACHE_SIZE) {
    // Need to make room before caching
    await makeRoomForBook(totalWithNew - MAX_TOTAL_CACHE_SIZE + newSize);
  }

  const bookCount = await db.value.count('books');
  if (bookCount >= MAX_CACHED_BOOKS && !existing) {
    await removeOldestBook();
  }

  if (existing) {
    await db.value.put('books', {
      ...existing,
      metadata,
      coverImage,
    });
  } else {
    await checkCacheLimit();
    await db.value.add('books', {
      id: metadata.id,
      metadata,
      epubBlob,
      coverImage,
      addedAt: new Date(),
    });
  }

  await loadBooks();
}

/**
 * Make room in cache by removing old books
 */
async function makeRoomForBook(requiredSpace: number): Promise<void> {
  if (!db.value) return;
  
  // Get books sorted by age (oldest first)
  const allBooks = await db.value.getAllFromIndex('books', 'addedAt');
  
  let freedSpace = 0;
  for (const book of allBooks) {
    if (freedSpace >= requiredSpace) break;
    
    const bookSize = (book.epubBlob?.size || 0) + 
                     (book.coverImage?.size || 0) + 
                     BOOK_METADATA_OVERHEAD;
    
    await db.value.delete('books', book.id);
    freedSpace += bookSize;
    
    console.log(`Removed old book to free space: ${formatBytes(bookSize)}`);
  }
}

/**
 * Remove the oldest book from cache
 */
async function removeOldestBook(): Promise<void> {
  if (!db.value) return;
  
  const allBooks = await db.value.getAllFromIndex('books', 'addedAt');
  if (allBooks.length > 0) {
    await db.value.delete('books', allBooks[0].id);
  }
}
```

### Step 5: Add storage monitoring utility
Create `src/utils/storageMonitor.ts`:
```typescript
import { getStorageQuota, formatBytes } from '@/utils/storageValidation';

export class StorageMonitor {
  private interval: number | null = null;
  private callback: (quota: any) => void;
  private checkInterval = 30000; // Check every 30 seconds

  constructor(callback: (quota: any) => void) {
    this.callback = callback;
  }

  start() {
    this.check();
    this.interval = window.setInterval(() => {
      this.check();
    }, this.checkInterval);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async check() {
    const quota = await getStorageQuota();
    this.callback(quota);

    if (quota.isOverLimit) {
      console.error('Storage quota exceeded!');
      // Trigger cleanup or notify user
    }
  }
}

export function formatStorageInfo(quota: any): string {
  return `Storage: ${formatBytes(quota.used)} / ${formatBytes(quota.quota)} (${quota.usagePercent.toFixed(1)}%)`;
}
```

### Step 6: Add tests
Create `tests/storage-validation.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  validateFileSize,
  validateCoverSize,
  formatBytes,
  getStorageQuota
} from '@/utils/storageValidation';

describe('validateFileSize', () => {
  it('should accept file within limits', () => {
    const file = new File(['test'], 'test.epub');
    const result = validateFileSize(file);
    expect(result.valid).toBe(true);
  });

  it('should reject empty files', () => {
    const file = new File([], 'test.epub');
    const result = validateFileSize(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('should reject files that are too large', () => {
    const largeData = new Uint8Array(200 * 1024 * 1024); // 200MB
    const file = new File([largeData], 'large.epub');
    const result = validateFileSize(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too large');
  });
});

describe('validateCoverSize', () => {
  it('should accept cover within limits', () => {
    const blob = new Blob(['test'], { type: 'image/png' });
    const result = validateCoverSize(blob);
    expect(result.valid).toBe(true);
  });

  it('should reject oversized covers', () => {
    const largeData = new Uint8Array(10 * 1024 * 1024); // 10MB
    const blob = new Blob([largeData], { type: 'image/jpeg' });
    const result = validateCoverSize(blob);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too large');
  });
});

describe('formatBytes', () => {
  it('should format bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
    expect(formatBytes(1073741824)).toBe('1 GB');
  });
});
```

## Additional Recommendations
1. **User-Friendly Storage Management UI**: Show storage usage to users
2. **Auto-Cleanup**: Automatically remove old books when space is low
3. **Compressed Storage**: Consider compressing book metadata
4. **Selective Caching**: Only cache frequently accessed books
5. **Storage Persistence Warning**: Warn users before clearing browser data
6. **Fallback to IndexedDB**: Use both localStorage and IndexedDB strategically

## Related Issues
- See also: `missing-file-type-validation.md` (File type validation)
- See also: `insecure-indexeddb-usage.md` (IndexedDB security)
