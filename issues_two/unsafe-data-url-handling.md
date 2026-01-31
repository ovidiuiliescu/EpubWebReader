# Unsafe Data URL Handling and Image Processing

## Severity
Medium

## Affected Files
- `src/composables/useEpub.ts:462-464, 513-515, 537-543` (Data URL handling)
- `src/composables/useEpub.ts:538-544` (Image blob creation)
- `src/composables/useEpub.ts:540` (blob: URL creation without validation)

## Description
The application processes data URLs from EPUB files without proper validation of the MIME type and content. This can lead to several security issues including:
1. Execution of non-image data URLs as JavaScript
2. Loading of malicious content through data URLs
3. Memory exhaustion via large data URLs
4. Invalid image types causing application instability

```typescript
// Lines 462-464 in useEpub.ts - resolveImagePath function
if (href.startsWith('data:')) {
  return href; // NO VALIDATION - accepts any data: URL
}

// Lines 513-515 in processImages function
if (src.startsWith('data:')) {
  continue; // Only skips blob creation, but doesn't validate the data URL
}

// Lines 537-543 in processImages function
try {
  const blob = await zipFile.async('blob');
  const blobUrl = URL.createObjectURL(blob); // Creates blob: URL without validation
  imageUrls.set(src, blobUrl);
  img.setAttribute('src', blobUrl);
} catch (err) {
  console.warn(`Failed to load image: ${normalizedPath}`, err);
}
```

## Potential Attack Vectors

### 1. JavaScript Execution via Data URLs
```html
<!-- Malicious EPUB with JavaScript data URL -->
<img src="data:text/javascript,alert('XSS')">
<img src="data:text/html,<script>alert('XSS')</script>">
```

While `img` tags won't execute JavaScript data URLs, other tags might:
```html
<!-- If rendered without sanitization -->
<iframe src="data:text/html,<script>alert('XSS')</script>"></iframe>
<object data="data:text/html,<script>alert('XSS')</script>"></object>
```

### 2. XSS via SVG with Embedded Script
```html
<!-- SVG data URL with embedded JavaScript -->
<img src="data:image/svg+xml,<svg onload='alert(1)'>">
<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' onload='alert(1)%3E%3C/svg%3E">
```

### 3. Data URL Phishing Attacks
```html
<!-- Data URL that mimics legitimate content -->
<img src="data:image/svg+xml,<svg><text x='0' y='20'>Download Now</text><a href='https://evil.com/malware'>Click</a></svg>">
```

### 4. Memory Exhaustion via Large Data URLs
```html
<!-- Large base64 data causing memory issues -->
<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...(huge base64 string)">
```

An attacker could:
- Create images with embedded malicious JavaScript in SVG format
- Use data URLs with invalid MIME types to bypass filters
- Create extremely large data URLs to cause browser crashes

### 5. Data URL with Invalid MIME Types
```html
<!-- Data URLs with unexpected types -->
<img src="data:application/octet-stream;base64,SGVsbG8=">
<img src="data:application/pdf;base64,JVBERi...">
<img src="data:text/plain;base64,U29tZSBkYXRh">
```

### Example Attack Scenario
```html
<!DOCTYPE html>
<html>
<body>
  <h1>Chapter Content</h1>
  
  <!-- Attack 1: SVG with JavaScript -->
  <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cscript%3Ealert%28document.cookie%29%3C/script%3E%3C/svg%3E" 
       alt="Image">
  
  <!-- Attack 2: JavaScript in data URL (if img tag is replaced with other tag) -->
  <iframe src="data:text/html,<script>alert(document.cookie)</script>"></iframe>
  
  <!-- Attack 3: Large data URL (DoS) -->
  <img src="data:image/png;base64,iVBORw0KGgo...[10MB of base64]">
  
  <!-- Attack 4: Invalid MIME type -->
  <img src="data:application/zip;base64,UEsDBBQ..." alt="Disguised">
</body>
</html>
```

## Implementation Plan

### Step 1: Create data URL validation utility
Create `src/utils/dataUrlValidator.ts`:
```typescript
/**
 * Data URL Validation Utility
 * 
 * Validates and sanitizes data URLs from EPUB content
 */

/**
 * Allowed MIME types for data URLs
 */
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/svg',
  'image/bmp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
];

/**
 * Maximum size for data URLs (5MB)
 */
const MAX_DATA_URL_SIZE = 5 * 1024 * 1024;

/**
 * Dangerous data URL MIME types
 */
const BLOCKED_MIME_TYPES = [
  'text/html',
  'text/javascript',
  'application/javascript',
  'application/x-javascript',
  'text/ecmascript',
  'application/ecmascript',
  'application/pdf',
  'application/zip',
  'application/octet-stream',
  'text/plain',
  'text/css', // CSS should be separate, not in data URLs
];

/**
 * Parse data URL
 */
export interface ParsedDataURL {
  mimeType: string;
  charset?: string;
  isBase64: boolean;
  data: string;
}

/**
 * Parse a data URL string
 */
export function parseDataURL(dataUrl: string): ParsedDataURL | null {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return null;
  }

  try {
    const match = dataUrl.match(/^data:([^,]*),(.*)$/s);
    if (!match) {
      return null;
    }

    const [, meta, data] = match;
    
    // Parse metadata
    const [mimeType, ...metaParts] = meta.split(';');
    const isBase64 = metaParts.includes('base64');
    const charset = metaParts.find(p => p.startsWith('charset='))?.split('=')[1];

    return {
      mimeType: mimeType.trim().toLowerCase(),
      charset,
      isBase64,
      data
    };
  } catch (error) {
    console.warn('Failed to parse data URL:', error);
    return null;
  }
}

/**
 * Validate a data URL
 */
export function validateDataURL(dataUrl: string, maxSize: number = MAX_DATA_URL_SIZE): 
  { valid: boolean; error?: string; parsed?: ParsedDataURL } {
  
  const parsed = parseDataURL(dataUrl);
  
  if (!parsed) {
    return {
      valid: false,
      error: 'Invalid data URL format'
    };
  }

  // Check for blocked MIME types
  const blockedType = BLOCKED_MIME_TYPES.find(blocked => 
    parsed.mimeType === blocked || parsed.mimeType.startsWith(blocked + '/')
  );
  
  if (blockedType) {
    return {
      valid: false,
      error: `Blocked MIME type: ${blockedType}`,
      parsed
    };
  }

  // Check MIME type is in allowed list
  const isAllowed = ALLOWED_MIME_TYPES.some(allowed =>
    parsed.mimeType === allowed || parsed.mimeType.startsWith(allowed.replace('/*', '/'))
  );

  if (!isAllowed) {
    return {
      valid: false,
      error: `MIME type not allowed: ${parsed.mimeType}`,
      parsed
    };
  }

  // Special check for SVG - could contain JavaScript
  if (parsed.mimeType.includes('svg')) {
    const svgData = decodeBase64IfNeeded(parsed.data, parsed.isBase64);
    if (svgData) {
      const svgValidation = validateSVGContent(svgData);
      if (!svgValidation.valid) {
        return {
          valid: false,
          error: svgValidation.error,
          parsed
        };
      }
    }
  }

  // Check size
  const estimatedSize = parsed.isBase64 
    ? parsed.data.length * 0.75  // Base64 is ~33% larger
    : parsed.data.length;

  if (estimatedSize > maxSize) {
    return {
      valid: false,
      error: `Data URL too large (${Math.round(estimatedSize / 1024 / 1024)}MB > ${maxSize / 1024 / 1024}MB)`,
      parsed
    };
  }

  return {
    valid: true,
    parsed
  };
}

/**
 * Validate SVG content for dangerous elements
 */
export function validateSVGContent(svgContent: string): 
  { valid: boolean; error?: string } {
  
  // Decode URL encoding if present
  try {
    svgContent = decodeURIComponent(svgContent);
  } catch {
    // Not URL encoded, continue
  }

  // Check for script tags
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  if (scriptRegex.test(svgContent)) {
    return {
      valid: false,
      error: 'SVG contains script elements'
    };
  }

  // Check for event handlers (onload, onclick, etc.)
  const eventHandlerRegex = /\s(on\w+)\s*=/gi;
  if (eventHandlerRegex.test(svgContent)) {
    return {
      valid: false,
      error: 'SVG contains event handlers'
    };
  }

  // Check for javascript: in attributes
  const jsProtocolRegex = /javascript\s*:/gi;
  if (jsProtocolRegex.test(svgContent)) {
    return {
      valid: false,
      error: 'SVG contains javascript: protocol'
    };
  }

  // Check for href with javascript:
  const hrefRegex = /href\s*=\s*["']\s*javascript:/gi;
  if (hrefRegex.test(svgContent)) {
    return {
      valid: false,
      error: 'SVG contains javascript: in href'
    };
  }

  return {
    valid: true
  };
}

/**
 * Decode base64 if needed
 */
function decodeBase64IfNeeded(data: string, isBase64: boolean): string | null {
  if (!isBase64) {
    return data;
  }

  try {
    return atob(data);
  } catch {
    return null;
  }
}

/**
 * Sanitize data URL by removing invalid content
 */
export function sanitizeDataURL(dataUrl: string): string | null {
  const validation = validateDataURL(dataUrl);
  
  if (!validation.valid) {
    console.warn('Invalid data URL:', validation.error);
    return null;
  }

  // For SVG, sanitize the content
  if (validation.parsed?.mimeType.includes('svg')) {
    const svgData = decodeBase64IfNeeded(validation.parsed.data, validation.parsed.isBase64);
    if (svgData) {
      const sanitizedSVG = sanitizeSVG(svgData);
      if (sanitizedSVG) {
        // Rebuild data URL
        const charset = validation.parsed.charset ? `;charset=${validation.parsed.charset}` : '';
        const encoding = validation.parsed.isBase64 ? ';base64' : '';
        const encodedData = validation.parsed.isBase64 ? btoa(sanitizedSVG) : encodeURIComponent(sanitizedSVG);
        return `data:${validation.parsed.mimeType}${charset}${encoding},${encodedData}`;
      }
    }
  }

  return dataUrl;
}

/**
 * Basic SVG sanitization
 */
function sanitizeSVG(svgContent: string): string | null {
  try {
    // Remove script tags
    let sanitized = svgContent.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    
    // Remove event handlers
    sanitized = sanitized.replace(/\s(on\w+)="[^"]*"/gi, '');
    sanitized = sanitized.replace(/\s(on\w+)='[^']*'/gi, '');
    
    // Remove javascript: protocols
    sanitized = sanitized.replace(/href\s*=\s*["']\s*javascript:[^"']*/gi, 'href="#"');
    
    return sanitized;
  } catch {
    return null;
  }
}

/**
 * Convert data URL to Blob with validation
 */
export async function dataURLtoBlob(dataUrl: string): Promise<Blob | null> {
  const validation = validateDataURL(dataUrl);
  
  if (!validation.valid || !validation.parsed) {
    console.warn('Cannot create blob from invalid data URL:', validation.error);
    return null;
  }

  try {
    const { mimeType, data, isBase64 } = validation.parsed;
    
    const byteString = isBase64 
      ? atob(data)
      : decodeURIComponent(data);
    
    const byteArray = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      byteArray[i] = byteString.charCodeAt(i);
    }
    
    return new Blob([byteArray], { type: mimeType });
  } catch (error) {
    console.warn('Failed to convert data URL to blob:', error);
    return null;
  }
}
```

### Step 2: Update resolveImagePath in useEpub.ts
```typescript
import {
  parseDataURL,
  validateDataURL
} from '@/utils/dataUrlValidator';

// ... in resolveImagePath function ...

if (href.startsWith('data:')) {
  // VALIDATE DATA URL
  const validation = validateDataURL(href);
  if (!validation.valid) {
    console.warn('Blocked data URL:', validation.error);
    return '';
  }
  return href;
}
```

### Step 3: Update processImages in useEpub.ts
```typescript
import {
  validateDataURL,
  dataURLtoBlob
} from '@/utils/dataUrlValidator';

// ... in processImages function ...

for (const img of images) {
  const src = img.getAttribute('src');
  if (!src) continue;

  if (imageUrls.has(src)) {
    img.setAttribute('src', imageUrls.get(src)!);
    continue;
  }

  if (src.startsWith('data:')) {
    // VALIDATE DATA URL
    const validation = validateDataURL(src);
    if (!validation.valid) {
      console.warn('Blocked data URL:', validation.error);
      img.removeAttribute('src');
      continue;
    }
    
    // Optional: Convert to blob for better memory management
    // const blob = await dataURLtoBlob(src);
    // if (blob) {
    //   const blobUrl = URL.createObjectURL(blob);
    //   imageUrls.set(src, blobUrl);
    //   img.setAttribute('src', blobUrl);
    // }
    
    continue;
  }

  // ... rest of function ...
}
```

### Step 4: Update blob URL creation with validation
```typescript
// ... in processImages function ...

try {
  const blob = await zipFile.async('blob');
  
  // Validate blob size
  if (blob.size > MAX_DATA_URL_SIZE) {
    console.warn(`Image too large: ${normalizedPath} (${blob.size} bytes)`);
    img.removeAttribute('src');
    continue;
  }
  
  // Validate blob type if available
  if (blob.type) {
    const isAllowed = ALLOWED_MIME_TYPES.some(allowed =>
      blob.type === allowed || blob.type.startsWith(allowed.replace('/*', '/'))
    );
    
    if (!isAllowed) {
      console.warn(`Invalid image type: ${blob.type} in ${normalizedPath}`);
      img.removeAttribute('src');
      continue;
    }
  }
  
  const blobUrl = URL.createObjectURL(blob);
  imageUrls.set(src, blobUrl);
  img.setAttribute('src', blobUrl);
} catch (err) {
  console.warn(`Failed to load image: ${normalizedPath}`, err);
  img.removeAttribute('src');
}
```

### Step 5: Create blob URL management utility
Create `src/utils/blobManager.ts`:
```typescript
/**
 * Blob URL Manager
 * 
 * Manages blob: URL lifecycle to prevent memory leaks
 */

class BlobManager {
  private urls: Map<string, string> = new Map();
  private maxUrls = 1000;
  private maxAge = 3600000; // 1 hour in ms

  /**
   * Create and track a blob URL
   */
  create(blob: Blob, id: string): string {
    // Clean old URLs
    this.clean();

    // Check limit
    if (this.urls.size >= this.maxUrls) {
      // Remove oldest 10% of URLs
      const toRemove = Math.floor(this.maxUrls * 0.1);
      const entries = Array.from(this.urls.entries()).slice(0, toRemove);
      for (const [key, url] of entries) {
        URL.revokeObjectURL(url);
        this.urls.delete(key);
      }
    }

    const url = URL.createObjectURL(blob);
    this.urls.set(id, url);
    return url;
  }

  /**
   * Get existing blob URL
   */
  get(id: string): string | undefined {
    return this.urls.get(id);
  }

  /**
   * Revoke and remove a blob URL
   */
  revoke(id: string): void {
    const url = this.urls.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      this.urls.delete(id);
    }
  }

  /**
   * Revoke all blob URLs
   */
  revokeAll(): void {
    for (const url of this.urls.values()) {
      URL.revokeObjectURL(url);
    }
    this.urls.clear();
  }

  /**
   * Clean old URLs (called periodically)
   */
  private clean(): void {
    // In a real implementation, track timestamps and clean old URLs
    // This is a simplified version
    if (this.urls.size > this.maxUrls * 0.8) {
      const toRemove = Math.floor(this.maxUrls * 0.2);
      const entries = Array.from(this.urls.entries()).slice(0, toRemove);
      for (const [key, url] of entries) {
        URL.revokeObjectURL(url);
        this.urls.delete(key);
      }
    }
  }

  /**
   * Get current count
   */
  getCount(): number {
    return this.urls.size;
  }
}

// Singleton instance
export const blobManager = new BlobManager();

/**
 * Hook for Vue components to auto-revoke blob URLs on unmount
 */
export function useBlobManager() {
  const urls: string[] = [];

  const createUrl = (blob: Blob, id: string): string => {
    const url = blobManager.create(blob, id);
    urls.push(url);
    return url;
  };

  onUnmounted(() => {
    for (const url of urls) {
      blobManager.revoke(url);
    }
  });

  return {
    createUrl,
    revoke: blobManager.revoke.bind(blobManager)
  };
}
```

### Step 6: Add tests
Create `tests/data-url-validator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  parseDataURL,
  validateDataURL,
  validateSVGContent,
  sanitizeDataURL,
  dataURLtoBlob
} from '@/utils/dataUrlValidator';

describe('parseDataURL', () => {
  it('should parse valid data URL', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANS=';
    const result = parseDataURL(dataUrl);
    
    expect(result).not.toBeNull();
    expect(result?.mimeType).toBe('image/png');
    expect(result?.isBase64).toBe(true);
  });

  it('should parse data URL with charset', () => {
    const dataUrl = 'data:text/html;charset=utf-8,<h1>Hello</h1>';
    const result = parseDataURL(dataUrl);
    
    expect(result).not.toBeNull();
    expect(result?.mimeType).toBe('text/html');
    expect(result?.charset).toBe('utf-8');
  });

  it('should return null for invalid data URL', () => {
    const result = parseDataURL('not-a-data-url');
    expect(result).toBeNull();
  });
});

describe('validateDataURL', () => {
  it('should accept valid image data URL', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANS=';
    const result = validateDataURL(dataUrl);
    
    expect(result.valid).toBe(true);
    expect(result.parsed?.mimeType).toBe('image/png');
  });

  it('should reject JavaScript data URL', () => {
    const dataUrl = 'data:text/javascript,alert(1)';
    const result = validateDataURL(dataUrl);
    
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Blocked MIME type');
  });

  it('should reject HTML data URL', () => {
    const dataUrl = 'data:text/html,<h1>Hello</h1>';
    const result = validateDataURL(dataUrl);
    
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Blocked MIME type');
  });

  it('should reject SVG with script', () => {
    const svgData = btoa('<svg><script>alert(1)</script></svg>');
    const dataUrl = `data:image/svg+xml;base64,${svgData}`;
    const result = validateDataURL(dataUrl);
    
    expect(result.valid).toBe(false);
    expect(result.error).toContain('script elements');
  });

  it('should reject oversized data URL', () => {
    const largeData = 'A'.repeat(6 * 1024 * 1024); // 6MB
    const dataUrl = `data:image/png;base64,${btoa(largeData)}`;
    const result = validateDataURL(dataUrl);
    
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too large');
  });
});

describe('validateSVGContent', () => {
  it('should accept safe SVG', () => {
    const svg = '<svg><rect width="100" height="100" /></svg>';
    const result = validateSVGContent(svg);
    
    expect(result.valid).toBe(true);
  });

  it('should reject SVG with script tag', () => {
    const svg = '<svg><script>alert(1)</script></svg>';
    const result = validateSVGContent(svg);
    
    expect(result.valid).toBe(false);
    expect(result.error).toContain('script elements');
  });

  it('should reject SVG with event handler', () => {
    const svg = '<svg onload="alert(1)"><rect /></svg>';
    const result = validateSVGContent(svg);
    
    expect(result.valid).toBe(false);
    expect(result.error).toContain('event handlers');
  });

  it('should reject SVG with javascript: in href', () => {
    const svg = '<svg><a href="javascript:alert(1)">Link</a></svg>';
    const result = validateSVGContent(svg);
    
    expect(result.valid).toBe(false);
    expect(result.error).toContain('javascript:');
  });
});
```

## Additional Recommendations
1. **Memory Management**: Revoke blob URLs when no longer needed
2. **Content Security Policy**: Use strict CSP to block inline scripts
3. **Sanitization Libraries**: Use established libraries like DOMPurify
4. **Size Limits**: Implement strict size limits for data URLs
5. **MIME Type Validation**: Always validate MIME types before using data URLs
6. **User Notifications**: Show warnings when content is blocked

## Related Issues
- See also: `xss-via-unsafe-epub-content-useepub.md` (EPUB content sanitization)
- See also: `path-traversal-vulnerability.md` (Path validation)
- See also: `missing-file-type-validation.md` (File type validation)
