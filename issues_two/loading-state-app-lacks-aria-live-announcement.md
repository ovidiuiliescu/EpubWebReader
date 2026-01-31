# Loading state in App.vue lacks ARIA live announcement

## Severity
High

## Affected Files
- `src/components/App.vue` (lines 69-79)

## Detailed Description
The loading state in App.vue (displayed when `bookStore.isLoading` is true) is a purely visual indicator with no ARIA attributes. Screen reader users are not notified when:

1. A book is being loaded
2. Loading has completed
3. The view has changed from loading to content

The loading spinner is rendered as an SVG with an adjacent text "Loading book...", but there is no `role="status"` or `aria-live` region to announce this state to screen readers. This leaves users unaware of the application's state during loading operations.

## WCAG 2.1 Criteria Violated
- **4.1.3 Status Messages**: Status messages can be programmatically determined through role or properties such that they can be presented to the user without receiving focus
- **2.4.6 Headings and Labels**: Loading indicators describe their purpose

## Implementation Plan

### Code Changes Required

1. **Add ARIA attributes to loading state** (lines 69-79):
```vue
<!-- Loading State -->
<div
  v-else-if="bookStore.isLoading"
  role="status"
  aria-live="polite"
  aria-busy="true"
  class="flex flex-col items-center justify-center min-h-screen"
  :class="[themeClasses.bg, themeClasses.text]"
>
  <svg
    v-if="!prefersReducedMotion"
    class="animate-spin h-12 w-12 text-indigo-600 mb-4"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
  <p class="text-lg" role="alert">Loading book...</p>
</div>
```

2. **Add composable for reduced motion preference** - Create or import:
```typescript
// In script section
import { useReducedMotion } from '@/composables/useReducedMotion';

const { prefersReducedMotion } = useReducedMotion();
```

### Additional Considerations
- `role="status"` identifies this as a status message region
- `aria-live="polite"` ensures the announcement doesn't interrupt users
- `aria-busy="true"` indicates that content is being loaded
- `aria-hidden="true"` on the SVG hides the decorative spinner from screen readers
- The text "Loading book..." provides clear information about what's happening
- Consider adding `role="alert"` to the paragraph for extra emphasis
- The loading spinner should be hidden or replaced with text when `prefers-reduced-motion` is true

### Alternative: Provide More Context

To provide better context about what's being loaded:
```vue
<p class="text-lg" role="alert">
  Loading book{{ bookStore.metadata?.title ? `: ${bookStore.metadata.title}` : '...' }}
</p>
```

### Testing Requirements
- Test with screen readers to verify loading announcements
- Ensure "Loading book..." is announced when loading begins
- Verify that loading announcements are polite (don't interrupt)
- Test that loading state respects `prefers-reduced-motion` preference
- Ensure spinner is hidden from screen readers
- Verify that the transition from loading to content is smooth and announced
