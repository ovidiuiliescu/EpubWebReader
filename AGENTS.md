# AGENTS.md

This document provides guidelines for agentic coding agents working in this repository.

## Project Overview

EpubWebReader is a **static, client-side EPUB reader** hosted on GitHub Pages. No server required—all processing happens in the browser using Vue 3, Tailwind CSS, and epub.js.

## Build/Lint/Test Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production (GitHub Pages)
npm run build

# Build standalone package (relative paths, works offline)
npm run build:standalone

# Preview production build
npm run preview

# Lint codebase
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run typecheck

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run a single test file
npm run test -- path/to/test.file.ts

# Run tests matching a pattern
npm run test -- --testNamePattern="test pattern"
```

## Vue 3 Composition API

- Use `<script setup>` syntax for all components
- Use composables for shared logic (`useBook.ts`, `useTheme.ts`)
- Prefer `ref` for primitives, `reactive` for objects
- Use `defineProps` and `defineEmits` with TypeScript

```typescript
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useBookStore } from '@/stores/book';

interface Props {
  bookId: string;
}

const props = defineProps<Props>();
const store = useBookStore();
const isLoading = ref(false);
</script>
```

## Tailwind CSS

- Use utility classes inline; avoid `@apply` for component styles
- Support dark mode with `dark:` modifier
- Create custom theme colors in tailwind.config.js
- Keep component styles scoped; avoid global styles

```html
<div class="reader-container dark:bg-gray-900 light:bg-white">
  <article class="prose prose-lg dark:prose-invert">
    {{ content }}
  </article>
</div>
```

## Imports

- Use `@/` alias for `src/` imports
- Group imports in order: Vue, VueUse, stores/composables, components, types
- Sort imports alphabetically within each group

```typescript
import { computed, ref } from 'vue';
import { useStorage } from '@vueuse/core';
import { useBookStore } from '@/stores/book';
import BookViewer from '@/components/BookViewer.vue';
import type { BookMetadata } from '@/types/epub';
```

## Formatting

- Use 2 spaces for indentation
- Use single quotes for strings
- Use trailing commas in multi-line objects/arrays
- Maximum line length: 100 characters
- Use semicolons

## Types

- Prefer interfaces over type aliases for object shapes
- Use explicit return types for public functions
- Avoid `any` type; use `unknown` when uncertain
- Use discriminated unions for error states

```typescript
interface BookMetadata {
  id: string;
  title: string;
  author: string;
  coverImage?: string;
  addedAt: Date;
  lastReadAt: Date;
  progress: number;
}

type EpubResult<T> = { success: true; data: T } | { success: false; error: Error };
```

## Naming Conventions

- **Files**: kebab-case for components (`book-viewer.vue`), camelCase for composables (`useBook.ts`)
- **Components**: PascalCase (`BookViewer`, `TableOfContents`)
- **Composables**: camelCase starting with `use` (`useBook`, `useTheme`)
- **Stores**: PascalCase (`BookStore`, `SettingsStore`)
- **Variables/functions**: camelCase (`parseBook`, `readingProgress`)
- **Constants**: UPPER_SNAKE_CASE for global constants
- **Props interfaces**: `ComponentNameProps` suffix
- **Types**: PascalCase

## Error Handling

- Never use empty catch blocks; always handle or log errors
- Create custom error classes for domain-specific errors
- Return typed error results for async operations
- Use error states in components for user feedback

```typescript
class EpubParseError extends Error {
  constructor(message: string, public readonly filePath: string) {
    super(message);
    this.name = 'EpubParseError';
  }
}

async function loadBook(file: File): Promise<EpubResult<Book>> {
  try {
    const book = await parseEpub(file);
    return { success: true, data: book };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error('Unknown error') };
  }
}
```

## State Management (Pinia)

- Use Pinia stores for global state (book data, user preferences)
- Organize stores by domain (`book.ts`, `settings.ts`, `library.ts`)
- Use composition API style with `defineStore`
- Persist relevant state to localStorage/IndexedDB

```typescript
export const useSettingsStore = defineStore('settings', () => {
  const theme = useStorage('reader-theme', 'light');
  const fontSize = useStorage('reader-font-size', 18);
  const fontFamily = useStorage('reader-font-family', 'georgia');
  
  return { theme, fontSize, fontFamily };
});
```

## Performance

- Memoize expensive computations with `useMemo`
- Memoize callback functions with `useCallback`
- Lazy load components that aren't immediately visible
- Use `shallowRef` for large objects that don't need deep reactivity
- Debounce search input to avoid excessive operations

## Accessibility

- Use semantic HTML elements
- Include aria-labels for icon-only buttons
- Ensure full keyboard navigation works
- Support reduced motion preferences
- Test with screen readers
- Visible focus indicators on all interactive elements

## Security

- Never commit secrets or API keys
- All dependencies bundled locally (no CDN links)
- Sanitize user input before rendering
- Validate file types before processing
- Use Content Security Policy headers

## Git Workflow

- Write clear commit messages: "Add drag-and-drop EPUB upload", "Fix TOC navigation bug"
- Create feature branches from main: `feature/theme-system`
- Squash small commits before merging
- Run lint and tests before pushing

## File Structure

```
src/
├── components/        # Reusable Vue components
│   ├── BookViewer.vue
│   ├── ChapterList.vue
│   ├── Controls.vue
│   ├── DropZone.vue
│   ├── SearchPanel.vue
│   └── SettingsPanel.vue
├── composables/       # Vue composables
│   ├── useBook.ts
│   ├── useEpub.ts
│   ├── useTheme.ts
│   └── useSearch.ts
├── stores/            # Pinia stores
│   ├── book.ts
│   ├── library.ts
│   └── settings.ts
├── types/             # TypeScript definitions
│   └── epub.ts
├── assets/            # Static assets
│   └── fonts/
├── styles/            # Global styles
│   └── main.css
├── App.vue
└── main.ts
```

## Testing

- Write unit tests for composables and utilities
- Write integration tests for user workflows
- Use meaningful test descriptions
- Follow AAA pattern (Arrange, Act, Assert)
- Mock epub.js in tests

```typescript
describe('useBook', () => {
  it('should load EPUB file and extract metadata', () => {
    const { loadBook, metadata } = useBook();
    loadBook(sampleFile);
    expect(metadata.value.title).toBe('Sample Book');
  });
});
```

## Deployment

- Build outputs to `dist/` directory
- Configure base path for GitHub Pages in vite.config.ts
- No server-side code required
- Works completely offline after initial load

## Requirements Reference

See [requirements.md](./requirements.md) for detailed functional and non-functional requirements.
