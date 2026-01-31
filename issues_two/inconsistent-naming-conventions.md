# Inconsistent Naming Conventions

## Severity: Low

## Affected Files
- Multiple files throughout the codebase

## Description
The codebase has inconsistent naming conventions that reduce readability and maintainability:

### Issues Identified:

1. **Variable Naming - Mixed Cases for Similar Concepts:**

   In `useEpub.ts`:
   ```typescript
   // Lines 5-6
   let ePub: EpubFactory | null = null;  // camelCase with lowercase 'P'
   export const epub = useEpub();         // camelCase with lowercase 'p'
   ```

2. **Inconsistent Store Access:**

   Some components destructure stores:
   ```typescript
   const { themeClasses } = useTheme();  // BookViewer.vue:10, ChapterList.vue:10, etc.
   ```

   Others use store directly:
   ```typescript
   const settingsStore = useSettingsStore();  // Controls.vue:14
   ```

3. **Function Naming Inconsistency:**

   - Some functions use `get` prefix: `getEpubFactory()`, `getCoverImage()`, `getFontFamily()`
   - Others don't: `loadEpub()`, `loadCovers()`, `openBook()`
   - Unclear when to use `get` vs `load` vs `fetch`

4. **Event Handler Naming:**

   - `handleScroll`, `handleLinkClick`, `handleDragOver` (uses `handle` prefix)
   - `toggleToc`, `toggleSearch`, `toggleLibrary` (uses `toggle` prefix, not `handleToggle`)
   - `selectChapter`, `openBook`, `removeBook` (no `handle` prefix but are event handlers)

5. **Type Interface Naming:**

   - Some use `*Props` suffix: `BookViewerProps`, `ChapterListProps` (suggested in patterns)
   - Others don't: `CachedBook` (library.ts:10), `StoredPrefs` (settings.ts:6)
   - No clear convention for when to use `*Props` vs not

6. **Ref/State Naming:**

   - Some use descriptive names: `containerRef`, `articleRef`, `fileInputRef`
   - Others use generic names: `fileInput` (DropZone.vue:13), `searchInput` (SearchPanel.vue:16)

7. **Boolean Variable Naming:**

   - Some use `is` prefix: `isLoading`, `isDragging`, `isInitialized`
   - Others don't: `shouldCache` (book.ts:22), `hasRestoredScrollPosition` (BookViewer.vue:16)

8. **Map/Collection Naming:**

   - Some use plural names: `coverUrls` (implies collection)
   - Others use descriptive but inconsistent: `readingProgress` (book.ts:12, singular but holds Map)

## Why This Is Problematic
- **Cognitive Load**: Developers must memorize multiple conventions
- **Unclear Intent**: Similar concepts using different patterns reduces understanding
- **Increased Errors**: Easy to make mistakes with inconsistent naming
- **Harder Code Review**: Reviewers spend more time understanding conventions
- **Poor IDE Support**: Inconsistent patterns reduce autocomplete effectiveness
- **Maintenance Burden**: Refactoring requires tracking multiple conventions

## Implementation Plan

### Step 1: Define Naming Conventions

Create `CONVENTIONS.md`:
```markdown
# Naming Conventions

## Variable Names
- Use camelCase for all variables
- Use `is` prefix for boolean variables
- Use `has` prefix for boolean properties indicating presence
- Use `should` prefix for boolean parameters/options
- Use `Ref` suffix for refs containing other refs (optional but clear)

## Function Names
- Use camelCase for all functions
- Use `get` prefix for synchronous data retrieval without side effects
- Use `load` prefix for async operations that fetch/parses data
- Use `fetch` prefix for network operations
- Use `handle` prefix for event handlers
- Use `toggle` prefix for boolean toggle operations
- Use `set` prefix for mutation operations
- Use `create` prefix for factory functions
- Use `generate` prefix for data generation
- Use `calculate` prefix for computation functions
- Use `format` prefix for data formatting
- Use `validate` prefix for validation functions
- Use `convert` prefix for type conversions

## Component Names
- Use PascalCase for component files and names

## Interface/Type Names
- Use PascalCase for all interfaces and types
- Use `*Props` suffix for component props interfaces
- Use `*Emits` suffix for component emit interfaces
- Use `*Options` suffix for configuration options interfaces
- Use `*Result` suffix for return value interfaces from complex functions

## Store Names
- Use PascalCase for store functions: `useBookStore`, `useSettingsStore`
- Use lowercase for store instances: `bookStore`, `settingsStore`

## Composable Names
- Use `use` prefix for composables: `useEpub`, `useTheme`, `useSearch`

## Constants
- Use UPPER_SNAKE_CASE for global constants
- Use lowercase for module-level constants (not exported)

## Private Variables
- Prefix with underscore: `_internalVariable`
- Or use closure pattern (no underscore needed)

## Collections
- Use plural names for arrays: `books`, `chapters`
- Use descriptive names for Maps/Sets: `bookById`, `readingProgressMap`

## Event Names
- Use kebab-case for Vue events: `@toggle-toc`, `@book-select`
- Use camelCase for internal handler functions: `handleToggleToc`
```

### Step 2: Fix Variable Naming in useEpub.ts

Update `src/composables/useEpub.ts`:
```typescript
// Before
let ePub: EpubFactory | null = null;

// After
let epubFactory: EpubFactory | null = null;

// Before
export const epub = useEpub();

// After - Keep as is, consistent with composable pattern
```

Update function to use new variable name:
```typescript
async function getEpubFactory(): Promise<EpubFactory> {
  await ensureJsZipLoaded();

  if (!epubFactory) {
    const module = await import('epubjs');
    epubFactory = resolveEpubFactory(module);
  }

  return epubFactory;
}
```

### Step 3: Normalize Boolean Naming

Update all boolean variables to use `is`/`has`/`should` prefixes:

**BookViewer.vue:**
```typescript
// Before
let hasRestoredScrollPosition = false;

// After
let isScrollPositionRestored = false;
```

**book.ts:**
```typescript
// Already correct for most
const isLoading = ref(false);  // ✓

// But function parameter:
function loadBook(file: File, shouldCache: boolean = true, ...)  // ✓ Already correct
```

**HomeScreen.vue, LibraryPanel.vue:**
```typescript
// Before
const isDragging = ref(false);  // ✓ Already correct
```

### Step 4: Normalize Function Naming

Review and rename functions consistently:

**library.ts:**
```typescript
// Keep as is - already follows conventions
async function cacheBook(...)  // ✓ load/cache pattern
async function getBookBlob(...) // ✓ get pattern
async function getCoverImage(...) // ✓ get pattern
```

**useEpub.ts:**
```typescript
// Consider renaming for clarity:
async function loadEpub(...)  // ✓ async load
async function loadChapterByHref(...) // ✓ async load

// These are internal, could be renamed:
async function loadCover(...) // Could be extractCover() or fetchCover()
```

### Step 5: Create Props/Emits Interfaces

If not already present, create interfaces for component props:

```typescript
// src/types/props.ts
export interface ChapterListProps {
  chapters: Chapter[];
}

export interface ChapterListEmits {
  close: [];
  chapterSelect: [index: number];
}
```

### Step 6: Normalize Ref Naming

Make ref naming consistent:

```typescript
// Before (DropZone.vue:13, SearchPanel.vue:16)
const fileInput = ref<HTMLInputElement | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);

// After
const fileInputRef = ref<HTMLInputElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
```

### Step 7: Normalize Map Naming

Update Map names to be more descriptive:

```typescript
// book.ts
// Before
const readingProgress = ref<Map<string, ReadingProgress>>(new Map());

// After
const readingProgressMap = ref<Map<string, ReadingProgress>>(new Map());
```

### Step 8: Create Migration Script

For large codebases, create a script to help with renaming:

```typescript
// scripts/renaming-audit.ts
import * as fs from 'fs';
import * as path from 'path';

interface NamingIssue {
  file: string;
  line: number;
  type: string;
  description: string;
}

const issues: NamingIssue[] = [];

function checkFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Check for boolean without is/has/should prefix
    const boolMatch = line.match(/(const|let|var)\s+(\w+)\s*(?::\s*Ref<>)?\s*=\s*(ref|reactive)\s*(<boolean>)?/);
    if (boolMatch && !boolMatch[2].match(/^(is|has|should)/)) {
      issues.push({
        file: filePath,
        line: index + 1,
        type: 'boolean',
        description: `Boolean variable "${boolMatch[2]}" should use is/has/should prefix`,
      });
    }

    // Check for ref without Ref suffix (optional rule)
    const refMatch = line.match(/ref<(HTML.*?Element)\s*>\s*(\w+)(?!Ref)/);
    if (refMatch) {
      issues.push({
        file: filePath,
        line: index + 1,
        type: 'ref-naming',
        description: `Ref "${refMatch[2]}" could use Ref suffix for clarity`,
      });
    }
  });
}

// Run on all .ts and .vue files
```

### Step 9: Update Linting Rules

Add ESLint rules to enforce conventions:

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    // Enforce naming conventions
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'variable',
        types: ['boolean'],
        format: ['PascalCase'],
        prefix: ['is', 'has', 'should'],
      },
      {
        selector: 'function',
        format: ['camelCase'],
      },
      {
        selector: 'interface',
        format: ['PascalCase'],
        custom: {
          regex: '^I[A-Z]',
          match: false,
        },
      },
    ],
  },
};
```

### Step 10: Document and Train

Update `AGENTS.md` with the naming conventions:
```markdown
## Naming Conventions

See `CONVENTIONS.md` for detailed naming guidelines.

Key conventions:
- Boolean variables: use `is`/`has`/`should` prefix
- Event handlers: use `handle` prefix
- Getter functions: use `get` prefix
- Async loaders: use `load` prefix
- Component props: use `*Props` interface suffix
- Component emits: use `*Emits` interface suffix
```

### Benefits After Refactoring
- Consistent codebase
- Easier onboarding for new developers
- Better IDE autocomplete
- Reduced cognitive load
- Fewer naming-related bugs
- Clearer intent in variable names
