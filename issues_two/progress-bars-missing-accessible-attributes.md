# Progress bars missing accessible attributes

## Severity
High

## Affected Files
- `src/components/Controls.vue` (lines 196-201)
- `src/components/LibraryPanel.vue` (lines 253-258)
- `src/components/HomeScreen.vue` (lines 309-318)

## Detailed Description
Multiple progress bars throughout the application are implemented using HTML `div` elements with only visual styling. These progress bars lack the necessary ARIA attributes to make them accessible to screen reader users:

1. **Missing `role="progressbar"`**: Without this role, screen readers don't recognize the element as a progress bar
2. **Missing `aria-valuenow`**: Current progress value is not announced
3. **Missing `aria-valuemin`**: Minimum value (0) is not specified
4. **Missing `aria-valuemax`**: Maximum value (100) is not specified
5. **Missing accessible labels**: Progress bars need descriptions so users understand what is being measured

This violates WCAG requirements for providing accessible status information.

## WCAG 2.1 Criteria Violated
- **4.1.2 Name, Role, Value**: For all user interface components, the name and role can be programmatically determined
- **1.3.1 Info and Relationships**: Information, structure, and relationships conveyed through presentation can be programmatically determined
- **2.4.6 Headings and Labels**: Headings and labels describe topic or purpose

## Implementation Plan

### Code Changes Required

1. **Controls.vue - Reading progress bar** (lines 196-201):
```vue
<div
  role="progressbar"
  aria-label="Reading progress"
  :aria-valuenow="bookStore.metadata?.progress || 0"
  aria-valuemin="0"
  aria-valuemax="100"
  class="h-1 bg-gray-200 dark:bg-gray-700"
>
  <div
    class="h-full bg-indigo-600 transition-all duration-300"
    :style="{ width: `${bookStore.metadata?.progress || 0}%` }"
  />
</div>
```

2. **LibraryPanel.vue - Book progress bars** (lines 253-258):
```vue
<div
  role="progressbar"
  :aria-label="`Reading progress for ${book.title}`"
  :aria-valuenow="Math.round(book.progress)"
  aria-valuemin="0"
  aria-valuemax="100"
  class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
>
  <div
    class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
    :style="{ width: `${Math.round(book.progress)}%` }"
  />
</div>
```

3. **HomeScreen.vue - Book progress bars** (lines 309-318):
```vue
<div class="flex items-center gap-1.5 text-xs">
  <div
    role="progressbar"
    :aria-label="`Reading progress for ${book.title}`"
    :aria-valuenow="Math.round(book.progress)"
    aria-valuemin="0"
    aria-valuemax="100"
    class="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
  >
    <div
      class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
      :style="{ width: `${Math.round(book.progress)}%` }"
    />
  </div>
  <span class="text-gray-500 dark:text-gray-400 font-medium" aria-hidden="true">
    {{ Math.round(book.progress) }}%
  </span>
</div>
```

### Additional Considerations
- The percentage text should have `aria-hidden="true"` to avoid double announcements since the progress bar already announces the value
- Each progress bar should have a unique, descriptive aria-label that identifies what is being measured
- Ensure that progress bars that represent different data points (e.g., chapter progress vs. overall progress) are clearly differentiated

### Testing Requirements
- Test with screen readers (NVDA, JAWS, VoiceOver) to verify progress values are announced
- Verify that progress updates are announced when they change
- Ensure multiple progress bars on a page are distinguished by their labels
- Test that progress bars are properly announced during dynamic updates
