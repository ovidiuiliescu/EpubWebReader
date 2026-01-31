# Hidden file inputs without proper ARIA labels

## Severity
Medium

## Affected Files
- `src/components/LibraryPanel.vue` (lines 286-292)
- `src/components/DropZone.vue` (lines 120-126)
- `src/components/HomeScreen.vue` (lines 333-339)

## Affected Lines

### LibraryPanel.vue (lines 286-292)
```vue
<input
  ref="fileInput"
  type="file"
  accept=".epub,.EPUB"
  class="hidden"
  @change="handleFileSelect"
/>
```

### DropZone.vue (lines 120-126)
```vue
<input
  ref="fileInput"
  type="file"
  accept=".epub,.EPUB"
  class="hidden"
  @change="handleFileSelect"
/>
```

### HomeScreen.vue (lines 333-339)
```vue
<input
  ref="fileInput"
  type="file"
  accept=".epub,.EPUB"
  class="hidden"
  @change="handleLibraryFileSelect"
/>
```

## Detailed Description
Multiple components use hidden file input elements that are programmatically triggered by button clicks. While these inputs are visually hidden with CSS (`class="hidden"`), they remain in the DOM and can be focused by keyboard users tabbing through the page. Without proper ARIA labels, screen reader users may encounter an unlabeled form element with no context about its purpose.

These hidden inputs are triggered by buttons that do have labels (e.g., "Upload Book", "Add Book", "Select EPUB File"), but the input itself lacks any identification. This can create confusion if a keyboard user accidentally focuses the input or if a screen reader announces it.

## WCAG 2.1 Criteria Violated
- **2.4.6 Headings and Labels**: Form elements have associated labels
- **4.1.2 Name, Role, Value**: Name and role of user interface components can be programmatically determined
- **1.3.1 Info and Relationships**: Labels are associated with form controls

## Implementation Plan

### Code Changes Required

1. **LibraryPanel.vue - Add aria-label to file input** (lines 286-292):
```vue
<input
  ref="fileInput"
  type="file"
  accept=".epub,.EPUB"
  class="hidden"
  aria-label="Upload EPUB file to library"
  @change="handleFileSelect"
/>
```

2. **DropZone.vue - Add aria-label to file input** (lines 120-126):
```vue
<input
  ref="fileInput"
  type="file"
  accept=".epub,.EPUB"
  class="hidden"
  aria-label="Select EPUB file"
  @change="handleFileSelect"
/>
```

3. **HomeScreen.vue - Add aria-label to file input** (lines 333-339):
```vue
<input
  ref="fileInput"
  type="file"
  accept=".epub,.EPUB"
  class="hidden"
  aria-label="Add EPUB file to library"
  @change="handleLibraryFileSelect"
/>
```

### Alternative Solution (Better Approach)

A more robust solution is to completely hide the file inputs from assistive technology while still keeping them functional for programmatic triggers. This can be done using `tabindex="-1"` and `aria-hidden="true"`:

```vue
<input
  ref="fileInput"
  type="file"
  accept=".epub,.EPUB"
  class="hidden"
  tabindex="-1"
  aria-hidden="true"
  @change="handleFileSelect"
/>
```

This approach:
- Removes the input from the tab order (`tabindex="-1"`)
- Hides it from screen readers (`aria-hidden="true"`)
- Still allows programmatic triggering via the visible buttons

### Additional Considerations
- The trigger buttons already have appropriate labels, so users will interact with those instead of the hidden input
- If using the alternative solution, ensure the trigger buttons have proper `aria-label` attributes
- Consider adding `aria-describedby` to relate the button to its purpose
- The alternative solution is preferred as it completely removes the hidden input from the accessibility tree

### Testing Requirements
- Verify hidden inputs are not reachable via keyboard navigation
- Test with screen readers to ensure hidden inputs are not announced
- Verify the trigger buttons still function correctly
- Ensure the file upload functionality works with the modified attributes
