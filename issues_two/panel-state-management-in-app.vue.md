# Panel State Management in App.vue

## Severity: Medium

## Affected Files
- `src/App.vue:15-51`

## Description
The `App.vue` component manually manages panel state (showToc, showSearch, showLibrary) with tightly coupled logic:

```typescript
const showToc = ref(false);
const showSearch = ref(false);
const showLibrary = ref(false);

function toggleToc() {
  showToc.value = !showToc.value;
  showSearch.value = false;
  showLibrary.value = false;
}

function toggleSearch() {
  showSearch.value = !showSearch.value;
  showToc.value = false;
  showLibrary.value = false;
}

function toggleLibrary() {
  showLibrary.value = !showLibrary.value;
  showToc.value = false;
  showSearch.value = false;
}

function closePanels() {
  showToc.value = false;
  showSearch.value = false;
  showLibrary.value = false;
}
```

Each toggle function manually sets the other panels to false, creating code duplication and making it difficult to add new panels.

## Why This Is Problematic
- **Code Duplication**: Each toggle function repeats the same "close others" logic
- **Poor Scalability**: Adding new panels requires updating all existing toggle functions
- **Hard to Maintain**: Logic is scattered and fragile
- **Tight Coupling**: Panel knowledge is embedded in toggle functions
- **Testing Complexity**: Each toggle requires testing interactions with all other panels
- **Error Prone**: Easy to forget to close other panels when adding new functionality

## Implementation Plan

### Step 1: Create Panel State Composable

Create `src/composables/usePanelState.ts`:
```typescript
import { ref, computed } from 'vue';

export type PanelId = 'toc' | 'search' | 'library';

export interface PanelStateOptions {
  allowMultiple?: boolean;
  onCloseAll?: () => void;
}

export function usePanelState(options: PanelStateOptions = {}) {
  const { allowMultiple = false, onCloseAll } = options;

  const activePanel = ref<PanelId | null>(null);

  const isPanelOpen = computed(() => (panelId: PanelId) => {
    return activePanel.value === panelId;
  });

  const anyPanelOpen = computed(() => activePanel.value !== null);

  function openPanel(panelId: PanelId) {
    if (!allowMultiple) {
      // Close any other panel before opening this one
      activePanel.value = panelId;
    } else {
      // Multiple panels can be open
      if (activePanel.value === panelId) {
        activePanel.value = null;
      } else {
        activePanel.value = panelId;
      }
    }
  }

  function closePanel(panelId?: PanelId) {
    if (panelId) {
      if (activePanel.value === panelId) {
        activePanel.value = null;
        onCloseAll?.();
      }
    } else {
      // Close all panels if no specific panel specified
      activePanel.value = null;
      onCloseAll?.();
    }
  }

  function togglePanel(panelId: PanelId) {
    if (activePanel.value === panelId) {
      closePanel(panelId);
    } else {
      openPanel(panelId);
    }
  }

  function openToc() {
    openPanel('toc');
  }

  function toggleToc() {
    togglePanel('toc');
  }

  function openSearch() {
    openPanel('search');
  }

  function toggleSearch() {
    togglePanel('search');
  }

  function openLibrary() {
    openPanel('library');
  }

  function toggleLibrary() {
    togglePanel('library');
  }

  function closeAllPanels() {
    closePanel();
  }

  return {
    activePanel,
    isPanelOpen,
    anyPanelOpen,
    openPanel,
    closePanel,
    togglePanel,
    openToc,
    toggleToc,
    openSearch,
    toggleSearch,
    openLibrary,
    toggleLibrary,
    closeAllPanels,
  };
}
```

### Step 2: Create Panel Store (Alternative Approach)

For more complex scenarios, create a dedicated store `src/stores/panel.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type PanelId = 'toc' | 'search' | 'library';

export const usePanelStore = defineStore('panel', () => {
  const activePanel = ref<PanelId | null>(null);
  const panelHistory = ref<PanelId[]>([]);
  const maxHistorySize = 10;

  const isPanelOpen = computed(() => (panelId: PanelId) => {
    return activePanel.value === panelId;
  });

  const anyPanelOpen = computed(() => activePanel.value !== null);

  function openPanel(panelId: PanelId, saveToHistory = true) {
    if (activePanel.value !== panelId) {
      if (saveToHistory && activePanel.value) {
        addToHistory(activePanel.value);
      }
      activePanel.value = panelId;
    }
  }

  function closePanel() {
    activePanel.value = null;
  }

  function togglePanel(panelId: PanelId) {
    if (activePanel.value === panelId) {
      closePanel();
    } else {
      openPanel(panelId);
    }
  }

  function addToHistory(panelId: PanelId) {
    panelHistory.value.unshift(panelId);
    if (panelHistory.value.length > maxHistorySize) {
      panelHistory.value.pop();
    }
  }

  function goToPreviousPanel() {
    const previous = panelHistory.value.shift();
    if (previous) {
      activePanel.value = previous;
    }
  }

  function closeAllPanels() {
    activePanel.value = null;
    panelHistory.value = [];
  }

  function openToc() {
    openPanel('toc');
  }

  function toggleToc() {
    togglePanel('toc');
  }

  function openSearch() {
    openPanel('search');
  }

  function toggleSearch() {
    togglePanel('search');
  }

  function openLibrary() {
    openPanel('library');
  }

  function toggleLibrary() {
    togglePanel('library');
  }

  return {
    activePanel,
    panelHistory,
    isPanelOpen,
    anyPanelOpen,
    openPanel,
    closePanel,
    togglePanel,
    openToc,
    toggleToc,
    openSearch,
    toggleSearch,
    openLibrary,
    toggleLibrary,
    closeAllPanels,
    goToPreviousPanel,
  };
});
```

### Step 3: Update App.vue with Composable

Update `src/App.vue`:
```vue
<script setup lang="ts">
import { useBookStore } from '@/stores/book';
import { usePanelState } from '@/composables/usePanelState';
import HomeScreen from '@/components/HomeScreen.vue';
import BookViewer from '@/components/BookViewer.vue';
import Controls from '@/components/Controls.vue';
import ChapterList from '@/components/ChapterList.vue';
import SearchPanel from '@/components/SearchPanel.vue';
import LibraryPanel from '@/components/LibraryPanel.vue';
import { useTheme } from '@/composables/useTheme';

const bookStore = useBookStore();
const { themeClasses } = useTheme();

const panel = usePanelState();

function handleFileDrop(file: File, shouldCache: boolean = true, existingBookId?: string) {
  if (file.name.endsWith('.epub') || file.name.endsWith('.EPUB')) {
    bookStore.loadBook(file, shouldCache, existingBookId).catch(err => {
      console.error('Failed to load book:', err);
    });
  } else {
    console.warn('Invalid file type:', file.name);
  }
}
</script>

<template>
  <div
    :class="[
      'min-h-screen transition-colors duration-300',
      themeClasses.bg,
      themeClasses.text
    ]"
  >
    <!-- No Book Loaded State -->
    <HomeScreen
      v-if="!bookStore.currentBook"
      @select-book="handleFileDrop"
    />

    <!-- Loading State -->
    <div
      v-else-if="bookStore.isLoading"
      class="flex flex-col items-center justify-center min-h-screen"
      :class="[themeClasses.bg, themeClasses.text]"
    >
      <svg class="animate-spin h-12 w-12 text-indigo-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-lg">Loading book...</p>
    </div>

    <!-- Book Loaded State -->
    <template v-else>
      <div class="flex flex-col h-screen">
        <!-- Top Controls -->
        <Controls
          @toggle-toc="panel.toggleToc"
          @toggle-search="panel.toggleSearch"
          @toggle-library="panel.toggleLibrary"
        />

        <!-- Main Content Area -->
        <div class="flex flex-1 overflow-hidden">
          <!-- TOC Sidebar -->
          <aside
            v-if="panel.isPanelOpen('toc')"
            class="fixed top-16 bottom-0 right-0 z-50 w-72 overflow-y-auto border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl transition-transform duration-300"
            :class="themeClasses.bg"
          >
            <ChapterList @close="panel.closePanel" />
          </aside>

          <!-- Book Content -->
          <main
            class="flex-1 transition-all duration-300 overflow-hidden flex justify-center"
            :class="{ 'mr-72': panel.isPanelOpen('toc'), 'mr-80': panel.isPanelOpen('search') || panel.isPanelOpen('library') }"
          >
            <BookViewer class="w-full" />
          </main>

          <!-- Search Panel -->
          <div
            v-if="panel.isPanelOpen('search')"
            class="fixed top-16 bottom-0 right-0 z-50 w-80 overflow-y-auto border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl"
            :class="themeClasses.bg"
          >
            <SearchPanel @close="panel.closePanel" />
          </div>

          <!-- Library Panel -->
          <div
            v-if="panel.isPanelOpen('library')"
            class="fixed top-16 bottom-0 right-0 z-50 w-80 overflow-y-auto border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl"
            :class="themeClasses.bg"
          >
            <LibraryPanel @close="panel.closePanel" />
          </div>
        </div>
      </div>
    </template>

    <!-- Overlay for mobile when panels are open -->
    <div
      v-if="panel.anyPanelOpen"
      class="fixed inset-0 bg-black/50 z-40 lg:hidden"
      @click="panel.closeAllPanels"
    />
  </div>
</template>
```

### Step 4: Alternative - Update App.vue with Store

```typescript
import { usePanelStore } from '@/stores/panel';

const panelStore = usePanelStore();
```

And update template:
```vue
<Controls
  @toggle-toc="panelStore.toggleToc"
  @toggle-search="panelStore.toggleSearch"
  @toggle-library="panelStore.toggleLibrary"
/>
```

### Step 5: Add Panel History Navigation (Optional)

Add back/forward buttons to navigate panel history:

```vue
<template>
  <div>
    <button
      v-if="panelStore.panelHistory.length > 0"
      @click="panelStore.goToPreviousPanel"
    >
      ← Back
    </button>
  </div>
</template>
```

### Step 6: Add Keyboard Shortcuts

Add keyboard shortcuts for panel management:

```typescript
onMounted(() => {
  const handleKeydown = (e: KeyboardEvent) => {
    // Escape to close all panels
    if (e.key === 'Escape') {
      panel.closeAllPanels();
    }

    // Ctrl/Cmd + numbers for quick panel access
    if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '3') {
      e.preventDefault();
      const panelMap: Record<string, PanelId> = {
        '1': 'toc',
        '2': 'search',
        '3': 'library',
      };
      panel.togglePanel(panelMap[e.key]);
    }
  };

  window.addEventListener('keydown', handleKeydown);

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
});
```

### Benefits After Refactoring
- Single source of truth for panel state
- Easy to add new panels
- No code duplication
- Better testability
- Optional panel history tracking
- Can add keyboard shortcuts easily
- Cleaner component code
