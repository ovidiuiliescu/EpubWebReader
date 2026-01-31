# Side panels lack proper ARIA attributes and focus management

## Severity
High

## Affected Files
- `src/components/App.vue` (lines 94-126)

## Detailed Description
The side panels (TOC, Search, Library) in App.vue are displayed as fixed overlay elements without proper ARIA attributes and focus management. Issues include:

1. **No dialog/modal semantics**: Panels use generic `aside` and `div` elements instead of proper `role="dialog"` or `aria-modal="true"`
2. **Missing ARIA labels**: No `aria-label` or `aria-labelledby` to identify panel purpose
3. **No focus trap**: When a panel opens, focus is not trapped within the panel
4. **No focus management**: Focus is not moved to the first interactive element when panel opens
5. **No focus restoration**: When panel closes, focus is not returned to the triggering button
6. **Missing ARIA hidden**: Overlay doesn't hide underlying content from screen readers

These issues make the panels difficult for keyboard and screen reader users to navigate and interact with.

## WCAG 2.1 Criteria Violated
- **2.4.3 Focus Order**: Focusable components receive focus in an order that preserves meaning and operability
- **4.1.2 Name, Role, Value**: Name and role can be programmatically determined
- **2.1.1 Keyboard**: All functionality is available from a keyboard
- **2.4.1 Bypass Blocks**: Mechanisms are available to bypass blocks of content

## Implementation Plan

### Code Changes Required

1. **Update TOC sidebar with proper ARIA attributes** (lines 94-100):
```vue
<!-- TOC Sidebar -->
<aside
  v-if="showToc"
  ref="tocPanel"
  role="dialog"
  aria-modal="true"
  aria-label="Table of contents"
  class="fixed top-16 bottom-0 right-0 z-50 w-72 overflow-y-auto border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl transition-transform duration-300"
  :class="themeClasses.bg"
  @keydown.esc="toggleToc"
>
  <ChapterList @close="toggleToc" />
</aside>
```

2. **Update Search panel with proper ARIA attributes** (lines 111-117):
```vue
<!-- Search Panel -->
<div
  v-if="showSearch"
  ref="searchPanel"
  role="dialog"
  aria-modal="true"
  aria-label="Search"
  class="fixed top-16 bottom-0 right-0 z-50 w-80 overflow-y-auto border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl"
  :class="themeClasses.bg"
  @keydown.esc="toggleSearch"
>
  <SearchPanel @close="toggleSearch" />
</div>
```

3. **Update Library panel with proper ARIA attributes** (lines 120-126):
```vue
<!-- Library Panel -->
<div
  v-if="showLibrary"
  ref="libraryPanel"
  role="dialog"
  aria-modal="true"
  aria-label="Library"
  class="fixed top-16 bottom-0 right-0 z-50 w-80 overflow-y-auto border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl"
  :class="themeClasses.bg"
  @keydown.esc="toggleLibrary"
>
  <LibraryPanel @close="toggleLibrary" />
</div>
```

4. **Update overlay with ARIA attributes** (lines 132-136):
```vue
<!-- Overlay for mobile when panels are open -->
<div
  v-if="showToc || showSearch || showLibrary"
  class="fixed inset-0 bg-black/50 z-40 lg:hidden"
  @click="closePanels"
  aria-hidden="true"
/>
```

5. **Add focus management functions** - In script section:
```typescript
import { ref, watch, nextTick } from 'vue';

const tocPanel = ref<HTMLElement | null>(null);
const searchPanel = ref<HTMLElement | null>(null);
const libraryPanel = ref<HTMLElement | null>(null);
const lastFocusedElement = ref<HTMLElement | null>(null);

// Trap focus within panel
function trapFocus(panel: HTMLElement | null) {
  if (!panel) return;

  const focusableElements = panel.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstFocusable = focusableElements[0] as HTMLElement;
  const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

  if (firstFocusable) {
    firstFocusable.focus();
  }

  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  };

  panel.addEventListener('keydown', handleTabKey);
  return () => panel.removeEventListener('keydown', handleTabKey);
}

// Watch for panel open/close
watch(showToc, async (isOpen) => {
  if (isOpen) {
    lastFocusedElement.value = document.activeElement as HTMLElement;
    await nextTick();
    trapFocus(tocPanel.value);
  } else {
    lastFocusedElement.value?.focus();
  }
});

watch(showSearch, async (isOpen) => {
  if (isOpen) {
    lastFocusedElement.value = document.activeElement as HTMLElement;
    await nextTick();
    trapFocus(searchPanel.value);
  } else {
    lastFocusedElement.value?.focus();
  }
});

watch(showLibrary, async (isOpen) => {
  if (isOpen) {
    lastFocusedElement.value = document.activeElement as HTMLElement;
    await nextTick();
    trapFocus(libraryPanel.value);
  } else {
    lastFocusedElement.value?.focus();
  }
});
```

6. **Update main content with proper landmark** (line 103-108):
```vue
<!-- Book Content -->
<main
  role="main"
  aria-label="Book content"
  class="flex-1 transition-all duration-300 overflow-hidden flex justify-center"
  :class="{ 'mr-72': showToc, 'mr-80': showSearch || showLibrary }"
>
  <BookViewer class="w-full" />
</main>
```

### Additional Considerations
- `role="dialog"` identifies the panels as dialogs for screen readers
- `aria-modal="true"` indicates that the underlying content is not available for interaction
- Added `@keydown.esc` handlers for closing panels with Escape key
- Focus trap ensures keyboard users stay within the panel
- Focus restoration returns focus to the button that opened the panel
- `aria-hidden="true"` on overlay hides it from screen readers
- Added `role="main"` to the main content area for proper landmark navigation
- Consider adding a visible close button in each panel for mouse users
- On desktop (lg breakpoint), panels might be sidebars rather than modals - adjust behavior accordingly

### Testing Requirements
- Test keyboard navigation into and out of panels
- Verify Escape key closes panels
- Ensure focus is trapped within open panels
- Verify focus returns to the trigger button when panels close
- Test with screen readers to verify panels are announced as dialogs
- Ensure panels are properly labeled
- Test that underlying content is not accessible when panel is open (aria-modal)
- Verify focus order is logical within panels
