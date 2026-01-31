# Weak External Library Type Definitions

**Severity:** High

**Affected Files:**
- `src/vite-env.d.ts:5`
- `src/types/epubjs.d.ts:3,6-7,9-10`

## Description

The type definitions for Vue components and the epub.js library use the `any` type extensively, defeating the purpose of TypeScript's type checking system.

### Specific Issues:

**src/vite-env.d.ts (line 5):**
```typescript
const component: DefineComponent<{}, {}, any>;
```

**src/types/epubjs.d.ts (lines 3, 6-7, 9-10):**
```typescript
interface Epub {
  (data: ArrayBuffer | string): any;  // Line 3
  loaded: {
    metadata: Promise<any>;            // Line 6
    package: Promise<any>;             // Line 7
    navigation: Promise<{              // Line 8
      toc: Array<{ id?: string; href: string; label: string; children?: any[] }>;  // Line 9
      get: (href: string) => Promise<any>;  // Line 10
    }>;
  };
  coverUrl(): Promise<string | null>;
}
```

## Why This is Problematic

1. **Lost Type Safety**: Using `any` disables TypeScript's type checking for these values, allowing potentially incorrect operations to compile without error.

2. **Runtime Errors**: Properties accessed on these `any` types that don't exist will fail at runtime instead of being caught during development.

3. **Poor IDE Support**: Auto-completion and IntelliSense won't work properly because TypeScript doesn't know what properties exist.

4. **Maintenance Issues**: When library APIs change, TypeScript won't warn about breaking changes in the type definition.

5. **No Compile-Time Validation**: Mistyped property names or incorrect function calls will go unnoticed until runtime.

## Implementation Plan

### Step 1: Improve Vue Component Type Definition
Replace `any` with proper prop types in `src/vite-env.d.ts`:

```typescript
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  export default component;
}
```

### Step 2: Create Proper EpubJS Types
Create comprehensive types for the epub.js library in `src/types/epubjs.d.ts`:

```typescript
declare module 'epubjs' {
  interface EpubMetadata {
    title?: string;
    creator?: string;
    description?: string;
    publisher?: string;
    publishedAt?: string;
    language?: string;
  }

  interface EpubPackage {
    rootfile?: {
      rootfileUrl?: string;
      path?: string;
      rootPath?: string;
    };
  }

  interface NavigationItem {
    id?: string;
    href: string;
    label: string;
    children?: NavigationItem[];
  }

  interface EpubNavigation {
    toc: NavigationItem[];
    get?(href: string): Promise<unknown>;
  }

  interface EpubArchive {
    zip?: {
      file(path: string): ZipFile | null;
      files: Record<string, unknown>;
    };
  }

  interface ZipFile {
    async(type: 'string' | 'blob' | 'arraybuffer'): Promise<string | Blob | ArrayBuffer>;
  }

  interface EpubLoaded {
    metadata: Promise<EpubMetadata>;
    package: Promise<EpubPackage>;
    navigation: Promise<EpubNavigation>;
  }

  interface Epub {
    (data: ArrayBuffer | string): EpubInstance;
    ready: Promise<void>;
    loaded: EpubLoaded;
    archive?: EpubArchive;
    coverUrl(): Promise<string | null>;
  }

  interface EpubInstance {
    ready: Promise<void>;
    loaded: EpubLoaded;
    archive?: EpubArchive;
    coverUrl(): Promise<string | null>;
  }

  const ePub: Epub;
  export default ePub;
}
```

### Step 3: Update useEpub.ts
Update `src/composables/useEpub.ts` to use the new types:

- Replace `any` types with proper interfaces
- Create type guards for runtime type checking
- Use proper type assertions with `as` only when necessary and well-documented

### Step 4: Add Validation
Add runtime validation when dealing with external library outputs to ensure type safety:

```typescript
function isEpubMetadata(value: unknown): value is EpubMetadata {
  return (
    value !== null &&
    typeof value === 'object' &&
    ('title' in value || 'creator' in value)
  );
}
```

## Priority Order

1. First, update `src/types/epubjs.d.ts` with proper interfaces (Critical - this affects all epub.js usage)
2. Update `src/vite-env.d.ts` to use more specific types
3. Update `src/composables/useEpub.ts` to use the new types
4. Test the application to ensure no breaking changes

## Testing Considerations

After implementing these changes:
- Verify all epub.js operations still work correctly
- Check for any missing properties that were previously implicit
- Ensure auto-completion works in IDE when working with epub.js objects
- Run the TypeScript compiler to verify no type errors are introduced
