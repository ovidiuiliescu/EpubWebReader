# Missing Unit Tests for useTheme Composable

**Severity:** Low  
**Issue Type:** Missing Unit Tests

## Affected Files
- `src/composables/useTheme.ts` (lines 1-62) - Entire file untested

## Description
The `useTheme` composable manages theme switching and provides theme-specific CSS classes for light, dark, sepia, and warm themes. Although relatively simple, it has zero test coverage.

**Untested Functions:**
- `cycleTheme()` - Theme cycling (lines 49-54)
- Computed properties `themeClasses` (lines 7-36)
- Computed property `themeLabel` (lines 38-47)

## Why This Needs Testing
- **User-facing feature**: Theme switching is primary UI interaction
- **CSS class correctness**: Wrong classes would break styling
- **Theme cycling logic**: Must cycle correctly through 4 themes
- **SettingsStore integration**: Depends on settings store, must verify interaction
- **Regression prevention**: Future theme additions could break logic

## Implementation Plan

### 1. Create Test File
`src/composables/useTheme.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from './useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('themeClasses', () => {
    it('should return light theme classes', () => {
      const settingsStore = useSettingsStore();
      settingsStore.preferences.theme = 'light';
      const { themeClasses } = useTheme();
      
      expect(themeClasses.value.bg).toBe('bg-white');
      expect(themeClasses.value.text).toBe('text-gray-900');
      expect(themeClasses.value.prose).toBe('');
    });

    it('should return dark theme classes', () => {
      const settingsStore = useSettingsStore();
      settingsStore.preferences.theme = 'dark';
      const { themeClasses } = useTheme();
      
      expect(themeClasses.value.bg).toBe('bg-gray-900');
      expect(themeClasses.value.text).toBe('text-gray-100');
      expect(themeClasses.value.prose).toBe('prose-invert');
    });

    it('should return sepia theme classes', () => {
      const settingsStore = useSettingsStore();
      settingsStore.preferences.theme = 'sepia';
      const { themeClasses } = useTheme();
      
      expect(themeClasses.value.bg).toBe('bg-[#f4ecd8]');
      expect(themeClasses.value.text).toBe('text-[#5b4636]');
      expect(themeClasses.value.prose).toBe('prose-sepia');
    });

    it('should return warm theme classes', () => {
      const settingsStore = useSettingsStore();
      settingsStore.preferences.theme = 'warm';
      const { themeClasses } = useTheme();
      
      expect(themeClasses.value.bg).toBe('bg-[#faf9f6]');
      expect(themeClasses.value.text).toBe('text-[#333333]');
      expect(themeClasses.value.prose).toBe('');
    });

    it('should react to theme changes', async () => {
      const settingsStore = useSettingsStore();
      const { themeClasses } = useTheme();
      
      expect(themeClasses.value.bg).toBe('bg-white');
      
      settingsStore.setTheme('dark');
      expect(themeClasses.value.bg).toBe('bg-gray-900');
    });
  });

  describe('themeLabel', () => {
    it('should return "Light" for light theme', () => {
      const settingsStore = useSettingsStore();
      settingsStore.preferences.theme = 'light';
      const { themeLabel } = useTheme();
      
      expect(themeLabel.value).toBe('Light');
    });

    it('should return "Dark" for dark theme', () => {
      const settingsStore = useSettingsStore();
      settingsStore.preferences.theme = 'dark';
      const { themeLabel } = useTheme();
      
      expect(themeLabel.value).toBe('Dark');
    });

    it('should return "Sepia" for sepia theme', () => {
      const settingsStore = useSettingsStore();
      settingsStore.preferences.theme = 'sepia';
      const { themeLabel } = useTheme();
      
      expect(themeLabel.value).toBe('Sepia');
    });

    it('should return "Warm" for warm theme', () => {
      const settingsStore = useSettingsStore();
      settingsStore.preferences.theme = 'warm';
      const { themeLabel } = useTheme();
      
      expect(themeLabel.value).toBe('Warm');
    });

    it('should react to theme changes', () => {
      const settingsStore = useSettingsStore();
      const { themeLabel } = useTheme();
      
      settingsStore.setTheme('light');
      expect(themeLabel.value).toBe('Light');
      
      settingsStore.setTheme('dark');
      expect(themeLabel.value).toBe('Dark');
    });
  });

  describe('cycleTheme', () => {
    it('should cycle from light to dark', () => {
      const settingsStore = useSettingsStore();
      settingsStore.preferences.theme = 'light';
      const { cycleTheme, themeClasses } = useTheme();
      
      cycleTheme();
      
      expect(settingsStore.preferences.theme).toBe('dark');
      expect(themeClasses.value.bg).toBe('bg-gray-900');
    });

    it('should cycle from dark to sepia', () => {
      const settingsStore = useSettingsStore();
      settingsStore.preferences.theme = 'dark';
      const { cycleTheme } = useTheme();
      
      cycleTheme();
      
      expect(settingsStore.preferences.theme).toBe('sepia');
    });

    it('should cycle from sepia to warm', () => {
      const settingsStore = useSettingsStore();
      settingsStore.preferences.theme = 'sepia';
      const { cycleTheme } = useTheme();
      
      cycleTheme();
      
      expect(settingsStore.preferences.theme).toBe('warm');
    });

    it('should cycle from warm to light', () => {
      const settingsStore = useSettingsStore();
      settingsStore.preferences.theme = 'warm';
      const { cycleTheme } = useTheme();
      
      cycleTheme();
      
      expect(settingsStore.preferences.theme).toBe('light');
    });

    it('should cycle through all themes in order', () => {
      const settingsStore = useSettingsStore();
      settingsStore.preferences.theme = 'light';
      const { cycleTheme } = useTheme();
      
      cycleTheme(); // light -> dark
      expect(settingsStore.preferences.theme).toBe('dark');
      
      cycleTheme(); // dark -> sepia
      expect(settingsStore.preferences.theme).toBe('sepia');
      
      cycleTheme(); // sepia -> warm
      expect(settingsStore.preferences.theme).toBe('warm');
      
      cycleTheme(); // warm -> light
      expect(settingsStore.preferences.theme).toBe('light');
    });

    it('should update themeClasses when cycling', () => {
      const settingsStore = useSettingsStore();
      settingsStore.preferences.theme = 'light';
      const { cycleTheme, themeClasses } = useTheme();
      
      expect(themeClasses.value.bg).toBe('bg-white');
      
      cycleTheme();
      expect(themeClasses.value.bg).toBe('bg-gray-900');
    });
  });

  describe('integration with SettingsStore', () => {
    it('should update settings store when cycling', () => {
      const settingsStore = useSettingsStore();
      settingsStore.preferences.theme = 'light';
      const { cycleTheme } = useTheme();
      
      cycleTheme();
      
      expect(settingsStore.preferences.theme).toBe('dark');
    });

    it('should read from settings store on initialization', () => {
      const settingsStore = useSettingsStore();
      settingsStore.preferences.theme = 'sepia';
      const { themeClasses } = useTheme();
      
      expect(themeClasses.value.bg).toBe('bg-[#f4ecd8]');
    });
  });
});
```

## Expected Outcomes
- Full test coverage for theme composable
- Theme cycling validated
- CSS class generation verified
- Settings store integration confirmed
- Coverage > 95% for useTheme.ts

## Dependencies
- Must complete "Missing Test Framework and Testing Infrastructure" issue first
