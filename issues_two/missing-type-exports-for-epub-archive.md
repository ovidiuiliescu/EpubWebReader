# Missing Type Exports for EPUB Archive and ZipFile

**Severity:** Medium

**Affected Files:**
- `src/composables/useEpub.ts:178,240,350,381,524`
- Missing: `src/types/epub.ts` (should include these types)

## Description

The code interacts with EPUB archive structures and ZIP files throughout `useEpub.ts`, but there are no proper TypeScript type definitions for these structures. The code uses type assertions like `archiveZip.files` without proper type safety.

### Specific Issues:

**src/composables/useEpub.ts:**
```typescript
Line 178:  const archiveZip = (book as any).archive?.zip;
           // archiveZip is of type 'any', but it should be a JSZip object

Line 240:  const archiveZip = (book as any).archive?.zip;

Line 350:  const archiveZip = (book as any).archive?.zip;

Line 381:  const allFiles = archiveZip.files ? Object.keys(archiveZip.files) : [];
           // archiveZip.files is accessed without knowing its type

Line 524:  const allFiles = archiveZip.files ? Object.keys(archiveZip.files) : [];
```

The code assumes:
1. `archive` is an object with a `zip` property
2. `zip` is an object with a `file()` method and a `files` property
3. `files` is a record mapping filenames to ZIP file objects
4. ZIP file objects have an `async()` method

None of these structures are properly typed.

## Why This is Problematic

1. **No Type Safety**: Working with archive files without proper types means TypeScript cannot verify correct property access or method calls.

2. **Library Coupling**: The code is tightly coupled to the internal structure of JSZip without documenting that dependency.

3. **Refactoring Risk**: If JSZip changes its API, there will be no compile-time warnings.

4. **Poor Developer Experience**: Developers don't know what properties and methods are available on `archiveZip` or `zipFile`.

5. **Potential Runtime Errors**: Misspelled property names or incorrect method signatures will only be caught at runtime.

## Implementation Plan

### Step 1: Add EPUB Archive Types to src/types/epub.ts

Add comprehensive types for EPUB archive structures:

```typescript
// src/types/epub.ts

// Add these new interfaces:

/**
 * Represents a file within a ZIP archive (from JSZip library)
 */
export interface ZipFile {
  /**
   * Read the contents of the file
   * @param type - The format to read the file as ('string', 'blob', or 'arraybuffer')
   */
  async(type: 'string' | 'blob' | 'arraybuffer'): Promise<string | Blob | ArrayBuffer>;
  
  /**
   * The file name (if available from JSZip)
   */
  name?: string;
  
  /**
   * The compressed size (if available from JSZip)
   */
  compressedSize?: number;
  
  /**
   * The uncompressed size (if available from JSZip)
   */
  uncompressedSize?: number;
}

/**
 * Represents a JSZip instance
 */
export interface JSZip {
  /**
   * Get a file from the archive
   * @param path - The path to the file within the archive
   * @returns The ZipFile object or null if not found
   */
  file(path: string): ZipFile | null;
  
  /**
   * All files in the archive, indexed by their path
   */
  files: Record<string, ZipFile>;
  
  /**
   * Load data into the JSZip instance
   */
  loadAsync?(data: ArrayBuffer | Blob): Promise<this>;
  
  /**
   * Generate the zip file
   */
  generateAsync?(options?: unknown): Promise<Blob>;
}

/**
 * Represents the EPUB book's archive container
 */
export interface EpubArchive {
  /**
   * The JSZip instance containing the EPUB's contents
   */
  zip: JSZip;
}

/**
 * Extended EPUB book instance with archive information
 */
export interface EpubBookInstance {
  ready: Promise<void>;
  loaded: {
    metadata: Promise<Record<string, unknown>>;
    package: Promise<Record<string, unknown>>;
    navigation: Promise<Record<string, unknown>>;
    rootfile?: Promise<Record<string, unknown>>;
  };
  archive?: EpubArchive;
  chapters?: Chapter[];
  coverUrl(): Promise<string | null>;
}
```

### Step 2: Update useEpub.ts to Use New Types

**Line 178 - getTitleFromChapter:**
```typescript
// Before:
async function getTitleFromChapter(book: any, chapterPath: string): Promise<string> {
  try {
    const archiveZip = (book as any).archive?.zip;
    if (!archiveZip) return '';

    let zipFile = archiveZip.file(chapterPath);

    if (!zipFile) {
      const allFiles = archiveZip.files ? Object.keys(archiveZip.files) : [];
      const matchingFile = allFiles.find(f => f.endsWith(chapterPath) || f.endsWith(`/${chapterPath}`));

      if (matchingFile) {
        zipFile = archiveZip.file(matchingFile);
      }
    }

    if (!zipFile) return '';

    const xhtml = await zipFile.async('string');
    // ...
  }
}

// After:
import type { EpubBookInstance, JSZip, ZipFile } from '@/types/epub';

async function getTitleFromChapter(book: EpubBookInstance, chapterPath: string): Promise<string> {
  try {
    const archive = book.archive;
    if (!archive) return '';
    
    const archiveZip: JSZip = archive.zip;
    
    let zipFile: ZipFile | null = archiveZip.file(chapterPath);

    if (!zipFile) {
      const allFiles = Object.keys(archiveZip.files);
      const matchingFile = allFiles.find(f => f.endsWith(chapterPath) || f.endsWith(`/${chapterPath}`));

      if (matchingFile) {
        zipFile = archiveZip.file(matchingFile);
      }
    }

    if (!zipFile) return '';

    const xhtml = await zipFile.async('string') as string;
    // ...
  }
}
```

**Line 240 - loadTocFromNcx:**
```typescript
// Before:
async function loadTocFromNcx(book: any): Promise<TocItem[]> {
  const toc: TocItem[] = [];
  try {
    const archiveZip = (book as any).archive?.zip;
    if (!archiveZip) return toc;

    let ncxFile = archiveZip.file('toc.ncx');
    // ...
  }
}

// After:
import type { EpubBookInstance, JSZip, ZipFile } from '@/types/epub';

async function loadTocFromNcx(book: EpubBookInstance): Promise<TocItem[]> {
  const toc: TocItem[] = [];
  try {
    const archive = book.archive;
    if (!archive) return toc;
    
    const archiveZip: JSZip = archive.zip;

    let ncxFile: ZipFile | null = archiveZip.file('toc.ncx');
    // ...
  }
}
```

**Line 350 - loadChapterContent:**
```typescript
// Before:
async function loadChapterContent(book: any, baseUrl: string | undefined, href: string, title: string): Promise<string> {
  try {
    const archiveZip = (book as any).archive?.zip;
    // ...
    if (!archiveZip || typeof archiveZip.file !== 'function') {
      console.warn(`Archive zip not available for chapter: ${title} (${href})`);
      return `<p>Unable to load chapter: ${title}</p>`;
    }
    // ...
    let zipFile = archiveZip.file(chapterPath);
    // ...
  }
}

// After:
import type { EpubBookInstance, JSZip, ZipFile } from '@/types/epub';

async function loadChapterContent(book: EpubBookInstance, baseUrl: string | undefined, href: string, title: string): Promise<string> {
  try {
    const archive = book.archive;
    const archiveZip = archive?.zip;
    
    if (!archiveZip) {
      console.warn(`Archive zip not available for chapter: ${title} (${href})`);
      return `<p>Unable to load chapter: ${title}</p>`;
    }
    // ...
    let zipFile: ZipFile | null = archiveZip.file(chapterPath);
    // ...
  }
}
```

**Line 524 - processImages:**
```typescript
// Before:
async function processImages(html: string, archiveZip: any, baseUrl: string | undefined, chapterPath: string): Promise<string> {
  // ...
  if (!zipFile) {
    const allFiles = archiveZip.files ? Object.keys(archiveZip.files) : [];
    const matchingFile = allFiles.find(f => f.endsWith(normalizedPath) || f.endsWith(`/${normalizedPath}`));
    // ...
  }
}

// After:
import type { JSZip, ZipFile } from '@/types/epub';

async function processImages(html: string, archiveZip: JSZip, baseUrl: string | undefined, chapterPath: string): Promise<string> {
  // ...
  if (!zipFile) {
    const allFiles = Object.keys(archiveZip.files);
    const matchingFile = allFiles.find(f => f.endsWith(normalizedPath) || f.endsWith(`/${normalizedPath}`));
    // ...
  }
}
```

### Step 3: Create JSZip Global Type Declaration

Add a declaration for the JSZip global that can be set dynamically:

```typescript
// src/types/epub.ts or src/vite-env.d.ts

declare global {
  var JSZip: {
    new (): JSZip;
    (data: ArrayBuffer | string): JSZip;
  };
}
```

### Step 4: Export the New Types from src/types/epub.ts

Ensure all new types are properly exported:

```typescript
// src/types/epub.ts

export interface BookMetadata { /* ... */ }
export interface Chapter { /* ... */ }
export interface TocItem extends Chapter { /* ... */ }
export interface ReadingProgress { /* ... */ }
export interface UserPreferences { /* ... */ }
export interface SearchResult { /* ... */ }
export interface SearchHighlight { /* ... */ }
export type EpubResult<T> = { success: true; data: T } | { success: false; error: Error };
export interface EpubBook { /* ... */ }

// New types:
export interface ZipFile { /* ... */ }
export interface JSZip { /* ... */ }
export interface EpubArchive { /* ... */ }
export interface EpubBookInstance { /* ... */ }
```

## Priority Order

1. **HIGH**: Add `ZipFile` and `JSZip` interfaces to `src/types/epub.ts`
2. **HIGH**: Add `EpubArchive` and `EpubBookInstance` interfaces to `src/types/epub.ts`
3. **MEDIUM**: Update function signatures in `useEpub.ts` to use the new types
4. **MEDIUM**: Remove unnecessary null checks that are now guaranteed by types
5. **LOW**: Add JSZip global declaration

## Testing Considerations

After implementing these changes:
- Verify all EPUB files still load correctly
- Test loading chapters from different EPUB file structures
- Verify image loading within chapters works
- Test with EPUBs that have missing files (should handle gracefully)
- Run TypeScript compiler to verify no type errors
- Ensure IDE auto-completion works for `archiveZip.file()` and `zipFile.async()`
