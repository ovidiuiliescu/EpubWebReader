# Code Duplication - formatDate Function

## Severity: Medium

## Affected Files
- `src/components/HomeScreen.vue:74-80`
- `src/components/LibraryPanel.vue:104-110`

## Description
The `formatDate` function is duplicated in two separate components with identical implementations. Both functions:

```typescript
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}
```

## Why This Is Problematic
- **DRY Violation**: The same code exists in two places, doubling maintenance burden
- **Inconsistency Risk**: If one implementation changes, the other might be overlooked, creating UI inconsistencies
- **Harder Testing**: The same logic must be tested in multiple places
- **Poor Discoverability**: Other developers may not realize this function already exists

## Implementation Plan

### Step 1: Create Date Utilities
Create a new utility file `src/utils/date.ts`:
```typescript
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateLong(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(date);
}
```

### Step 2: Update HomeScreen.vue
Replace the local function with an import in `src/components/HomeScreen.vue`:
```typescript
// Remove lines 74-80
import { formatDate } from '@/utils/date';
```

### Step 3: Update LibraryPanel.vue
Replace the local function with an import in `src/components/LibraryPanel.vue`:
```typescript
// Remove lines 104-110
import { formatDate } from '@/utils/date';
```

### Step 4: Add JSDoc Documentation
Add proper documentation to the utility function:
```typescript
/**
 * Formats a date string in a short, user-friendly format.
 * Example: "Jan 31, 2026"
 *
 * @param date - The date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  // ...
}
```

### Step 5: Add Unit Tests
Create tests for the date utilities:
```typescript
// tests/utils/date.test.ts
import { describe, it, expect } from 'vitest';
import { formatDate } from '@/utils/date';

describe('formatDate', () => {
  it('formats date correctly', () => {
    const date = new Date('2026-01-31');
    expect(formatDate(date)).toBe('Jan 31, 2026');
  });
});
```

### Step 6: Consider Adding i18n Support
For future improvements, consider adding internationalization:
```typescript
export function formatDate(date: Date, locale: string = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}
```
