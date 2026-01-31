# Unused Direct Import in BookViewer Component

## Severity: Low

## Affected Files
- `src/components/BookViewer.vue:1-348`

## Description
The `BookViewer.vue` component imports the `epub` object from the `useEpub` composable but never uses it:

**Line 6:**
```typescript
import { epub } from '@/composables/useEpub';
```

This import is:
- Imported but never referenced in the component
- A potential source of confusion about how EPUB files are loaded
- Unnecessary dependency that could be removed

## Why This Is Problematic
- **Dead Code**: Unnecessary import increases bundle size slightly
- **Confusing Dependency**: Misleads about the component's actual dependencies
- **Poor Documentation**: Suggests functionality that doesn't exist
- **Code Clutter**: Reduces code readability

## Implementation Plan

### Step 1: Remove Unused Import

Update `src/components/BookViewer.vue`:
```typescript
// Before
import { ref, computed, onUnmounted, nextTick, watchEffect, watch } from 'vue';
import { useBookStore } from '@/stores/book';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/composables/useTheme';
import { epub } from '@/composables/useEpub';  // <-- Remove this line

// After
import { ref, computed, onUnmounted, nextTick, watchEffect, watch } from 'vue';
import { useBookStore } from '@/stores/book';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/composables/useTheme';
```

### Step 2: Verify No Hidden Dependencies

Check if the `epub` import was previously used or if any functionality depends on it:

- Search the component for any use of the `epub` variable
- Verify that chapter loading is handled through the store only
- Confirm that no dynamic imports rely on this

The component currently:
- Gets chapters from `bookStore.chapters`
- Gets current chapter from `bookStore.currentChapter`
- Renders chapter content from the store
- Has no direct EPUB manipulation

### Step 3: Check Other Components

Audit other components for similar unused imports:

**Controls.vue:**
```typescript
// Line 5
import { useTheme } from '@/composables/useTheme';
// Uses useTheme() below ✓
```

**ChapterList.vue:**
```typescript
// Line 3
import { useTheme } from '@/composables/useTheme';
// Uses useTheme() below ✓
```

**SearchPanel.vue:**
```typescript
// Line 4
import { useSearch } from '@/composables/useSearch';
// Uses useSearch() below ✓
```

**LibraryPanel.vue:**
```typescript
// Line 5
import { useTheme } from '@/composables/useTheme';
// Uses useTheme() below ✓
```

All other components seem to use their imports correctly.

### Step 4: Add Linting Rule

Configure ESLint to catch unused imports automatically:

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-unused-vars': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        vars: 'all',
        args: 'after-used',
        ignoreRestSiblings: true,
      },
    ],
  },
};
```

Or configure TypeScript strict mode:
```json
// tsconfig.json
{
  "compilerOptions": {
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### Step 5: Add Pre-commit Hook

Create a pre-commit hook to catch unused imports:

```bash
#!/bin/sh
# .git/hooks/pre-commit

# Run TypeScript compiler to check for unused variables
npx tsc --noEmit

if [ $? -ne 0 ]; then
  echo "TypeScript errors detected. Please fix before committing."
  exit 1
fi

# Run linter
npm run lint

if [ $? -ne 0 ]; then
  echo "Linting errors detected. Please fix before committing."
  exit 1
fi
```

### Step 6: Document Import Guidelines

Update `AGENTS.md` with import guidelines:
```markdown
## Imports

- Only import what you use
- Remove unused imports immediately
- Use ESLint/TypeScript to detect unused imports
- Prefer named exports over default exports for clarity
```

### Benefits After Fix
- Smaller bundle size
- Cleaner code
- Clearer dependencies
- Better code documentation
