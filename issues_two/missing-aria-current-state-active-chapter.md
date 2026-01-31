# No ARIA current state on active chapter in ChapterList

## Severity
Medium

## Affected Files
- `src/components/ChapterList.vue` (lines 36-51)

## Detailed Description
The ChapterList component displays a list of chapters with the currently active chapter visually highlighted using CSS classes. However, there is no `aria-current="page"` attribute on the active chapter button. This means screen reader users cannot programmatically determine which chapter is currently active without reading through all chapters.

The component relies solely on visual cues (blue background) to indicate the active state, which is inaccessible to screen reader users. The `aria-current` attribute is the standard way to indicate the current item within a set of navigation elements.

## WCAG 2.1 Criteria Violated
- **4.1.2 Name, Role, Value**: For all user interface components, the name and role can be programmatically determined
- **2.4.4 Link Purpose**: The purpose of each link can be determined from the link text alone
- **1.3.1 Info and Relationships**: Information, structure, and relationships conveyed through presentation can be programmatically determined

## Implementation Plan

### Code Changes Required

1. **Add aria-current attribute to active chapter button** (lines 36-51):
```vue
<nav
  class="flex-1 overflow-y-auto p-4"
  aria-label="Table of contents"
>
  <ul class="space-y-1" role="list">
    <li v-for="(chapter, index) in bookStore.chapters" :key="chapter.id">
      <button
        @click="selectChapter(index)"
        :aria-current="index === bookStore.currentChapter ? 'page' : undefined"
        class="w-full text-left px-3 py-2 rounded-lg transition-colors duration-200"
        :class="[
          index === bookStore.currentChapter
            ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-medium'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
        ]"
        :aria-label="`Chapter ${index + 1}: ${chapter.title || 'Untitled'}. ${index === bookStore.currentChapter ? 'Currently reading' : ''}`"
      >
        <span
          class="block text-sm truncate"
          :style="{ paddingLeft: `${chapter.level * 16 + 8}px` }"
        >
          {{ chapter.title || `Chapter ${index + 1}` }}
        </span>
      </button>
    </li>
  </ul>

  <div v-if="bookStore.chapters.length === 0" class="text-center py-8 text-gray-500" role="status">
    No table of contents available
  </div>
</nav>
```

### Additional Considerations
- Added `aria-label="Table of contents"` to the nav element to provide context
- Added `role="list"` to the ul element for explicit semantics
- Enhanced the aria-label on chapter buttons to include both chapter number, title, and current state
- The `aria-current="page"` value is appropriate for navigation items that represent the current page/view
- Consider adding `role="listitem"` to the li elements for complete semantic structure

### Testing Requirements
- Test with screen readers to verify the active chapter is announced
- Ensure the aria-current attribute updates dynamically when the chapter changes
- Verify that the enhanced aria-labels provide clear navigation information
- Test keyboard navigation through the chapter list
