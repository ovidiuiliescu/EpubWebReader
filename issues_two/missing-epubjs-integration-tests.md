# Missing epub.js Integration Tests

**Severity:** High  
**Issue Type:** Missing Integration Tests

## Affected Files
- `src/composables/useEpub.ts` - Lines with epub.js calls
- `src/types/epubjs.d.ts` - Type definitions (may be incomplete)

## Description
The application heavily depends on the `epubjs` library for parsing EPUB files. There are zero integration tests that verify the actual epub.js library works correctly with our code, only mocks in unit tests. Real epub.js behavior may differ from mocks.

**Untested epub.js Interactions:**

### useEpub.ts Functions
1. **EpubBook creation** (line 82) - `ePubFactory(arrayBuffer)`
2. **Book ready promise** (line 84) - `await currentBook.ready`
3. **Metadata loading** (line 86) - `await currentBook.loaded.metadata`
4. **Navigation loading** (line 87) - `await currentBook.loaded.navigation`
5. **Rootfile loading** (line 113) - `await currentBook.loaded.rootfile`
6. **Archive access** (lines 178, 350, 496) - `book.archive.zip`
7. **Cover URL retrieval** (line 206) - `await book.coverUrl()`
8. **NCX file access** (line 243) - `archiveZip.file('toc.ncx')`
9. **Chapter file access** (line 378) - `archiveZip.file(chapterPath)`
10. **Image file access** (line 521) - `archiveZip.file(normalizedPath)`
11. **File async reading** (lines 194, 395, 538) - `zipFile.async('string'/'blob')`

### epubjs.d.ts Type Definitions
1. **Epub interface** (lines 2-17) - May be incomplete
2. **Epub factory signature** (line 3) - `(data: ArrayBuffer | string): any`
3. **Navigation promise** (lines 8-11) - toc structure
4. **coverUrl() method** (line 13) - Return type

## Why This Needs Testing
- **Library version compatibility**: epub.js v0.3.93 may have quirks
- **Real EPUB files**: Mocks don't test actual EPUB parsing
- **Archive structure**: Different EPUB creators structure archives differently
- **Async behavior**: Real async timing differs from mocks
- **Error behavior**: Library may throw unexpected errors
- **Resource cleanup**: Blob URLs need real cleanup verification
- **Memory management**: Large EPUBs may expose memory leaks
- **Browser compatibility**: epub.js may behave differently across browsers
- **Type safety**: TypeScript definitions may not match actual API

## Implementation Plan

### 1. Create Integration Test File
`src/integration/epubjs.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { epub } from '@/composables/useEpub';
import ePub from 'epubjs';

describe('epub.js Integration Tests', () => {
  let realEpubBook: any;

  afterEach(() => {
    if (realEpubBook) {
      // Cleanup
    }
  });
});
```

### 2. Test EPUB Loading with Real Files
```typescript
describe('real EPUB file loading', () => {
  it('should load actual EPUB file', async () => {
    const epubBlob = await fetch('/fixtures/test-book.epub').then(r => r.blob());
    const epubFile = new File([epubBlob], 'test-book.epub', { type: 'application/epub+zip' });
    
    const result = await epub.loadEpub(epubFile);
    
    expect(result.metadata).toBeDefined();
    expect(result.chapters.length).toBeGreaterThan(0);
    expect(result.toc.length).toBeGreaterThan(0);
  });

  it('should load EPUB with different structure', async () => {
    const epubFile = new File([await loadFile('alternate-structure.epub')], 'alt.epub');
    
    const result = await epub.loadEpub(epubFile);
    
    expect(result.chapters.length).toBeGreaterThan(0);
  });

  it('should handle EPUB with nested directories', async () => {
    const epubFile = new File([await loadFile('nested-directories.epub')], 'nested.epub');
    
    const result = await epub.loadEpub(epubFile);
    
    expect(result.chapters.every(c => c.content)).toBe(true);
  });

  it('should load EPUB with Unicode filenames', async () => {
    const epubFile = new File([await loadFile('unicode-filenames.epub')], 'unicode.epub');
    
    const result = await epub.loadEpub(epubFile);
    
    expect(result.chapters.length).toBeGreaterThan(0);
  });
});
```

### 3. Test Metadata Extraction
```typescript
describe('metadata extraction', () => {
  it('should extract all metadata fields', async () => {
    const epubFile = new File([await loadFile('complete-metadata.epub')], 'meta.epub');
    const result = await epub.loadEpub(epubFile);
    
    expect(result.metadata.title).toBeTypeOf('string');
    expect(result.metadata.author).toBeTypeOf('string');
    expect(result.metadata.description).toBeDefined();
    expect(result.metadata.publisher).toBeDefined();
    expect(result.metadata.language).toBeDefined();
  });

  it('should handle missing metadata fields', async () => {
    const epubFile = new File([await loadFile('minimal-metadata.epub')], 'minimal.epub');
    const result = await epub.loadEpub(epubFile);
    
    expect(result.metadata.title).toBeTruthy();
    expect(result.metadata.author).toBeTruthy();
  });

  it('should handle very long metadata', async () => {
    const epubFile = new File([await loadFile('long-metadata.epub')], 'long.epub');
    const result = await epub.loadEpub(epubFile);
    
    expect(result.metadata.title.length).toBeGreaterThan(0);
    expect(result.metadata.description.length).toBeGreaterThan(0);
  });
});
```

### 4. Test Table of Contents Parsing
```typescript
describe('table of contents', () => {
  it('should parse NCX-based TOC', async () => {
    const epubFile = new File([await loadFile('ncx-toc.epub')], 'ncx.epub');
    const result = await epub.loadEpub(epubFile);
    
    expect(result.toc.length).toBeGreaterThan(0);
    expect(result.toc.every(t => t.href)).toBe(true);
    expect(result.toc.every(t => t.title)).toBe(true);
  });

  it('should parse navigation-based TOC', async () => {
    const epubFile = new File([await loadFile('nav-toc.epub')], 'nav.epub');
    const result = await epub.loadEpub(epubFile);
    
    expect(result.toc.length).toBeGreaterThan(0);
  });

  it('should handle nested TOC structure', async () => {
    const epubFile = new File([await loadFile('nested-toc.epub')], 'nested.epub');
    const result = await epub.loadEpub(epubFile);
    
    const hasChildren = result.toc.some(t => t.children && t.children.length > 0);
    expect(hasChildren).toBe(true);
  });

  it('should handle TOC with playOrder', async () => {
    const epubFile = new File([await loadFile('playorder-toc.epub')], 'order.epub');
    const result = await epub.loadEpub(epubFile);
    
    expect(result.toc.every(t => t.playOrder !== undefined)).toBe(true);
  });

  it('should handle TOC with hundreds of entries', async () => {
    const epubFile = new File([await loadFile('large-toc.epub')], 'large.epub');
    const result = await epub.loadEpub(epubFile);
    
    expect(result.toc.length).toBeGreaterThan(100);
  });
});
```

### 5. Test Chapter Content Loading
```typescript
describe('chapter content loading', () => {
  it('should load chapter with HTML content', async () => {
    const epubFile = new File([await loadFile('html-chapters.epub')], 'html.epub');
    const result = await epub.loadEpub(epubFile);
    
    expect(result.chapters[0].content).toContain('<');
    expect(result.chapters[0].content).toContain('>');
  });

  it('should load chapter with images', async () => {
    const epubFile = new File([await loadFile('image-chapters.epub')], 'images.epub');
    const result = await epub.loadEpub(epubFile);
    
    const chapterContent = result.chapters[0].content;
    expect(chapterContent).toContain('<img');
    expect(chapterContent).toContain('src=');
  });

  it('should load chapter with internal links', async () => {
    const epubFile = new File([await loadFile('internal-links.epub')], 'links.epub');
    const result = await epub.loadEpub(epubFile);
    
    expect(result.chapters[0].content).toContain('<a href=');
  });

  it('should handle chapters with script tags', async () => {
    const epubFile = new File([await loadFile('script-chapters.epub')], 'script.epub');
    const result = await epub.loadEpub(epubFile);
    
    // Scripts should be preserved or handled
    expect(result.chapters[0].content).toBeDefined();
  });

  it('should handle chapters with mixed encoding', async () => {
    const epubFile = new File([await loadFile('mixed-encoding.epub')], 'mixed.epub');
    const result = await epub.loadEpub(epubFile);
    
    expect(result.chapters[0].content).toBeDefined();
  });
});
```

### 6. Test Cover Image Loading
```typescript
describe('cover image loading', () => {
  it('should load cover image', async () => {
    const epubFile = new File([await loadFile('with-cover.epub')], 'cover.epub');
    const result = await epub.loadEpub(epubFile);
    
    expect(result.coverBlob).toBeInstanceOf(Blob);
    expect(result.coverBlob!.type).toMatch(/^image\//);
  });

  it('should handle EPUB without cover', async () => {
    const epubFile = new File([await loadFile('no-cover.epub')], 'nocover.epub');
    const result = await epub.loadEpub(epubFile);
    
    expect(result.coverBlob).toBeUndefined();
  });

  it('should load large cover image', async () => {
    const epubFile = new File([await loadFile('large-cover.epub')], 'large.epub');
    const result = await epub.loadEpub(epubFile);
    
    expect(result.coverBlob!.size).toBeGreaterThan(100 * 1024); // > 100KB
  });

  it('should load cover in different formats', async () => {
    const formats = ['jpeg', 'png', 'gif'];
    
    for (const format of formats) {
      const epubFile = new File([await loadFile(`${format}-cover.epub`)], `${format}.epub`);
      const result = await epub.loadEpub(epubFile);
      
      expect(result.coverBlob!.type).toContain(format);
    }
  });
});
```

### 7. Test Image Processing
```typescript
describe('image processing', () => {
  it('should resolve relative image paths', async () => {
    const epubFile = new File([await loadFile('relative-images.epub')], 'relative.epub');
    const result = await epub.loadEpub(epubFile);
    
    const chapterContent = result.chapters[0].content;
    // Images should have blob URLs
    expect(chapterContent).toMatch(/blob:/);
  });

  it('should resolve absolute image paths', async () => {
    const epubFile = new File([await loadFile('absolute-images.epub')], 'absolute.epub');
    const result = await epub.loadEpub(epubFile);
    
    const chapterContent = result.chapters[0].content;
    expect(chapterContent).toContain('src=');
  });

  it('should handle data URI images', async () => {
    const epubFile = new File([await loadFile('data-uri-images.epub')], 'data.epub');
    const result = await epub.loadEpub(epubFile);
    
    const chapterContent = result.chapters[0].content;
    expect(chapterContent).toContain('data:image');
  });

  it('should handle chapters with many images', async () => {
    const epubFile = new File([await loadFile('many-images.epub')], 'many.epub');
    const result = await epub.loadEpub(epubFile);
    
    const chapterContent = result.chapters[0].content;
    const imgCount = (chapterContent.match(/<img/g) || []).length;
    expect(imgCount).toBeGreaterThan(10);
  });
});
```

### 8. Test Dynamic Chapter Loading
```typescript
describe('dynamic chapter loading', () => {
  it('should load chapter by href', async () => {
    const epubFile = new File([await loadFile('multi-chapter.epub')], 'multi.epub');
    await epub.loadEpub(epubFile);
    
    const chapter = await epub.loadChapterByHref('chapter5.xhtml');
    expect(chapter).not.toBeNull();
    expect(chapter!.href).toBe('chapter5.xhtml');
  });

  it('should load chapter not in initial TOC', async () => {
    const epubFile = new File([await loadFile('dynamic-chapters.epub')], 'dynamic.epub');
    await epub.loadEpub(epubFile);
    
    const chapter = await epub.loadChapterByHref('hidden-chapter.xhtml');
    expect(chapter).not.toBeNull();
  });

  it('should handle invalid chapter href', async () => {
    const epubFile = new File([await loadFile('multi-chapter.epub')], 'multi.epub');
    await epub.loadEpub(epubFile);
    
    const chapter = await epub.loadChapterByHref('nonexistent.xhtml');
    expect(chapter).toBeNull();
  });
});
```

### 9. Test Error Conditions
```typescript
describe('epub.js error conditions', () => {
  it('should handle corrupted EPUB', async () => {
    const epubFile = new File(['corrupted data'], 'corrupted.epub');
    
    await expect(epub.loadEpub(epubFile)).rejects.toThrow();
  });

  it('should handle invalid EPUB structure', async () => {
    const epubFile = new File(['invalid structure'], 'invalid.epub');
    
    await expect(epub.loadEpub(epubFile)).rejects.toThrow();
  });

  it('should handle missing OPF file', async () => {
    const epubFile = new File([await loadFile('no-opf.epub')], 'nopof.epub');
    
    await expect(epub.loadEpub(epubFile)).rejects.toThrow();
  });

  it('should handle malformed XML in OPF', async () => {
    const epubFile = new File([await loadFile('bad-xml.epub')], 'badxml.epub');
    
    // Should handle gracefully, may throw or return partial data
    const result = await epub.loadEpub(epubFile);
    expect(result).toBeDefined();
  });
});
```

### 10. Test Memory Management
```typescript
describe('memory management', () => {
  it('should cleanup blob URLs', async () => {
    const epubFile = new File([await loadFile('many-images.epub')], 'many.epub');
    const result = await epub.loadEpub(epubFile);
    
    // Count blob URLs created
    const blobUrls = (result.chapters[0].content.match(/blob:[^"']+/g) || []).length;
    expect(blobUrls).toBeGreaterThan(0);
    
    // URLs should be revocable
    const urls = result.chapters[0].content.match(/blob:[^"']+/g) || [];
    urls.forEach(url => {
      expect(() => URL.revokeObjectURL(url)).not.toThrow();
    });
  });

  it('should handle loading multiple EPUBs sequentially', async () => {
    const files = [
      new File([await loadFile('book1.epub')], 'book1.epub'),
      new File([await loadFile('book2.epub')], 'book2.epub'),
      new File([await loadFile('book3.epub')], 'book3.epub'),
    ];
    
    for (const file of files) {
      const result = await epub.loadEpub(file);
      expect(result.metadata).toBeDefined();
    }
    
    // Should not have memory issues
  });
});
```

## Expected Outcomes
- Real epub.js behavior verified
- Actual EPUB file parsing tested
- Integration bugs discovered early
- Memory management validated
- Browser compatibility confirmed
- Type definitions verified

## Dependencies
- Must complete "Missing Test Framework and Testing Infrastructure" issue first
- Needs sample EPUB files in test fixtures
- Real epub.js library must be available (not mocked)
