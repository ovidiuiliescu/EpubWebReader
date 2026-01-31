# Tight Coupling - Components Directly Importing Multiple Stores

## Severity: High

## Affected Files
- `src/components/BookViewer.vue:1-348`
- `src/components/Controls.vue:1-204`
- `src/components/HomeScreen.vue:1-342`
- `src/components/LibraryPanel.vue:1-295`
- `src/components/SearchPanel.vue:1-146`
- `src/components/ChapterList.vue:1-61`
- `src/App.vue:1-139`

## Description
Multiple components directly import and access Pinia stores, creating tight coupling between the UI layer and state management layer:

**Examples:**

1. **BookViewer.vue** directly imports both `useBookStore` and `useSettingsStore`:
   ```typescript
   import { useBookStore } from '@/stores/book';
   import { useSettingsStore } from '@/stores/settings';
   ```

2. **HomeScreen.vue** directly imports both `useLibraryStore` and `useBookStore`:
   ```typescript
   import { useLibraryStore } from '@/stores/library';
   import { useBookStore } from '@/stores/book';
   ```

3. **Controls.vue** directly imports both `useBookStore` and `useSettingsStore`:
   ```typescript
   import { useBookStore } from '@/stores/book';
   import { useSettingsStore } from '@/stores/settings';
   ```

4. **App.vue** manages UI state (panels) but also directly uses `useBookStore`:
   ```typescript
   import { useBookStore } from '@/stores/book';
   ```

## Why This Is Problematic
- **Tight Coupling**: Components are tightly coupled to specific store implementations
- **Testing Difficulties**: Components cannot be tested without full store setup
- **Component Portability**: Components cannot be reused in different contexts without store dependencies
- **State Transparency**: It's unclear which data comes from props vs stores
- **Reusability Issues**: Panels cannot be used independently of the global app state
- **Debugging Complexity**: State changes can come from many sources making debugging difficult

## Implementation Plan

### Step 1: Create Props Interfaces for Components

**For BookViewer.vue:**
```typescript
// src/types/props.ts
export interface BookViewerProps {
  chapters: Chapter[];
  currentChapter: number;
  currentScrollPosition: number;
  searchHighlight: SearchHighlight | null;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  wideMode: boolean;
  themeClasses: ThemeClasses;
}

export interface BookViewerEmits {
  'scroll': [scrollTop: number];
  'link-click': [event: MouseEvent];
  'chapter-change': [index: number];
}
```

**For ChapterList.vue:**
```typescript
export interface ChapterListProps {
  chapters: Chapter[];
  currentChapter: number;
}

export interface ChapterListEmits {
  'chapter-select': [index: number];
}
```

**For SearchPanel.vue:**
```typescript
export interface SearchPanelProps {
  chapters: Chapter[];
  currentChapter: number;
}

export interface SearchPanelEmits {
  'result-select': [result: SearchResult];
  'close': [];
}
```

**For LibraryPanel.vue:**
```typescript
export interface LibraryPanelProps {
  books: BookMetadata[];
  currentBookId?: string;
}

export interface LibraryPanelEmits {
  'book-select': [metadata: BookMetadata];
  'book-remove': [id: string];
  'book-upload': [file: File];
  'close': [];
}
```

### Step 2: Update BookViewer Component

**Before:**
```typescript
import { useBookStore } from '@/stores/book';
import { useSettingsStore } from '@/stores/settings';

const bookStore = useBookStore();
const settingsStore = useSettingsStore();
```

**After:**
```typescript
// src/components/BookViewer.vue
import type { BookViewerProps } from '@/types/props';

const props = defineProps<BookViewerProps>();
const emit = defineEmits<BookViewerEmits>();

// Use props instead of direct store access
const contentWidth = computed(() =>
  props.wideMode ? 'max-w-full' : 'max-w-2xl'
);

const contentStyle = computed(() => ({
  fontSize: `${props.fontSize}px`,
  fontFamily: getFontFamily(props.fontFamily),
  lineHeight: props.lineHeight,
}));
```

### Step 3: Update ChapterList Component

**Before:**
```typescript
import { useBookStore } from '@/stores/book';

const bookStore = useBookStore();
```

**After:**
```typescript
// src/components/ChapterList.vue
import type { ChapterListProps } from '@/types/props';

const props = defineProps<ChapterListProps>();
const emit = defineEmits<ChapterListEmits>();

function selectChapter(index: number) {
  emit('chapter-select', index);
}
```

### Step 4: Update SearchPanel Component

**Before:**
```typescript
import { useBookStore } from '@/stores/book';

const bookStore = useBookStore();
```

**After:**
```typescript
// src/components/SearchPanel.vue
import type { SearchPanelProps } from '@/types/props';

const props = defineProps<SearchPanelProps>();
const emit = defineEmits<SearchPanelEmits>();
```

### Step 5: Update LibraryPanel Component

**Before:**
```typescript
import { useLibraryStore } from '@/stores/library';
import { useBookStore } from '@/stores/book';

const libraryStore = useLibraryStore();
const bookStore = useBookStore();
```

**After:**
```typescript
// src/components/LibraryPanel.vue
import type { LibraryPanelProps } from '@/types/props';

const props = defineProps<LibraryPanelProps>();
const emit = defineEmits<LibraryPanelEmits>();
```

### Step 6: Create Container Components

Create container components that handle the bridge between stores and presentational components:

**Container for BookReader:**
```vue
<!-- src/components/BookReaderContainer.vue -->
<script setup lang="ts">
import { useBookStore } from '@/stores/book';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/composables/useTheme';
import BookViewer from './BookViewer.vue';

const bookStore = useBookStore();
const settingsStore = useSettingsStore();
const { themeClasses } = useTheme();

function handleScroll(scrollTop: number) {
  // Handle scroll logic
  bookStore.updateProgress({ /* ... */ });
}

function handleLinkClick(event: MouseEvent) {
  // Handle link click logic
}

function handleChapterChange(index: number) {
  bookStore.setChapter(index);
}
</script>

<template>
  <BookViewer
    :chapters="bookStore.chapters"
    :current-chapter="bookStore.currentChapter"
    :current-scroll-position="bookStore.currentScrollPosition"
    :search-highlight="bookStore.searchHighlight"
    :font-size="settingsStore.preferences.fontSize"
    :font-family="settingsStore.preferences.fontFamily"
    :line-height="settingsStore.preferences.lineHeight"
    :wide-mode="settingsStore.preferences.wideMode"
    :theme-classes="themeClasses"
    @scroll="handleScroll"
    @link-click="handleLinkClick"
    @chapter-change="handleChapterChange"
  />
</template>
```

**Container for ChapterList:**
```vue
<!-- src/components/ChapterListContainer.vue -->
<script setup lang="ts">
import { useBookStore } from '@/stores/book';
import ChapterList from './ChapterList.vue';

const bookStore = useBookStore();
const emit = defineEmits<{
  close: [];
}>();

function handleChapterSelect(index: number) {
  bookStore.setChapter(index);
  emit('close');
}
</script>

<template>
  <ChapterList
    :chapters="bookStore.chapters"
    :current-chapter="bookStore.currentChapter"
    @chapter-select="handleChapterSelect"
  />
</template>
```

### Step 7: Update App.vue to Use Container Components

**Before:**
```vue
<ChapterList @close="showToc = false" />
<SearchPanel @close="showSearch = false" />
<LibraryPanel @close="showLibrary = false" />
<BookViewer class="w-full" />
```

**After:**
```vue
<ChapterListContainer @close="showToc = false" />
<SearchPanelContainer @close="showSearch = false" />
<LibraryPanelContainer @close="showLibrary = false" />
<BookReaderContainer />
```

### Step 8: Consider Using provide/inject for Deep Components

For components deep in the tree that need store access:

```typescript
// In parent component
import { provide } from 'vue';
import { bookInjectionKey } from '@/injectionKeys';

provide(bookInjectionKey, bookStore);

// In child component
import { inject } from 'vue';
import { bookInjectionKey } from '@/injectionKeys';

const bookStore = inject(bookInjectionKey)!;
```

### Step 9: Update Types File

Create `src/types/props.ts` with all component props interfaces:

```typescript
// src/types/props.ts
export interface BookViewerProps { /* ... */ }
export interface BookViewerEmits { /* ... */ }
export interface ChapterListProps { /* ... */ }
export interface ChapterListEmits { /* ... */ }
export interface SearchPanelProps { /* ... */ }
export interface SearchPanelEmits { /* ... */ }
export interface LibraryPanelProps { /* ... */ }
export interface LibraryPanelEmits { /* ... */ }

export interface ThemeClasses {
  bg: string;
  text: string;
  prose?: string;
}
```

### Step 10: Testing Strategy

1. **Presentational Components**: Test with mocked props (no store required)
2. **Container Components**: Test with actual or mocked stores
3. **Integration Tests**: Test full flow from container to component

### Benefits After Refactoring
- Components become pure functions of props
- Easier to test in isolation
- Better reusability
- Clear data flow
- Easier to understand and maintain
