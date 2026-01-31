# Code Duplication - escapeRegex Function

## Severity: Low

## Affected Files
- `src/components/BookViewer.vue:249-251`
- `src/composables/useSearch.ts:84-86`

## Description
The `escapeRegex` function is duplicated with identical implementations:

**BookViewer.vue:**
```typescript
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

**useSearch.ts:**
```typescript
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

Both are used for escaping special regex characters when building search patterns.

## Why This Is Problematic
- **DRY Violation**: The same utility function exists in two places
- **Bug Propagation Risk**: If a bug is found in the regex pattern, both locations must be fixed
- **Inconsistency Risk**: Future modifications could lead to different implementations
- **Testing Overhead**: Same logic must be tested twice

## Implementation Plan

### Step 1: Create String Utilities
Create a new utility file `src/utils/string.ts`:
```typescript
/**
 * Escapes special regex characters in a string for use in regex patterns.
 * This prevents errors when user input contains characters that have special
 * meaning in regular expressions.
 *
 * @param string - The string to escape
 * @returns The escaped string safe for use in regex
 *
 * @example
 * escapeRegex('a.b') // returns 'a\\.b'
 * escapeRegex('test$') // returns 'test\\$'
 */
export function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Truncates a string to a maximum length, adding an ellipsis if truncated.
 *
 * @param string - The string to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated string with ellipsis if needed
 */
export function truncate(string: string, maxLength: number): string {
  if (string.length <= maxLength) return string;
  return string.substring(0, maxLength - 3) + '...';
}

/**
 * Removes HTML tags from a string, returning only the text content.
 *
 * @param html - HTML string to strip
 * @returns Plain text without HTML tags
 */
export function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}
```

### Step 2: Update BookViewer.vue
Replace the local function in `src/components/BookViewer.vue`:
```typescript
// Remove lines 249-251
import { escapeRegex } from '@/utils/string';
```

### Step 3: Update useSearch.ts
Replace the local function in `src/composables/useSearch.ts`:
```typescript
// Remove lines 84-86
import { escapeRegex } from '@/utils/string';
```

### Step 4: Add Unit Tests
Create comprehensive tests for string utilities:
```typescript
// tests/utils/string.test.ts
import { describe, it, expect } from 'vitest';
import { escapeRegex, truncate, stripHtml } from '@/utils/string';

describe('escapeRegex', () => {
  it('escapes special regex characters', () => {
    expect(escapeRegex('a.b')).toBe('a\\.b');
    expect(escapeRegex('test$')).toBe('test\\$');
    expect(escapeRegex('hello*')).toBe('hello\\*');
    expect(escapeRegex('test+')).toBe('test\\+');
    expect(escapeRegex('test?')).toBe('test\\?');
    expect(escapeRegex('test^')).toBe('test\\^');
    expect(escapeRegex('test{}')).toBe('test\\{\\}');
    expect(escapeRegex('test[]')).toBe('test\\[\\]');
    expect(escapeRegex('test|')).toBe('test\\|');
    expect(escapeRegex('test()')).toBe('test\\(\\)');
  });

  it('does not escape non-special characters', () => {
    expect(escapeRegex('abc123')).toBe('abc123');
    expect(escapeRegex('hello world')).toBe('hello world');
  });

  it('handles empty strings', () => {
    expect(escapeRegex('')).toBe('');
  });

  it('handles strings with multiple special characters', () => {
    expect(escapeRegex('a.b*c+d?e')).toBe('a\\.b\\*c\\+d\\?e');
  });
});

describe('truncate', () => {
  it('truncates strings longer than maxLength', () => {
    expect(truncate('Hello World', 8)).toBe('Hello...');
  });

  it('does not truncate strings shorter than maxLength', () => {
    expect(truncate('Hello', 10)).toBe('Hello');
  });

  it('handles exact length', () => {
    expect(truncate('Hello', 5)).toBe('Hello');
  });
});

describe('stripHtml', () => {
  it('removes HTML tags', () => {
    expect(stripHtml('<p>Hello</p>')).toBe('Hello');
    expect(stripHtml('<div class="test">Content</div>')).toBe('Content');
  });

  it('handles nested tags', () => {
    expect(stripHtml('<div><p>Text</p></div>')).toBe('Text');
  });

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('');
  });
});
```

### Step 5: Update Import Paths
Ensure both components update their imports and use the shared utility consistently.

### Step 6: Consider Adding JSDoc to Other Utilities
Review other parts of the codebase for similar utility functions that could be extracted to `src/utils/string.ts` or other utility files.
