# Missing Unit Tests for useEpub Composable

**Severity:** High  
**Issue Type:** Missing Unit Tests

## Affected Files
- `src/composables/useEpub.ts` (lines 1-566) - Entire file untested

## Description
The `useEpub` composable is the core EPUB parsing module that handles loading EPUB files, extracting metadata, parsing table of contents, loading chapters, and processing images. This is the most critical piece of code in the application with complex logic, multiple async operations, and error handling paths that are completely untested.

**Untested Functions:**
- `loadEpub()` - Main entry point for loading EPUB files (lines 79-137)
- `loadChapterByHref()` - Dynamic chapter loading (lines 139-174)
- `getTitleFromChapter()` - Chapter title extraction (lines 176-202)
- `loadCover()` - Cover image extraction (lines 204-216)
- `loadToc()` - Basic table of contents parsing (lines 218-234)
- `loadTocFromNcx()` - NCX file parsing (lines 236-312)
- `loadChapters()` - Chapter content loading (lines 314-346)
- `loadChapterContent()` - Content extraction (lines 348-450)
- `resolveImagePath()` - Image path resolution (lines 452-491)
- `processImages()` - Image processing (lines 493-549)
- `generateBookId()` - Book ID generation (lines 551-557)

## Why This Needs Testing
- **Core functionality**: This is the primary EPUB parsing logic that the entire app depends on
- **Complex DOM manipulation**: Heavy use of DOMParser for XML/XHTML parsing
- **Async operations**: Multiple async chains that could fail
- **Error handling**: Several try-catch blocks with console.warn (lines 122, 171, 212, 307, 391, 397, 405, 447)
- **EPUB format variations**: Must handle different EPUB structures (NCX vs navigation, relative vs absolute paths)
- **Edge cases**: Missing files, corrupted archives, malformed XML, missing body tags
- **Memory leaks**: URL.createObjectURL calls need proper cleanup verification

## Implementation Plan

### 1. Create Test File Structure
`src/composables/useEpub.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { epub } from './useEpub';

describe('useEpub', () => {
  // Mock epubjs and jszip
  beforeEach(() => {
    // Setup mocks
  });
  
  afterEach(() => {
    // Cleanup mocks
  });
});
```

### 2. Test loadEpub Function
```typescript
describe('loadEpub', () => {
  it('should load EPUB and extract metadata', async () => {
    const mockFile = new File(['test'], 'test.epub', { type: 'application/epub+zip' });
    const result = await epub.loadEpub(mockFile);
    
    expect(result.metadata).toBeDefined();
    expect(result.metadata.title).toBeTypeOf('string');
    expect(result.chapters).toBeInstanceOf(Array);
  });

  it('should handle existing book ID', async () => {
    const mockFile = new File(['test'], 'test.epub', { type: 'application/epub+zip' });
    const result = await epub.loadEpub(mockFile, 'existing-id');
    
    expect(result.metadata.id).toBe('existing-id');
  });

  it('should use fallback title when metadata missing', async () => {
    // Test with EPUB missing title
  });

  it('should load NCX toc when navigation toc is empty', async () => {
    // Test toc fallback logic
  });

  it('should handle corrupted EPUB files', async () => {
    const invalidFile = new File(['invalid'], 'test.epub');
    
    await expect(epub.loadEpub(invalidFile)).rejects.toThrow();
  });

  it('should extract cover image when available', async () => {
    // Test cover extraction
  });

  it('should handle missing cover gracefully', async () => {
    // Test coverBlob is undefined
  });
});
```

### 3. Test loadChapterContent Function
```typescript
describe('loadChapterContent', () => {
  it('should load and parse chapter content', async () => {
    // Test successful chapter loading
  });

  it('should handle chapters without body tag', async () => {
    // Test fallback to getElementsByTagName('body') (lines 421-430)
  });

  it('should handle empty chapter content', async () => {
    // Test empty body innerHTML case (lines 438-441)
  });

  it('should process images in chapter', async () => {
    // Test processImages call
  });

  it('should handle chapter file not found', async () => {
    // Test missing file in archive (lines 390-393)
  });

  it('should handle parsing errors gracefully', async () => {
    // Test catch block returns error message (lines 446-449)
  });

  it('should resolve relative image paths correctly', async () => {
    // Test image path resolution with baseUrl
  });

  it('should handle data URIs in images', async () => {
    // Test image src starts with 'data:' (line 513)
  });
});
```

### 4. Test loadTocFromNcx Function
```typescript
describe('loadTocFromNcx', () => {
  it('should parse NCX file with navMap', async () => {
    // Test basic NCX parsing
  });

  it('should handle nested navPoints (children)', async () => {
    // Test children parsing (lines 275-293)
  });

  it('should sort toc by playOrder', async () => {
    // Test sorting logic (line 305)
  });

  it('should handle missing NCX file', async () => {
    // Test when ncxFile is null (line 252)
  });

  it('should handle malformed NCX XML', async () => {
    // Test error handling (lines 307-309)
  });

  it('should search in alternate locations for NCX', async () => {
    // Test fallback locations (lines 244-250)
  });
});
```

### 5. Test processImages Function
```typescript
describe('processImages', () => {
  it('should convert relative images to blob URLs', async () => {
    // Test image blob creation (lines 537-544)
  });

  it('should cache image URLs for duplicate images', async () => {
    // Test imageUrls Map (lines 508-511)
  });

  it('should skip images with data URIs', async () => {
    // Test data: URI handling (lines 513-515)
  });

  it('should handle missing image files', async () => {
    // Test when zipFile is null (lines 532-535)
  });

  it('should handle image loading errors', async () => {
    // Test catch block (lines 542-544)
  });

  it('should resolve image paths correctly', async () => {
    // Test resolveImagePath integration
  });
});
```

### 6. Test resolveImagePath Function
```typescript
describe('resolveImagePath', () => {
  it('should handle absolute URLs', async () => {
    const result = await epub.resolveImagePath(
      'https://example.com/image.png',
      'OEBPS/',
      'chapter.xhtml'
    );
    expect(result).toContain('image.png');
  });

  it('should handle relative paths with baseUrl', async () => {
    const result = await epub.resolveImagePath(
      '../images/cover.png',
      'OEBPS/Text/',
      'chapter.xhtml'
    );
    expect(result).toBe('OEBPS/images/cover.png');
  });

  it('should handle hash links', async () => {
    const result = await epub.resolveImagePath('#section', 'OEBPS/', 'chapter.xhtml');
    expect(result).toBe('#section');
  });

  it('should handle data URIs', async () => {
    const result = await epub.resolveImagePath(
      'data:image/png;base64,iVBORw0KG...',
      'OEBPS/',
      'chapter.xhtml'
    );
    expect(result).toBe('data:image/png;base64,iVBORw0KG...');
  });

  it('should handle paths relative to chapter directory', async () => {
    const result = await epub.resolveImagePath(
      'image.png',
      undefined,
      'OEBPS/Text/chapter.xhtml'
    );
    expect(result).toBe('OEBPS/Text/image.png');
  });
});
```

### 7. Test loadChapterByHref Function
```typescript
describe('loadChapterByHref', () => {
  it('should load dynamic chapter by href', async () => {
    // Test dynamic loading
  });

  it('should handle URL resolution with baseUrl', async () => {
    // Test URL construction (lines 145-150)
  });

  it('should extract chapter title from file', async () => {
    // Test getTitleFromChapter integration
  });

  it('should add chapter to currentBook.chapters', async () => {
    // Verify chapter is added (line 167)
  });

  it('should handle loading failures gracefully', async () => {
    // Test catch block (lines 170-173)
  });
});
```

### 8. Test generateBookId Function
```typescript
describe('generateBookId', () => {
  it('should generate unique IDs for different files', async () => {
    const file1 = new File(['content1'], 'book1.epub');
    const file2 = new File(['content2'], 'book2.epub');
    
    const id1 = await epub.generateBookId(file1);
    const id2 = await epub.generateBookId(file2);
    
    expect(id1).not.toBe(id2);
  });

  it('should include filename in ID', async () => {
    const file = new File(['test'], 'test-book.epub');
    const id = await epub.generateBookId(file);
    
    expect(id).toContain('test-book');
  });

  it('should include timestamp in ID', async () => {
    const before = Date.now();
    const file = new File(['test'], 'test.epub');
    const id = await epub.generateBookId(file);
    const after = Date.now();
    
    const timestampMatch = id.match(/-(\d+)-/);
    expect(timestampMatch).toBeTruthy();
    const timestamp = parseInt(timestampMatch![1]);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('should include SHA-256 hash', async () => {
    const file = new File(['test'], 'test.epub');
    const id = await epub.generateBookId(file);
    
    const hashMatch = id.match(/-[0-9a-f]{8}$/);
    expect(hashMatch).toBeTruthy();
  });
});
```

### 9. Test Edge Cases and Error Handling
```typescript
describe('useEpub edge cases', () => {
  it('should handle EPUB with no chapters', async () => {
    // Test empty toc and chapters array
  });

  it('should handle malformed XML in chapter files', async () => {
    // Test DOMParser parse errors
  });

  it('should handle chapter with script/style tags', async () => {
    // Test that script/style are handled correctly
  });

  it('should handle base URL determination failure', async () => {
    // Test catch block at lines 122-125
  });

  it('should handle archive.zip being undefined', async () => {
    // Test line 352 warning
  });

  it('should handle coverUrl() throwing error', async () => {
    // Test loadCover catch block (lines 211-214)
  });

  it('should handle multiple NCX file locations', async () => {
    // Test all fallback locations for NCX
  });
});
```

### 10. Create Mock EPUB Fixtures
Create `src/test/fixtures/sample-epub.ts`:
```typescript
import { Blob } from 'buffer';

export const mockEpubFile = new Blob(
  [Buffer.from('PK\x03\x04...')], // Mock ZIP structure
  { type: 'application/epub+zip' }
);

export const mockChapterContent = `
  <?xml version="1.0" encoding="UTF-8"?>
  <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
      <title>Chapter 1</title>
    </head>
    <body>
      <h1>Chapter Title</h1>
      <p>Chapter content goes here.</p>
      <img src="images/cover.png" alt="Cover" />
    </body>
  </html>
`;

export const mockNcxContent = `
  <?xml version="1.0" encoding="UTF-8"?>
  <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
    <navMap>
      <navPoint id="nav1" playOrder="1">
        <navLabel><text>Chapter 1</text></navLabel>
        <content src="chapter1.xhtml"/>
      </navPoint>
    </navMap>
  </ncx>
`;
```

### 11. Create epubjs Mock
Create `src/test/mocks/epubjs.mock.ts`:
```typescript
import { vi } from 'vitest';

export const createMockEpub = (overrides = {}) => ({
  ready: Promise.resolve(),
  loaded: {
    metadata: Promise.resolve({
      title: 'Test Book',
      creator: 'Test Author',
      description: 'Test Description',
      publisher: 'Test Publisher',
      language: 'en',
    }),
    navigation: Promise.resolve({
      toc: [],
    }),
    rootfile: Promise.resolve({
      rootfileUrl: 'OEBPS/content.opf',
    }),
    package: Promise.resolve({}),
  },
  archive: {
    zip: {
      file: vi.fn(),
      files: {},
    },
  },
  coverUrl: vi.fn(() => Promise.resolve('blob:mock-cover')),
  ...overrides,
});

export const mockEpubjsModule = {
  default: vi.fn(() => createMockEpub()),
  ePub: vi.fn(() => createMockEpub()),
};
```

## Expected Outcomes
- Comprehensive test coverage for all useEpub functions
- EPUB parsing validated with mock files
- Error paths tested and verified
- Edge cases identified and handled
- Coverage > 80% for useEpub.ts

## Dependencies
- Must complete "Missing Test Framework and Testing Infrastructure" issue first
- Needs epubjs mock implementation
- Needs sample EPUB fixtures
