# Missing Test Framework and Testing Infrastructure

**Severity:** High  
**Issue Type:** Infrastructure

## Affected Files
- `package.json` - No test dependencies
- `vite.config.ts` - No test configuration
- `src/` - Entire codebase lacks tests

## Description
The project has zero test files and no testing infrastructure configured. The package.json lacks test dependencies like Vitest/Jest, Vue Test Utils, testing-library, or test coverage tools. Without a testing framework, there is no way to verify code correctness, prevent regressions, or ensure code quality.

## Why This Needs Testing
- Production application with no tests has high risk of bugs and regressions
- Complex EPUB parsing logic (useEpub) needs verification
- IndexedDB operations need validation
- User-facing components need validation
- CI/CD pipelines cannot run tests to catch issues before deployment
- AGENTS.md references `npm run test` command but it doesn't exist

## Implementation Plan

### 1. Install Testing Dependencies
```bash
npm install -D vitest @vitest/ui @vue/test-utils @vitejs/plugin-vue jsdom @testing-library/vue happy-dom
```

### 2. Configure Vitest
Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx,vue}'],
      exclude: ['src/**/*.d.ts', 'src/test/**'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
```

### 3. Create Test Setup File
Create `src/test/setup.ts`:
```typescript
import { vi } from 'vitest';
import { config } from '@vue/test-utils';

// Global mocks for browser APIs
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();
global.DOMParser = window.DOMParser;
```

### 4. Update package.json Scripts
Add to `scripts` section:
```json
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest --coverage",
  "test:run": "vitest run"
}
```

### 5. Create Example Test Structure
```
src/
├── test/
│   ├── setup.ts
│   ├── mocks/
│   │   ├── epubjs.mock.ts
│   │   └── idb.mock.ts
│   └── fixtures/
│       └── sample-epub.ts
├── composables/
│   ├── useEpub.ts
│   ├── useEpub.test.ts      <-- ADD
│   ├── useSearch.ts
│   ├── useSearch.test.ts    <-- ADD
│   └── useTheme.ts
│       └── useTheme.test.ts <-- ADD
├── stores/
│   ├── book.ts
│   ├── book.test.ts         <-- ADD
│   ├── library.ts
│   ├── library.test.ts      <-- ADD
│   ├── settings.ts
│   └── settings.test.ts     <-- ADD
└── components/
    ├── BookViewer.vue
    ├── BookViewer.test.vue  <-- ADD
    └── ...
```

### 6. Example First Test (useTheme)
Create `src/composables/useTheme.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTheme } from './useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should provide theme classes for light theme', () => {
    const { themeClasses, themeLabel } = useTheme();
    // Set up store with light theme
    expect(themeClasses.value.bg).toBe('bg-white');
    expect(themeLabel.value).toBe('Light');
  });

  it('should cycle through themes', () => {
    const { cycleTheme } = useTheme();
    // Test theme cycling
  });
});
```

### 7. Create Mocks
Create `src/test/mocks/epubjs.mock.ts`:
```typescript
import { vi } from 'vitest';

export const mockEpub = {
  ready: Promise.resolve(),
  loaded: {
    metadata: Promise.resolve({
      title: 'Test Book',
      creator: 'Test Author',
    }),
    navigation: Promise.resolve({
      toc: [
        { id: '1', href: 'chapter1.xhtml', label: 'Chapter 1' },
      ],
    }),
  },
  coverUrl: vi.fn(() => Promise.resolve('blob:cover')),
};
```

## Expected Outcomes
- `npm run test` runs all tests
- `npm run test:coverage` generates coverage reports
- Test coverage baseline established
- CI/CD can run tests on PRs
- Developers can write tests with proper tooling

## Dependencies
None (infrastructure task)
