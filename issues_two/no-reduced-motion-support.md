# No reduced motion support for animations

## Severity
Medium

## Affected Files
- `src/components/LibraryPanel.vue` (lines 209, 256, 265, 279)
- `src/components/HomeScreen.vue` (lines 246, 262, 264, 265)
- `src/components/BookViewer.vue` (lines 78, 117, 134, 244, 334)
- `src/components/Controls.vue` (lines 199)
- `src/components/ChapterList.vue` (line 40)
- `src/components/DropZone.vue` (lines 56, 59)
- `src/components/SearchPanel.vue` (line 99)

## Detailed Description
Multiple components throughout the application use CSS transitions and animations without respecting the user's `prefers-reduced-motion` system preference. This can cause issues for users with vestibular disorders, motion sensitivity, or those who simply prefer reduced motion for cognitive reasons.

Affected animations include:
- **Hover effects**: Scale transforms, translations, opacity changes
- **Loading spinners**: Rotating animations
- **Scroll behaviors**: Smooth scrolling
- **Progress bar transitions**: Width changes over time
- **Search highlights**: Highlighting effects
- **Chapter transitions**: Smooth scrolling between chapters
- **Interactive feedback**: Button hover states, card hover effects

When users have `prefers-reduced-motion: reduce` enabled in their system preferences, these animations should be disabled or significantly reduced to prevent motion sickness, dizziness, or cognitive overload.

## WCAG 2.1 Criteria Violated
- **2.3.3 Animation from Interactions**: Motion animation triggered by user interaction can be disabled, unless the animation is essential to the functionality or the information being conveyed

## Implementation Plan

### Code Changes Required

1. **Create reduced motion utility class** - Add to global CSS or tailwind.config.js:
```css
/* In src/styles/main.css */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  /* Disable loading spinners */
  .animate-spin,
  .animate-pulse,
  .animate-bounce {
    animation: none !important;
  }
}
```

2. **Or extend Tailwind configuration** - In tailwind.config.js:
```js
module.exports = {
  // ... existing config
  theme: {
    extend: {
      transitionDuration: {
        'instant': '0ms',
      }
    }
  },
  plugins: [
    // ... existing plugins
    function({ addUtilities }) {
      addUtilities({
        '.motion-reduce': {
          '@media (prefers-reduced-motion: reduce)': {
            'animation-duration': '0.01ms !important',
            'transition-duration': '0.01ms !important',
            'animation-iteration-count': '1 !important',
          }
        }
      })
    }
  ]
}
```

3. **Update BookViewer.vue scroll behaviors** (lines 78, 117, 134, 244, 334):
```typescript
// Get user's reduced motion preference
const prefersReducedMotion = computed(() => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
});

function handleLinkClick(event: MouseEvent) {
  // ... existing code ...
  if (targetElement) {
    targetElement.scrollIntoView({
      behavior: prefersReducedMotion.value ? 'auto' : 'smooth',
      block: 'start'
    });
  }
  // ... rest of code ...
}

function scrollToFirstHighlight() {
  const highlights = articleRef.value?.querySelectorAll('.search-highlight');
  if (highlights && highlights.length > 0) {
    const targetIndex = bookStore.searchHighlight?.matchIndex ?? 0;
    const targetHighlight = highlights[Math.min(targetIndex, highlights.length - 1)];
    if (targetHighlight) {
      targetHighlight.scrollIntoView({
        behavior: prefersReducedMotion.value ? 'auto' : 'smooth',
        block: 'center'
      });
    }
  }
}
```

4. **Update SearchPanel.vue loading spinner** (line 100):
```vue
<svg
  v-if="!prefersReducedMotion"
  class="animate-spin h-6 w-6 text-indigo-600"
  xmlns="http://www.w3.org/2000/svg"
  fill="none"
  viewBox="0 0 24 24"
  aria-hidden="true"
>
  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
</svg>
<span v-else class="text-indigo-600">Searching...</span>
```

5. **Update hover transitions** - Apply to all hover effects (LibraryPanel, HomeScreen, etc.):
```vue
<!-- Instead of fixed duration, use conditionally applied class -->
<div
  class="group relative z-10 cursor-pointer border border-gray-200 dark:border-gray-600 rounded-xl transition-all duration-300 hover:-translate-y-1"
  :class="{ 'motion-reduce': prefersReducedMotion }"
>
```

6. **Update progress bar transitions** (Controls.vue line 199, LibraryPanel.vue line 256, HomeScreen.vue line 312):
```vue
<div
  class="h-full bg-indigo-600 transition-all duration-300"
  :class="{ 'motion-reduce': prefersReducedMotion }"
  :style="{ width: `${bookStore.metadata?.progress || 0}%` }"
/>
```

### Additional Considerations
- The global CSS approach is most comprehensive and covers all animations
- For a more granular approach, use a composable to check the preference:
```typescript
// In src/composables/useReducedMotion.ts
import { ref, onMounted, onUnmounted } from 'vue';

export function useReducedMotion() {
  const prefersReducedMotion = ref(false);

  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const updatePreference = (e: MediaQueryListEvent | MediaQueryList) => {
    prefersReducedMotion.value = e.matches;
  };

  onMounted(() => {
    updatePreference(mediaQuery);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updatePreference);
    }
  });

  onUnmounted(() => {
    if (mediaQuery.removeEventListener) {
      mediaQuery.removeEventListener('change', updatePreference);
    }
  });

  return { prefersReducedMotion };
}
```
- Loading spinners should be replaced with static text indicators when motion is reduced
- Smooth scrolling should be disabled in favor of instant scrolling
- Hover effects can remain but without transitions or with very fast transitions
- Test that essential functionality is preserved when animations are disabled

### Testing Requirements
- Test with `prefers-reduced-motion: reduce` enabled in browser dev tools
- Verify all animations and transitions respect the reduced motion preference
- Test that functionality remains intact when animations are disabled
- Verify that loading states are still communicated without spinning animations
- Ensure smooth scrolling becomes instant scrolling when reduced motion is enabled
