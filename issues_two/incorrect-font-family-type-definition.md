# Incorrect Type Definition for fontFamily in UserPreferences

**Severity:** Low

**Affected Files:**
- `src/types/epub.ts:41`
- `src/stores/settings.ts:9`

## Description

The `UserPreferences` interface defines `fontFamily` as `'georgia' | 'campote' | 'arial' | 'verdana'`, but 'campote' appears to be a typo. Looking at the code, it seems like it should be 'comote' or perhaps it's a custom font name. The `getFontFamily` function in BookViewer.vue uses 'campote' directly.

### Specific Issues:

**src/types/epub.ts (line 41):**
```typescript
export interface UserPreferences {
  theme: 'light' | 'dark' | 'sepia' | 'warm';
  fontSize: number;
  fontFamily: 'georgia' | 'campote' | 'arial' | 'verdana';  // 'campote' - potential typo
  lineHeight: number;
  padding: number;
  wideMode: boolean;
}
```

**src/stores/settings.ts (line 9):**
```typescript
interface StoredPrefs {
  theme: 'light' | 'dark' | 'sepia' | 'warm';
  fontSize: number;
  fontFamily: 'georgia' | 'campote' | 'arial' | 'verdana';  // Same typo
  lineHeight: number;
  padding: number;
  wideMode: boolean;
}
```

**src/components/BookViewer.vue (lines 28-35):**
```typescript
function getFontFamily(font: string): string {
  const fonts: Record<string, string> = {
    georgia: 'Georgia, Cambria, "Times New Roman", serif',
    campote: '"Campote", Georgia, serif',  // Uses 'campote'
    arial: 'Arial, Helvetica, sans-serif',
    verdana: 'Verdana, Arial, sans-serif',
  };
  return fonts[font] || fonts.georgia;
}
```

## Why This is Problematic

1. **Potential Typo**: 'campote' appears to be a typo. Common font names are 'comote', 'comote', or it might be 'comic' for Comic Sans. Without clarification, it's ambiguous.

2. **Missing Font**: If 'Campote' is a custom font, it's not clear if/where it's loaded. If it's a typo, the option will never work as intended.

3. **Type Inconsistency**: If this is a custom font that should be available, it needs to be properly loaded and documented.

4. **User Experience**: Users selecting this font option might not get the expected result.

## Implementation Plan

### Step 1: Determine the Correct Font Name

First, determine what 'campote' should be:

**Option A: It's a typo and should be 'comote'**
- Research if there's a 'Comote' font
- Update the type definition

**Option B: It's a typo and should be 'comic' (Comic Sans)**
- Update the type definition to use 'comic'

**Option C: It's a custom font named 'Campote'**
- Ensure the font is properly loaded in the application
- Document the font source

**Option D: It should be 'cambria' (similar to Georgia)**
- Update to use the standard Cambria font name

**Option E: Remove the option entirely**
- If it's not needed, remove it from the type

### Step 2: Based on Investigation, Apply the Fix

Assuming it's a typo and should be 'comic' (Comic Sans MS), or perhaps 'cambria', here are the fixes:

#### Fix Option 1: Change to 'comic' (Comic Sans MS)

**src/types/epub.ts:**
```typescript
export interface UserPreferences {
  theme: 'light' | 'dark' | 'sepia' | 'warm';
  fontSize: number;
  fontFamily: 'georgia' | 'comic' | 'arial' | 'verdana';  // Changed 'campote' to 'comic'
  lineHeight: number;
  padding: number;
  wideMode: boolean;
}
```

**src/stores/settings.ts:**
```typescript
interface StoredPrefs {
  theme: 'light' | 'dark' | 'sepia' | 'warm';
  fontSize: number;
  fontFamily: 'georgia' | 'comic' | 'arial' | 'verdana';  // Changed 'campote' to 'comic'
  lineHeight: number;
  padding: number;
  wideMode: boolean;
}
```

**src/components/BookViewer.vue:**
```typescript
function getFontFamily(font: string): string {
  const fonts: Record<string, string> = {
    georgia: 'Georgia, Cambria, "Times New Roman", serif',
    comic: '"Comic Sans MS", "Chalkboard SE", "Comic Neue", sans-serif',  // Changed 'campote' to 'comic'
    arial: 'Arial, Helvetica, sans-serif',
    verdana: 'Verdana, Arial, sans-serif',
  };
  return fonts[font] || fonts.georgia;
}
```

#### Fix Option 2: Change to 'cambria' (more common serif font)

**src/types/epub.ts:**
```typescript
export interface UserPreferences {
  theme: 'light' | 'dark' | 'sepia' | 'warm';
  fontSize: number;
  fontFamily: 'georgia' | 'cambria' | 'arial' | 'verdana';  // Changed 'campote' to 'cambria'
  lineHeight: number;
  padding: number;
  wideMode: boolean;
}
```

**src/stores/settings.ts:**
```typescript
interface StoredPrefs {
  theme: 'light' | 'dark' | 'sepia' | 'warm';
  fontSize: number;
  fontFamily: 'georgia' | 'cambria' | 'arial' | 'verdana';  // Changed 'campote' to 'cambria'
  lineHeight: number;
  padding: number;
  wideMode: boolean;
}
```

**src/components/BookViewer.vue:**
```typescript
function getFontFamily(font: string): string {
  const fonts: Record<string, string> = {
    georgia: 'Georgia, Cambria, "Times New Roman", serif',
    cambria: 'Cambria, Georgia, "Times New Roman", serif',  // Changed 'campote' to 'cambria'
    arial: 'Arial, Helvetica, sans-serif',
    verdana: 'Verdana, Arial, sans-serif',
  };
  return fonts[font] || fonts.georgia;
}
```

#### Fix Option 3: Create a proper font union type

If 'Campote' is intentional as a custom font:

**src/types/epub.ts:**
```typescript
export type FontFamily = 'georgia' | 'campote' | 'arial' | 'verdana';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'sepia' | 'warm';
  fontSize: number;
  fontFamily: FontFamily;
  lineHeight: number;
  padding: number;
  wideMode: boolean;
}
```

**src/stores/settings.ts:**
```typescript
import type { FontFamily } from '@/types/epub';

interface StoredPrefs {
  theme: 'light' | 'dark' | 'sepia' | 'warm';
  fontSize: number;
  fontFamily: FontFamily;
  lineHeight: number;
  padding: number;
  wideMode: boolean;
}
```

And ensure the font is loaded (perhaps in `src/styles/main.css` or `src/assets/`):

```css
@font-face {
  font-family: 'Campote';
  src: url('@/assets/fonts/campote.woff2') format('woff2'),
       url('@/assets/fonts/campote.woff') format('woff');
  font-weight: normal;
  font-style: normal;
}
```

### Step 3: Add Font Family Constants

To avoid hardcoding font names in multiple places:

```typescript
// src/types/epub.ts

export const FONT_FAMILY_VALUES = ['georgia', 'comic', 'arial', 'verdana'] as const;
export type FontFamily = typeof FONT_FAMILY_VALUES[number];

export const FONT_FAMILY_LABELS: Record<FontFamily, string> = {
  georgia: 'Georgia',
  comic: 'Comic Sans',
  arial: 'Arial',
  verdana: 'Verdana',
};

export const FONT_FAMILY_STACKS: Record<FontFamily, string> = {
  georgia: 'Georgia, Cambria, "Times New Roman", serif',
  comic: '"Comic Sans MS", "Chalkboard SE", "Comic Neue", sans-serif',
  arial: 'Arial, Helvetica, sans-serif',
  verdana: 'Verdana, Arial, sans-serif',
};
```

Then update BookViewer.vue:

```typescript
import { FONT_FAMILY_STACKS } from '@/types/epub';

function getFontFamily(font: string): string {
  return FONT_FAMILY_STACKS[font as FontFamily] || FONT_FAMILY_STACKS.georgia;
}
```

### Step 4: Update useTheme.ts

If the theme composable ever needs to reference font families:

```typescript
import type { FontFamily, FONT_FAMILY_VALUES } from '@/types/epub';
```

## Priority Order

1. **LOW**: Determine the correct font name (research or ask stakeholder)
2. **LOW**: Update type definitions in src/types/epub.ts and src/stores/settings.ts
3. **LOW**: Update font mapping in src/components/BookViewer.vue
4. **LOW**: Add font family constants to avoid duplication

## Testing Considerations

After implementing these changes:
- Test each font family option in the UI
- Verify the correct font is applied
- Test switching between font families
- If using a custom font, verify it loads correctly
- Check that the font persists across page reloads
- Verify TypeScript compilation succeeds
