# Weak Typing in JSZip Global Declaration and Module Interop

**Severity:** Medium

**Affected Files:**
- `src/composables/useEpub.ts:9,17-19,49,57`

## Description

The code handles JSZip loading in a complex way with module interop, global assignments, and type assertions that weaken type safety. The pattern of checking and setting `globalThis.JSZip` uses `any` type assertions throughout.

### Specific Issues:

**src/composables/useEpub.ts:**
```typescript
Line 9:   if (typeof (globalThis as any).JSZip === 'function') {
           return;
         }

Lines 14-24:
         jsZipReady = (async () => {
           try {
             const module = await import('jszip');
             const JSZip =
               (module as any).default || (module as any).JSZip || (module as any).jszip || module;
             (globalThis as any).JSZip = JSZip;
           } catch (err) {
             const message = err instanceof Error ? err.message : String(err);
             throw new Error(`Failed to load JSZip dependency: ${message}`);
           }
         })();

Line 49:   candidates.push((globalThis as any).ePub);

Line 57:   const globalType = typeof (globalThis as any).ePub;
```

Additionally, the code tries multiple property names for JSZip exports (`default`, `JSZip`, `jszip`) without proper type guards.

## Why This is Problematic

1. **Unsafe Global Access**: Using `(globalThis as any).JSZip` bypasses TypeScript's type checking for global properties.

2. **Module Interop Complexity**: The fallback chain `(module as any).default || (module as any).JSZip || (module as any).jszip || module` uses multiple `any` assertions and doesn't validate the final result is actually a JSZip constructor.

3. **No Type Guarantee**: After all the fallback logic, there's no guarantee the assigned value is actually usable as JSZip.

4. **Global Pollution**: Assigning to `globalThis` without type declarations means TypeScript doesn't know about the global property.

5. **EpubJS Global Access**: Similar issues with `(globalThis as any).ePub` on lines 49 and 57.

6. **Maintainability**: Future developers may not understand why multiple fallbacks are needed or what the actual shape of the imported module is.

## Implementation Plan

### Step 1: Add Proper Global Type Declarations

Create proper type declarations for the global JSZip property:

```typescript
// src/types/epub.ts or src/types/jszip.d.ts (new file)

/**
 * JSZip constructor/interface
 */
export interface JSZipConstructor {
  new (): JSZip;
  (data: ArrayBuffer | string): JSZip;
  prototype: JSZip;
  support: {
    arraybuffer: boolean;
    uint8array: boolean;
    blob: boolean;
    nodebuffer: boolean;
  };
}

/**
 * JSZip instance
 */
export interface JSZip {
  file(path: string): JSZipFile | null;
  files: Record<string, JSZipFile>;
  loadAsync(data: ArrayBuffer | Blob): Promise<JSZip>;
  generateAsync(options?: unknown): Promise<Blob>;
}
```

```typescript
// src/vite-env.d.ts (or src/types/epub.ts)

import type { JSZipConstructor } from '@/types/epub';

declare global {
  var JSZip: JSZipConstructor | undefined;
  var ePub: EpubFactory | undefined;
}
```

### Step 2: Add Type Guards for JSZip Module Interop

Create type-safe module interop helpers:

```typescript
// src/utils/moduleInterop.ts (new file)

import type { JSZipConstructor } from '@/types/epub';

/**
 * Type guard to check if value is a JSZip constructor
 */
export function isJSZipConstructor(value: unknown): value is JSZipConstructor {
  return (
    typeof value === 'function' &&
    // JSZip constructors have a prototype with specific methods
    value.prototype !== null &&
    typeof value.prototype === 'object' &&
    'file' in value.prototype &&
    typeof value.prototype.file === 'function'
  );
}

/**
 * Safely extract JSZip from a dynamically imported module
 */
export function extractJSZipFromModule(module: unknown): JSZipConstructor {
  if (module === null || typeof module !== 'object') {
    throw new TypeError('JSZip module is not an object');
  }

  const moduleRecord = module as Record<string, unknown>;

  // Try default export first (most common in ESM)
  if (isJSZipConstructor(moduleRecord.default)) {
    return moduleRecord.default;
  }

  // Try named export 'JSZip'
  if (isJSZipConstructor(moduleRecord.JSZip)) {
    return moduleRecord.JSZip;
  }

  // Try lowercase 'jszip'
  if (isJSZipConstructor(moduleRecord.jszip)) {
    return moduleRecord.jszip;
  }

  // Try the module itself
  if (isJSZipConstructor(module)) {
    return module as JSZipConstructor;
  }

  throw new TypeError(
    `Unable to find JSZip constructor in module. Available exports: ${Object.keys(moduleRecord).join(', ')}`
  );
}
```

### Step 3: Update ensureJsZipLoaded Function

Replace the type-unsafe implementation with type-safe version:

```typescript
// src/composables/useEpub.ts
import { extractJSZipFromModule } from '@/utils/moduleInterop';

async function ensureJsZipLoaded(): Promise<void> {
  // Check if JSZip is already available (with proper type guard)
  if (isJSZipConstructor(globalThis.JSZip)) {
    return;
  }

  if (!jsZipReady) {
    jsZipReady = (async () => {
      try {
        const module = await import('jszip');
        const JSZip = extractJSZipFromModule(module);
        globalThis.JSZip = JSZip;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to load JSZip dependency: ${message}`);
      }
    })();
  }

  await jsZipReady;
}
```

### Step 4: Update resolveEpubFactory Function

Apply similar type safety to epub.js loading:

```typescript
// src/utils/moduleInterop.ts (add to existing file)

import type { EpubFactory } from '@/composables/useEpub';

/**
 * Type guard to check if value is an epub factory function
 */
export function isEpubFactory(value: unknown): value is EpubFactory {
  return typeof value === 'function';
}

/**
 * Safely extract epub factory from a dynamically imported module
 */
export function extractEpubFromModule(module: unknown): EpubFactory {
  const candidates: unknown[] = [];

  // Add the module itself
  candidates.push(module);

  // If module is an object, try common export shapes
  if (module && typeof module === 'object') {
    const record = module as Record<string, unknown>;
    candidates.push(record.ePub);
    candidates.push(record.default);

    const defaultValue = record.default;
    if (defaultValue && typeof defaultValue === 'object') {
      const defaultRecord = defaultValue as Record<string, unknown>;
      candidates.push(defaultRecord.ePub);
      candidates.push(defaultRecord.default);
    }
  }

  // Try global epub factory
  candidates.push(globalThis.ePub);

  // Find the first candidate that is a function
  for (const candidate of candidates) {
    if (isEpubFactory(candidate)) {
      return candidate;
    }
  }

  const keys = module && typeof module === 'object' 
    ? Object.keys(module as object).join(', ') 
    : '(none)';
  const globalType = typeof globalThis.ePub;

  throw new TypeError(
    `Unable to resolve epubjs factory function. Module keys: ${keys} ` +
    `and typeof module is ${typeof module}. globalThis.ePub is ${globalType}.`
  );
}
```

Then update the function:

```typescript
// src/composables/useEpub.ts
import { extractEpubFromModule } from '@/utils/moduleInterop';

function resolveEpubFactory(module: unknown): EpubFactory {
  return extractEpubFromModule(module);
}
```

### Step 5: Add Proper EpubFactory Type Definition

Update the type definition in useEpub.ts:

```typescript
// src/composables/useEpub.ts
import type { EpubBookInstance } from '@/types/epub';

// Replace this:
// type EpubFactory = (input: ArrayBuffer | string | Blob) => any;

// With this:
type EpubFactory = (input: ArrayBuffer | string | Blob) => EpubBookInstance;
```

### Step 6: Create EpubBookInstance Type (if not already done)

This should be done as part of the "missing-type-exports-for-epub-archive.md" issue:

```typescript
// src/types/epub.ts

export interface EpubBookInstance {
  ready: Promise<void>;
  loaded: {
    metadata: Promise<Record<string, unknown>>;
    package: Promise<Record<string, unknown>>;
    navigation: Promise<Record<string, unknown>>;
    rootfile?: Promise<Record<string, unknown>>;
  };
  archive?: EpubArchive;
  chapters?: Chapter[];
  coverUrl(): Promise<string | null>;
}
```

### Step 7: Update getEpub Function

The function can be simplified with the new type-safe helper:

```typescript
// src/composables/useEpub.ts

async function getEpub(): Promise<EpubFactory> {
  await ensureJsZipLoaded();

  if (!ePub) {
    const module = await import('epubjs');
    ePub = extractEpubFromModule(module);
  }

  return ePub;
}
```

## Priority Order

1. **HIGH**: Add proper global type declarations for JSZip and ePub
2. **HIGH**: Create type guard utilities in `src/utils/moduleInterop.ts`
3. **HIGH**: Update `ensureJsZipLoaded` to use type-safe helpers
4. **MEDIUM**: Update `resolveEpubFactory` to use type-safe helpers
5. **MEDIUM**: Update `EpubFactory` type definition
6. **LOW**: Add JSDoc comments explaining the module interop complexity

## Testing Considerations

After implementing these changes:
- Verify EPUB files still load correctly
- Test with different module bundler configurations
- Verify the code works in both development and production builds
- Test with different JSZip and epub.js versions (if applicable)
- Run TypeScript compiler to verify no type errors
- Check that global JSZip and ePub are properly typed when accessed
- Test error handling when JSZip or epub.js fail to load
