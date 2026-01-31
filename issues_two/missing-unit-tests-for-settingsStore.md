# Missing Unit Tests for SettingsStore

**Severity:** Low  
**Issue Type:** Missing Unit Tests

## Affected Files
- `src/stores/settings.ts` (lines 1-95) - Entire file untested

## Description
The `settingsStore` (Pinia store) manages user preferences including theme, font size, font family, line height, padding, and wide mode. It uses VueUse's `useStorage` for localStorage persistence. Has zero test coverage.

**Untested Functions:**
- `setTheme()` - Set theme (lines 51-53)
- `setFontSize()` - Set font size (lines 55-57)
- `setFontFamily()` - Set font family (lines 59-61)
- `setLineHeight()` - Set line height (lines 63-65)
- `setPadding()` - Set padding (lines 67-69)
- `toggleWideMode()` - Toggle wide mode (lines 71-73)
- `reset()` - Reset to defaults (lines 75-82)

## Why This Needs Testing
- **User preferences**: All reader settings depend on this store
- **LocalStorage persistence**: Settings must persist across sessions
- **VueUse integration**: `useStorage` behavior must be verified
- **Constraints**: Font size has min/max bounds (line 56)
- **Default values**: Must initialize correctly from DEFAULT_STORED_PREFS
- **Watch behavior**: Changes must sync to localStorage (lines 36-49)
- **Reset functionality**: Users rely on reset to restore defaults

## Implementation Plan

### 1. Create Test File
`src/stores/settings.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSettingsStore } from './settings';

describe('useSettingsStore', () => {
  let settingsStore: ReturnType<typeof useSettingsStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    settingsStore = useSettingsStore();
  });

  afterEach(() => {
    localStorage.clear();
  });
});
```

### 2. Test Initial State
```typescript
describe('initial state', () => {
  it('should initialize with default theme', () => {
    expect(settingsStore.preferences.theme).toBe('light');
  });

  it('should initialize with default fontSize', () => {
    expect(settingsStore.preferences.fontSize).toBe(18);
  });

  it('should initialize with default fontFamily', () => {
    expect(settingsStore.preferences.fontFamily).toBe('georgia');
  });

  it('should initialize with default lineHeight', () => {
    expect(settingsStore.preferences.lineHeight).toBe(1.8);
  });

  it('should initialize with default padding', () => {
    expect(settingsStore.preferences.padding).toBe(32);
  });

  it('should initialize with default wideMode', () => {
    expect(settingsStore.preferences.wideMode).toBe(false);
  });
});
```

### 3. Test SetTheme Function
```typescript
describe('setTheme', () => {
  it('should set theme to light', () => {
    settingsStore.setTheme('light');
    expect(settingsStore.preferences.theme).toBe('light');
  });

  it('should set theme to dark', () => {
    settingsStore.setTheme('dark');
    expect(settingsStore.preferences.theme).toBe('dark');
  });

  it('should set theme to sepia', () => {
    settingsStore.setTheme('sepia');
    expect(settingsStore.preferences.theme).toBe('sepia');
  });

  it('should set theme to warm', () => {
    settingsStore.setTheme('warm');
    expect(settingsStore.preferences.theme).toBe('warm');
  });
});
```

### 4. Test SetFontSize Function
```typescript
describe('setFontSize', () => {
  it('should set font size within bounds', () => {
    settingsStore.setFontSize(20);
    expect(settingsStore.preferences.fontSize).toBe(20);
  });

  it('should not set font size below minimum (12)', () => {
    settingsStore.setFontSize(10);
    expect(settingsStore.preferences.fontSize).toBe(12);
  });

  it('should not set font size above maximum (32)', () => {
    settingsStore.setFontSize(40);
    expect(settingsStore.preferences.fontSize).toBe(32);
  });

  it('should set font size to minimum value (12)', () => {
    settingsStore.setFontSize(12);
    expect(settingsStore.preferences.fontSize).toBe(12);
  });

  it('should set font size to maximum value (32)', () => {
    settingsStore.setFontSize(32);
    expect(settingsStore.preferences.fontSize).toBe(32);
  });

  it('should clamp negative values to minimum', () => {
    settingsStore.setFontSize(-5);
    expect(settingsStore.preferences.fontSize).toBe(12);
  });
});
```

### 5. Test SetFontFamily Function
```typescript
describe('setFontFamily', () => {
  it('should set font family to georgia', () => {
    settingsStore.setFontFamily('georgia');
    expect(settingsStore.preferences.fontFamily).toBe('georgia');
  });

  it('should set font family to campote', () => {
    settingsStore.setFontFamily('campote');
    expect(settingsStore.preferences.fontFamily).toBe('campote');
  });

  it('should set font family to arial', () => {
    settingsStore.setFontFamily('arial');
    expect(settingsStore.preferences.fontFamily).toBe('arial');
  });

  it('should set font family to verdana', () => {
    settingsStore.setFontFamily('verdana');
    expect(settingsStore.preferences.fontFamily).toBe('verdana');
  });
});
```

### 6. Test SetLineHeight Function
```typescript
describe('setLineHeight', () => {
  it('should set line height', () => {
    settingsStore.setLineHeight(2.0);
    expect(settingsStore.preferences.lineHeight).toBe(2.0);
  });

  it('should set line height to decimal value', () => {
    settingsStore.setLineHeight(1.5);
    expect(settingsStore.preferences.lineHeight).toBe(1.5);
  });
});
```

### 7. Test SetPadding Function
```typescript
describe('setPadding', () => {
  it('should set padding', () => {
    settingsStore.setPadding(40);
    expect(settingsStore.preferences.padding).toBe(40);
  });

  it('should set padding to zero', () => {
    settingsStore.setPadding(0);
    expect(settingsStore.preferences.padding).toBe(0);
  });
});
```

### 8. Test ToggleWideMode Function
```typescript
describe('toggleWideMode', () => {
  it('should toggle from false to true', () => {
    settingsStore.preferences.wideMode = false;
    settingsStore.toggleWideMode();
    expect(settingsStore.preferences.wideMode).toBe(true);
  });

  it('should toggle from true to false', () => {
    settingsStore.preferences.wideMode = true;
    settingsStore.toggleWideMode();
    expect(settingsStore.preferences.wideMode).toBe(false);
  });

  it('should toggle multiple times correctly', () => {
    settingsStore.preferences.wideMode = false;
    settingsStore.toggleWideMode();
    expect(settingsStore.preferences.wideMode).toBe(true);
    settingsStore.toggleWideMode();
    expect(settingsStore.preferences.wideMode).toBe(false);
    settingsStore.toggleWideMode();
    expect(settingsStore.preferences.wideMode).toBe(true);
  });
});
```

### 9. Test Reset Function
```typescript
describe('reset', () => {
  beforeEach(() => {
    // Set non-default values
    settingsStore.setTheme('dark');
    settingsStore.setFontSize(24);
    settingsStore.setFontFamily('arial');
    settingsStore.setLineHeight(2.0);
    settingsStore.setPadding(40);
    settingsStore.preferences.wideMode = true;
  });

  it('should reset theme to default', () => {
    settingsStore.reset();
    expect(settingsStore.preferences.theme).toBe('light');
  });

  it('should reset fontSize to default', () => {
    settingsStore.reset();
    expect(settingsStore.preferences.fontSize).toBe(18);
  });

  it('should reset fontFamily to default', () => {
    settingsStore.reset();
    expect(settingsStore.preferences.fontFamily).toBe('georgia');
  });

  it('should reset lineHeight to default', () => {
    settingsStore.reset();
    expect(settingsStore.preferences.lineHeight).toBe(1.8);
  });

  it('should reset padding to default', () => {
    settingsStore.reset();
    expect(settingsStore.preferences.padding).toBe(32);
  });

  it('should reset wideMode to default', () => {
    settingsStore.reset();
    expect(settingsStore.preferences.wideMode).toBe(false);
  });
});
```

### 10. Test LocalStorage Persistence
```typescript
describe('localStorage persistence', () => {
  it('should persist preferences to localStorage', () => {
    settingsStore.setTheme('dark');
    settingsStore.setFontSize(24);
    
    const stored = JSON.parse(localStorage.getItem('reader-preferences')!);
    expect(stored.theme).toBe('dark');
    expect(stored.fontSize).toBe(24);
  });

  it('should load preferences from localStorage', () => {
    localStorage.setItem('reader-preferences', JSON.stringify({
      theme: 'sepia',
      fontSize: 20,
      fontFamily: 'arial',
      lineHeight: 2.0,
      padding: 40,
      wideMode: true,
    }));
    
    // Create new store instance to test loading
    const newStore = useSettingsStore();
    
    expect(newStore.preferences.theme).toBe('sepia');
    expect(newStore.preferences.fontSize).toBe(20);
    expect(newStore.preferences.fontFamily).toBe('arial');
    expect(newStore.preferences.lineHeight).toBe(2.0);
    expect(newStore.preferences.padding).toBe(40);
    expect(newStore.preferences.wideMode).toBe(true);
  });

  it('should update localStorage when preferences change', () => {
    settingsStore.setTheme('warm');
    expect(localStorage.getItem('reader-preferences')).toContain('"theme":"warm"');
    
    settingsStore.setFontSize(22);
    expect(localStorage.getItem('reader-preferences')).toContain('"fontSize":22');
  });
});
```

### 11. Test Edge Cases
```typescript
describe('edge cases', () => {
  it('should handle rapid successive changes', () => {
    for (let i = 0; i < 10; i++) {
      settingsStore.setFontSize(12 + i * 2);
    }
    expect(settingsStore.preferences.fontSize).toBe(30);
  });

  it('should handle concurrent modifications', () => {
    settingsStore.setFontSize(20);
    settingsStore.setTheme('dark');
    settingsStore.setFontFamily('arial');
    
    expect(settingsStore.preferences.fontSize).toBe(20);
    expect(settingsStore.preferences.theme).toBe('dark');
    expect(settingsStore.preferences.fontFamily).toBe('arial');
  });

  it('should handle invalid localStorage data gracefully', () => {
    localStorage.setItem('reader-preferences', 'invalid json');
    
    const newStore = useSettingsStore();
    expect(newStore.preferences.fontSize).toBe(18); // Should fall back to default
  });

  it('should handle missing localStorage data gracefully', () => {
    localStorage.clear();
    
    const newStore = useSettingsStore();
    expect(newStore.preferences.theme).toBe('light');
    expect(newStore.preferences.fontSize).toBe(18);
  });
});
```

## Expected Outcomes
- Full test coverage for settings store
- Font size constraints validated
- localStorage persistence verified
- Reset functionality confirmed
- Coverage > 90% for settings.ts

## Dependencies
- Must complete "Missing Test Framework and Testing Infrastructure" issue first
