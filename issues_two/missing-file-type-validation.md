# Missing File Type Validation

## Severity
High

## Affected Files
- `src/App.vue:19-27` (handleFileDrop function)
- `src/components/DropZone.vue:28-31` (handleDrop function)
- `src/components/HomeScreen.vue:28-32` (handleLibraryDrop function)
- `src/components/LibraryPanel.vue:94-102` (handleLibraryDrop function)

## Description
The application relies solely on client-side file extension checks (`.epub` or `.EPUB`) to validate uploaded files. This is insufficient as:

1. **Extension Spoofing**: Attackers can rename malicious files to `.epub`
2. **MIME Type Validation Missing**: No validation of actual file content type
3. **Magic Number Check Missing**: No verification of EPUB file signatures
4. **No File Integrity Check**: No verification that the file is a valid EPUB

```typescript
// Lines 19-27 in App.vue
function handleFileDrop(file: File, shouldCache: boolean = true, existingBookId?: string) {
  if (file.name.endsWith('.epub') || file.name.endsWith('.EPUB')) {
    bookStore.loadBook(file, shouldCache, existingBookId).catch(err => {
      console.error('Failed to load book:', err);
    });
  } else {
    console.warn('Invalid file type:', file.name);
  }
}
```

```typescript
// Lines 28-31 in DropZone.vue
function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
  
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    emit('drop', files[0]); // No validation here
  }
}
```

```vue
<!-- Line 123 in DropZone.vue -->
<input
  ref="fileInput"
  type="file"
  accept=".epub,.EPUB"
  class="hidden"
  @change="handleFileSelect"
/>
```

## Potential Attack Vectors
1. **File Extension Spoofing**: Renaming malicious executables or scripts to `.epub`
   - `malware.exe` → `malware.epub`
   - `script.js` → `script.epub`

2. **EPUB Bombing**: Creating malformed EPUB files that:
   - Trigger Denial of Service via parsing errors
   - Exhaust memory with large payloads
   - Cause infinite loops in XML parsing

3. **Zip Bomb Attacks**: EPUB files are actually ZIP files that can contain:
   - Recursive zip files
   - Files with high compression ratios
   - Millions of small files

4. **Path Traversal**: Malicious file names in EPUB:
   - `../../etc/passwd`
   - `C:\Windows\System32\config\SAM`

5. **XML Injection**: Malformed XML in EPUB structure files
6. **Resource Exhaustion**: Files claiming to have huge sizes

### Example Malicious File Scenarios

**Scenario 1: Executable Disguised as EPUB**
```bash
# Attacker creates a malicious executable
$ malware.exe

# Attacker renames it
$ mv malware.exe book.epub

# User uploads "book.epub"
# Application tries to parse it, potentially executing code if file handler associations exist
```

**Scenario 2: Zip Bomb in EPUB Format**
```python
# Python script to create a zip bomb EPUB
import zipfile
import zlib

# Create an EPUB that expands to 1GB but is only 100KB
with zipfile.ZipFile('bomb.epub', 'w') as zf:
    # 10MB of zeros compresses to ~100KB
    data = b'\x00' * (10 * 1024 * 1024)
    zf.writestr('mimetype', 'application/epub+zip', compress_type=zlib.DEFLATED)
    for i in range(100):
        zf.writestr(f'OEBPS/content{i}.xhtml', data, compress_type=zlib.DEFLATED)
```

**Scenario 3: XML External Entity (XXE) Attack**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<root>
  <content>&xxe;</content>
</root>
```

## Implementation Plan

### Step 1: Create file validation utility
Create `src/utils/fileValidation.ts`:
```typescript
/**
 * EPUB file magic numbers and signatures
 */
const EPUB_MAGIC_NUMBERS: Uint8Array[] = [
  // Standard ZIP magic number (EPUBs are ZIP files)
  new Uint8Array([0x50, 0x4B, 0x03, 0x04]),  // Local file header
  new Uint8Array([0x50, 0x4B, 0x05, 0x06]),  // Central directory (empty archive)
  new Uint8Array([0x50, 0x4B, 0x07, 0x08]),  // Spanned archive
];

/**
 * Allowed MIME types for EPUB files
 */
const ALLOWED_MIME_TYPES = [
  'application/epub+zip',
  'application/octet-stream',
  'application/zip',
  'application/x-zip',
  'application/x-zip-compressed',
];

/**
 * Maximum allowed file size (50MB)
 */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Minimum expected file size for a valid EPUB (1KB)
 */
const MIN_FILE_SIZE = 1024;

/**
 * Maximum number of files allowed in EPUB archive
 */
const MAX_ARCHIVE_FILES = 1000;

/**
 * Maximum total uncompressed size (1GB)
 */
const MAX_UNCOMPRESSED_SIZE = 1024 * 1024 * 1024;

interface FileValidationError extends Error {
  code: string;
  details?: any;
}

/**
 * Validate file type by checking magic numbers
 */
export function validateFileType(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty'
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    };
  }

  // Check file extension
  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.epub')) {
    return {
      valid: false,
      error: 'Invalid file extension. Only .epub files are allowed.'
    };
  }

  // Check MIME type (browsers may not always set this correctly)
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}`
    };
  }

  // Check magic numbers (read first 4 bytes)
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = (e) => {
      if (!e.target?.result) {
        resolve({
          valid: false,
          error: 'Failed to read file'
        });
        return;
      }

      const arr = new Uint8Array(e.target.result as ArrayBuffer);
      const firstFourBytes = arr.slice(0, 4);
      
      const isValidMagic = EPUB_MAGIC_NUMBERS.some(magic => {
        if (firstFourBytes.length !== magic.length) return false;
        for (let i = 0; i < magic.length; i++) {
          if (firstFourBytes[i] !== magic[i]) return false;
        }
        return true;
      });

      if (!isValidMagic) {
        resolve({
          valid: false,
          error: 'Invalid file format. File does not appear to be a valid EPUB.'
        });
        return;
      }

      resolve({ valid: true });
    };

    reader.onerror = () => {
      resolve({
        valid: false,
        error: 'Failed to read file'
      });
    };

    reader.readAsArrayBuffer(file.slice(0, 4));
  });
}

/**
 * Validate EPUB archive contents
 */
export async function validateEpubArchive(
  archiveZip: any,
  maxFiles: number = MAX_ARCHIVE_FILES,
  maxSize: number = MAX_UNCOMPRESSED_SIZE
): Promise<{ valid: boolean; error?: string }> {
  try {
    if (!archiveZip || typeof archiveZip.file !== 'function') {
      return {
        valid: false,
        error: 'Invalid archive structure'
      };
    }

    const files = archiveZip.files;
    const fileNames = Object.keys(files);
    
    // Check file count
    if (fileNames.length > maxFiles) {
      return {
        valid: false,
        error: `Archive contains too many files (${fileNames.length} > ${maxFiles})`
      };
    }

    // Check for required EPUB files
    const hasMimetype = fileNames.some(name => 
      name.toLowerCase() === 'mimetype' || 
      name.toLowerCase().startsWith('mimetype')
    );
    
    // Modern EPUBs might not have mimetype in root, but should have container.xml
    const hasContainer = fileNames.some(name => 
      name.toLowerCase().includes('meta-inf/container.xml')
    );

    if (!hasContainer) {
      return {
        valid: false,
        error: 'Invalid EPUB: missing META-INF/container.xml'
      };
    }

    // Check total uncompressed size
    let totalSize = 0;
    for (const fileName of fileNames) {
      const file = files[fileName];
      if (file && file._data && file._data.uncompressedSize) {
        totalSize += file._data.uncompressedSize;
        if (totalSize > maxSize) {
          return {
            valid: false,
            error: `Total uncompressed size exceeds limit (${(totalSize / 1024 / 1024).toFixed(2)}MB > ${maxSize / 1024 / 1024}MB)`
          };
        }
      }
    }

    // Check for suspicious file names (path traversal)
    for (const fileName of fileNames) {
      if (fileName.includes('..') || 
          fileName.includes('~$') || 
          fileName.startsWith('/') ||
          fileName.includes('\\')) {
        return {
          valid: false,
          error: `Suspicious file name detected: ${fileName}`
        };
      }
    }

    // Check for dangerous file types in archive
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.dll', '.so', '.dylib'];
    for (const fileName of fileNames) {
      const lowerName = fileName.toLowerCase();
      if (dangerousExtensions.some(ext => lowerName.endsWith(ext))) {
        return {
          valid: false,
          error: `Dangerous file type detected in archive: ${fileName}`
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate archive: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Complete EPUB file validation
 */
export async function validateEpubFile(file: File): Promise<{ valid: boolean; error?: string }> {
  // Step 1: Validate file type and magic numbers
  const typeValidation = await validateFileType(file);
  if (!typeValidation.valid) {
    return typeValidation;
  }

  // Step 2: Additional validation can be added here
  // such as parsing the EPUB structure with epubjs

  return { valid: true };
}
```

### Step 2: Update App.vue to use validation
```typescript
import { validateEpubFile } from '@/utils/fileValidation';

async function handleFileDrop(file: File, shouldCache: boolean = true, existingBookId?: string) {
  try {
    const validation = await validateEpubFile(file);
    if (!validation.valid) {
      console.error('Invalid EPUB file:', validation.error);
      // Show error to user
      alert(`Invalid EPUB file: ${validation.error}`);
      return;
    }

    await bookStore.loadBook(file, shouldCache, existingBookId);
  } catch (err) {
    console.error('Failed to load book:', err);
    alert('Failed to load book. Please check the file and try again.');
  }
}
```

### Step 3: Update DropZone.vue
```vue
<script setup lang="ts">
import { validateEpubFile } from '@/utils/fileValidation';

// ... existing code ...

async function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
  
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    const validation = await validateEpubFile(files[0]);
    if (validation.valid) {
      emit('drop', files[0]);
    } else {
      console.error('Invalid file:', validation.error);
      alert(validation.error);
    }
  }
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const validation = await validateEpubFile(target.files[0]);
    if (validation.valid) {
      emit('drop', target.files[0]);
    } else {
      console.error('Invalid file:', validation.error);
      alert(validation.error);
    }
  }
}
</script>
```

### Step 4: Update useEpub.ts to validate archive
```typescript
import { validateEpubArchive } from '@/utils/fileValidation';

// In loadEpub function, after loading the book:
async function loadEpub(file: File, existingBookId?: string): Promise<EpubBook> {
  const ePubFactory = await getEpub();
  const arrayBuffer = await file.arrayBuffer();
  currentBook = ePubFactory(arrayBuffer);

  await currentBook.ready;

  // Validate archive contents
  const archiveZip = (currentBook as any).archive?.zip;
  if (archiveZip) {
    const archiveValidation = await validateEpubArchive(archiveZip);
    if (!archiveValidation.valid) {
      throw new Error(archiveValidation.error);
    }
  }

  // ... rest of the function ...
}
```

### Step 5: Add validation tests
Create `tests/file-validation.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { validateFileType, validateEpubArchive } from '@/utils/fileValidation';

describe('validateFileType', () => {
  it('should reject empty files', () => {
    const file = new File([], 'test.epub');
    expect(validateFileType(file)).resolves.toEqual({
      valid: false,
      error: 'File is empty'
    });
  });

  it('should reject files without .epub extension', () => {
    const file = new File([new Uint8Array([0x50, 0x4B, 0x03, 0x04])], 'test.pdf', {
      type: 'application/pdf'
    });
    expect(validateFileType(file)).resolves.toEqual({
      valid: false,
      error: 'Invalid file extension. Only .epub files are allowed.'
    });
  });

  it('should accept valid EPUB with ZIP magic number', async () => {
    const file = new File(
      [new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00])],
      'test.epub',
      { type: 'application/epub+zip' }
    );
    const result = await validateFileType(file);
    expect(result.valid).toBe(true);
  });

  it('should reject files without correct magic number', async () => {
    const file = new File(
      [new Uint8Array([0x00, 0x00, 0x00, 0x00])],
      'fake.epub',
      { type: 'application/epub+zip' }
    );
    const result = await validateFileType(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid file format');
  });
});

describe('validateEpubArchive', () => {
  it('should reject archives with too many files', async () => {
    const files = {};
    for (let i = 0; i < 2000; i++) {
      files[`file${i}.xhtml`] = { _data: { uncompressedSize: 100 } };
    }
    const zip = { file: () => null, files };
    
    const result = await validateEpubArchive(zip, 1000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too many files');
  });

  it('should reject archives without container.xml', async () => {
    const zip = {
      file: () => null,
      files: {
        'mimetype': { _data: { uncompressedSize: 20 } }
      }
    };
    
    const result = await validateEpubArchive(zip);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('META-INF/container.xml');
  });

  it('should reject archives with path traversal in file names', async () => {
    const zip = {
      file: () => null,
      files: {
        'META-INF/container.xml': { _data: { uncompressedSize: 100 } },
        '../../etc/passwd': { _data: { uncompressedSize: 100 } }
      }
    };
    
    const result = await validateEpubArchive(zip);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Suspicious file name');
  });
});
```

## Additional Recommendations
1. **Virus Scanning**: Integrate with virus scanning services if you add backend processing
2. **File Quarantine**: Isolate uploaded files before processing
3. **Rate Limiting**: Prevent abuse by limiting file upload frequency
4. **User Feedback**: Show detailed error messages to help users understand what went wrong
5. **File Preview**: Generate previews before full processing to catch issues early
6. **Logging**: Log all validation failures for security monitoring

## Related Issues
- See also: `missing-file-size-limits.md` (File size validation)
- See also: `path-traversal-vulnerability.md` (Path traversal protection)
