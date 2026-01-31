# Improper Reactive State Management in Settings

## Severity
Medium

## Affected Files
- `src/stores/settings.ts:27-34, 36-49`

## Description
The settings store creates a reactive object from storage values and uses a deep watch to sync changes back to storage. However, this creates unnecessary reactivity overhead and can lead to sync issues.

```javascript
const storedPrefs = useStorage<StoredPrefs>('reader-preferences', DEFAULT_STORED_PREFS);

const preferences = reactive<UserPreferences>({
  theme: storedPrefs.value.theme,
  fontSize: storedPrefs.value.fontSize,
  fontFamily: storedPrefs.value.fontFamily,
  lineHeight: storedPrefs.value.lineHeight,
  padding: storedPrefs.value.padding,
  wideMode: storedPrefs.value.wideMode,
});

watch(
  () => ({
    theme: preferences.theme,
    fontSize: preferences.fontSize,
    fontFamily: preferences.fontFamily,
    lineHeight: preferences.lineHeight,
    padding: preferences.padding,
    wideMode: preferences.wideMode,
  }),
  (newPrefs) => {
    storedPrefs.value = { ...newPrefs };
  },
  { deep: true }
);
```

## Why This Is A Problem

1. **Double reactivity**: Both `storedPrefs` (from `useStorage`) and `preferences` (from `reactive`) are reactive, creating unnecessary overhead. Changes to one don't automatically sync to the other - they rely on the watch for sync.

2. **Object creation on every access**: The watch source function creates a new object on every reactive access, which is inefficient.

3. **Deep watch overhead**: `{ deep: true }` watches all nested properties recursively, even though `UserPreferences` is a flat object. This adds unnecessary performance overhead.

4. **Potential sync issues**: If `storedPrefs.value` is modified directly (e.g., by `useStorage` reacting to localStorage changes), the `preferences` reactive object won't update until the watch triggers, potentially causing stale state.

5. **Unnecessary complexity**: The code manually syncs between two reactive sources when it could use a single source of truth.

6. **Violation of single source of truth**: Having two separate reactive objects for the same data violates the principle of having a single source of truth for state.

## Implementation Plan

1. Use `useStorage` directly without creating a separate reactive object:

```javascript
import { defineStore } from 'pinia';
import { useStorage, computed } from '@vueuse/core';
import type { UserPreferences } from '@/types/epub';

interface StoredPrefs {
  theme: 'light' | 'dark' | 'sepia' | 'warm';
  fontSize: number;
  fontFamily: 'georgia' | 'campote' | 'arial' | 'verdana';
  lineHeight: number;
  padding: number;
  wideMode: boolean;
}

const DEFAULT_STORED_PREFS: StoredPrefs = {
  theme: 'light',
  fontSize: 18,
  fontFamily: 'georgia',
  lineHeight: 1.8,
  padding: 32,
  wideMode: false,
};

export const useSettingsStore = defineStore('settings', () => {
  // Single source of truth - directly use useStorage
  const preferences = useStorage<UserPreferences>(
    'reader-preferences',
    { ...DEFAULT_STORED_PREFS },
    localStorage,
    { 
      writeDefaults: true,
      mergeDefaults: true,
    }
  );

  // Validation setters to ensure bounds
  function setTheme(theme: UserPreferences['theme']): void {
    preferences.value.theme = theme;
  }

  function setFontSize(size: number): void {
    preferences.value.fontSize = Math.min(32, Math.max(12, size));
  }

  function setFontFamily(font: UserPreferences['fontFamily']): void {
    preferences.value.fontFamily = font;
  }

  function setLineHeight(height: number): void {
    preferences.value.lineHeight = Math.max(1.0, Math.min(2.5, height));
  }

  function setPadding(padding: number): void {
    preferences.value.padding = Math.max(0, Math.min(100, padding));
  }

  function toggleWideMode(): void {
    preferences.value.wideMode = !preferences.value.wideMode;
  }

  function reset(): void {
    Object.assign(preferences.value, DEFAULT_STORED_PREFS);
  }

  // Computed for frequently accessed values (optional)
  const fontSizeLabel = computed(() => `${preferences.value.fontSize}px`);

  return {
    preferences,
    fontSizeLabel,
    setTheme,
    setFontSize,
    setFontFamily,
    setLineHeight,
    setPadding,
    toggleWideMode,
    reset,
  };
});
```

2. If you need computed properties for performance:

```javascript
const fontSizeLabel = computed(() => `${preferences.value.fontSize}px`);

const themeClasses = computed(() => {
  const { theme } = preferences.value;
  
  switch (theme) {
    case 'dark':
      return {
        bg: 'bg-gray-900',
        text: 'text-gray-100',
        prose: 'prose-invert',
      };
    case 'sepia':
      return {
        bg: 'bg-[#f4ecd8]',
        text: 'text-[#5b4636]',
        prose: 'prose-sepia',
      };
    case 'warm':
      return {
        bg: 'bg-[#faf9f6]',
        text: 'text-[#333333]',
        prose: '',
      };
    default:
      return {
        bg: 'bg-white',
        text: 'text-gray-900',
        prose: '',
      };
  }
});

return {
  preferences,
  fontSizeLabel,
  themeClasses,
  // ... setters
};
```

3. Then update `useTheme` composable to use settings directly:

```javascript
import { computed } from 'vue';
import { useSettingsStore } from '@/stores/settings';

export function useTheme() {
  const settingsStore = useSettingsStore();

  const themeLabel = computed(() => {
    const labels = {
      light: 'Light',
      dark: 'Dark',
      sepia: 'Sepia',
      warm: 'Warm',
    };
    return labels[settingsStore.preferences.theme];
  });

  // Optional: Move theme classes computation here or to store
  const themeClasses = computed(() => {
    const { theme } = settingsStore.preferences.theme;
    
    switch (theme) {
      case 'dark':
        return {
          bg: 'bg-gray-900',
          text: 'text-gray-100',
          prose: 'prose-invert',
        };
      case 'sepia':
        return {
          bg: 'bg-[#f4ecd8]',
          text: 'text-[#5b4636]',
          prose: 'prose-sepia',
        };
      case 'warm':
        return {
          bg: 'bg-[#faf9f6]',
          text: 'text-[#333333]',
          prose: '',
        };
      default:
        return {
          bg: 'bg-white',
          text: 'text-gray-900',
          prose: '',
        };
    }
  });

  function cycleTheme(): void {
    const themes: Array<'light' | 'dark' | 'sepia' | 'warm'> = ['light', 'dark', 'sepia', 'warm'];
    const currentIndex = themes.indexOf(settingsStore.preferences.theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    settingsStore.setTheme(themes[nextIndex]);
  }

  return {
    themeClasses,
    themeLabel,
    cycleTheme,
  };
}
```

4. If you need to support migration from old storage format:

```javascript
export const useSettingsStore = defineStore('settings', () => {
  // Check for old format and migrate
  const storedJson = localStorage.getItem('reader-preferences');
  let migrated = false;
  
  if (storedJson) {
    try {
      const stored = JSON.parse(storedJson);
      
      // Check for old format
      if (!stored.theme || !stored.fontSize) {
        migrated = true;
        localStorage.removeItem('reader-preferences');
      }
    } catch {
      // Invalid JSON, remove
      localStorage.removeItem('reader-preferences');
    }
  }

  const preferences = useStorage<UserPreferences>(
    'reader-preferences',
    { ...DEFAULT_STORED_PREFS },
    localStorage,
    { 
      writeDefaults: true,
      mergeDefaults: true,
    }
  );

  // ... rest of implementation
});
```

5. Add TypeScript validation:

```javascript
function isValidTheme(theme: string): theme is UserPreferences['theme'] {
  return ['light', 'dark', 'sepia', 'warm'].includes(theme);
}

function setTheme(theme: string): void {
  if (isValidTheme(theme)) {
    preferences.value.theme = theme;
  } else {
    console.warn(`Invalid theme: ${theme}, using light`);
    preferences.value.theme = 'light';
  }
}
```

6. Consider adding persistence configuration:

```javascript
const preferences = useStorage<UserPreferences>(
  'reader-preferences',
  { ...DEFAULT_STORED_PREFS },
  localStorage,
  { 
    writeDefaults: true,
    mergeDefaults: true,
    serializer: {
      read: (v) => {
        const parsed = JSON.parse(v);
        // Validate and apply defaults for missing properties
        return { ...DEFAULT_STORED_PREFS, ...parsed };
      },
      write: (v) => JSON.stringify(v),
    },
  }
);
```

7. Add a composable for reactive settings access if needed:

```javascript
// composables/useSettings.ts
import { computed } from 'vue';
import { useSettingsStore } from '@/stores/settings';

export function useSettings() {
  const settingsStore = useSettingsStore();

  const theme = computed(() => settingsStore.preferences.theme);
  const fontSize = computed(() => settingsStore.preferences.fontSize);
  const fontFamily = computed(() => settingsStore.preferences.fontFamily);
  const lineHeight = computed(() => settingsStore.preferences.lineHeight);
  const padding = computed(() => settingsStore.preferences.padding);
  const wideMode = computed(() => settingsStore.preferences.wideMode);

  return {
    theme,
    fontSize,
    fontFamily,
    lineHeight,
    padding,
    wideMode,
    setTheme: settingsStore.setTheme,
    setFontSize: settingsStore.setFontSize,
    setFontFamily: settingsStore.setFontFamily,
    setLineHeight: settingsStore.setLineHeight,
    setPadding: settingsStore.setPadding,
    toggleWideMode: settingsStore.toggleWideMode,
    reset: settingsStore.reset,
  };
}
```
