# Unbounded Concurrent Image Processing

## Severity
Medium

## Affected Files
- `src/composables/useEpub.ts:493-549`

## Description
The image processing function processes all images in a chapter concurrently without limiting the number of simultaneous operations:

```typescript
async function processImages(html: string, archiveZip: any, baseUrl: string | undefined, chapterPath: string): Promise<string> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const images = doc.querySelectorAll('img');

  if (images.length === 0) {
    return html;
  }

  const imageUrls: Map<string, string> = new Map();

  for (const img of images) {  // Sequential loop but each img is async
    const src = img.getAttribute('src');
    if (!src) continue;

    if (imageUrls.has(src)) {
      img.setAttribute('src', imageUrls.get(src)!);
      continue;
    }

    if (src.startsWith('data:')) {
      continue;
    }

    const resolvedPath = await resolveImagePath(src, baseUrl, chapterPath);  // Async!
    let normalizedPath = resolvedPath.replace(/^\//, '');
    normalizedPath = decodeURIComponent(normalizedPath);

    let zipFile = archiveZip.file(normalizedPath);

    if (!zipFile) {
      const allFiles = archiveZip.files ? Object.keys(archiveZip.files) : [];
      const matchingFile = allFiles.find(f => f.endsWith(normalizedPath) || f.endsWith(`/${normalizedPath}`));

      if (matchingFile) {
        zipFile = archiveZip.file(matchingFile);
      }
    }

    if (!zipFile) {
      console.warn(`Image not found in archive: ${normalizedPath} (from ${src})`);
      continue;
    }

    try {
      const blob = await zipFile.async('blob');  // Creates blob for EACH image
      const blobUrl = URL.createObjectURL(blob);  // Creates URL for EACH image
      imageUrls.set(src, blobUrl);
      img.setAttribute('src', blobUrl);
    } catch (err) {
      console.warn(`Failed to load image: ${normalizedPath}`, err);
    }
  }

  const result = doc.querySelector('div');
  return result ? result.innerHTML : html;
}
```

Issues:
1. For each image, a new Blob is created and stored in memory
2. Each `URL.createObjectURL()` creates a unique URL (leak if not revoked)
3. All images are processed concurrently without any limit
4. Large chapters with 50+ images can overwhelm the browser
5. No error handling or retry logic for failed images
6. No memory management - blobs accumulate

## Impact on User Experience
- High memory usage with image-heavy chapters
- Browser slowdowns or crashes with many images
- Memory leaks from unreleased blob URLs
- Slow chapter loading with many images
- Poor performance on mobile devices
- Out-of-memory errors

## Implementation Plan

### Fix 1: Limit Concurrent Image Processing

```typescript
async function processImages(
  html: string,
  archiveZip: any,
  baseUrl: string | undefined,
  chapterPath: string
): Promise<string> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const images = Array.from(doc.querySelectorAll('img'));

  if (images.length === 0) {
    return html;
  }

  const imageUrls: Map<string, string> = new Map();
  const MAX_CONCURRENT_IMAGES = 4; // Limit concurrent processing
  let processingCount = 0;
  let currentIndex = 0;
  const promises: Promise<void>[] = [];

  const processImage = async (img: HTMLImageElement): Promise<void> => {
    const src = img.getAttribute('src');
    if (!src) return;

    if (imageUrls.has(src)) {
      img.setAttribute('src', imageUrls.get(src)!);
      return;
    }

    if (src.startsWith('data:')) {
      return;
    }

    try {
      const resolvedPath = await resolveImagePath(src, baseUrl, chapterPath);
      let normalizedPath = resolvedPath.replace(/^\//, '');
      normalizedPath = decodeURIComponent(normalizedPath);

      let zipFile = archiveZip.file(normalizedPath);

      if (!zipFile) {
        const allFiles = archiveZip.files ? Object.keys(archiveZip.files) : [];
        const matchingFile = allFiles.find(f =>
          f.endsWith(normalizedPath) || f.endsWith(`/${normalizedPath}`)
        );

        if (matchingFile) {
          zipFile = archiveZip.file(matchingFile);
        }
      }

      if (!zipFile) {
        console.warn(`Image not found in archive: ${normalizedPath} (from ${src})`);
        return;
      }

      const blob = await zipFile.async('blob');
      const blobUrl = URL.createObjectURL(blob);
      imageUrls.set(src, blobUrl);
      img.setAttribute('src', blobUrl);
    } catch (err) {
      console.warn(`Failed to load image: ${src}`, err);
    }
  };

  // Process images in batches
  while (currentIndex < images.length) {
    while (processingCount < MAX_CONCURRENT_IMAGES && currentIndex < images.length) {
      const promise = processImage(images[currentIndex]).finally(() => {
        processingCount--;
      });
      promises.push(promise);
      processingCount++;
      currentIndex++;
    }

    await Promise.all(promises.slice(-processingCount));
  }

  await Promise.all(promises);

  const result = doc.querySelector('div');
  return result ? result.innerHTML : html;
}
```

### Fix 2: Revoke Old Blob URLs

```typescript
// Track blob URLs for cleanup
const activeBlobUrls = new Set<string>();

async function processImages(
  html: string,
  archiveZip: any,
  baseUrl: string | undefined,
  chapterPath: string
): Promise<string> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const images = Array.from(doc.querySelectorAll('img'));

  if (images.length === 0) {
    return html;
  }

  const imageUrls: Map<string, string> = new Map();
  const MAX_CONCURRENT_IMAGES = 4;
  const chunks = [];

  for (let i = 0; i < images.length; i += MAX_CONCURRENT_IMAGES) {
    chunks.push(images.slice(i, i + MAX_CONCURRENT_IMAGES));
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (img) => {
      const src = img.getAttribute('src');
      if (!src) return;

      if (imageUrls.has(src)) {
        img.setAttribute('src', imageUrls.get(src)!);
        return;
      }

      if (src.startsWith('data:')) {
        return;
      }

      try {
        const resolvedPath = await resolveImagePath(src, baseUrl, chapterPath);
        let normalizedPath = resolvedPath.replace(/^\//, '');
        normalizedPath = decodeURIComponent(normalizedPath);

        let zipFile = archiveZip.file(normalizedPath);

        if (!zipFile) {
          const allFiles = archiveZip.files ? Object.keys(archiveZip.files) : [];
          const matchingFile = allFiles.find(f =>
            f.endsWith(normalizedPath) || f.endsWith(`/${normalizedPath}`)
          );

          if (matchingFile) {
            zipFile = archiveZip.file(matchingFile);
          }
        }

        if (!zipFile) {
          console.warn(`Image not found in archive: ${normalizedPath} (from ${src})`);
          return;
        }

        // Revoke old URL if exists
        const oldUrl = imageUrls.get(src);
        if (oldUrl) {
          URL.revokeObjectURL(oldUrl);
          activeBlobUrls.delete(oldUrl);
        }

        const blob = await zipFile.async('blob');
        const blobUrl = URL.createObjectURL(blob);
        imageUrls.set(src, blobUrl);
        activeBlobUrls.add(blobUrl);
        img.setAttribute('src', blobUrl);
      } catch (err) {
        console.warn(`Failed to load image: ${src}`, err);
      }
    }));
  }

  const result = doc.querySelector('div');
  return result ? result.innerHTML : html;
}

// Cleanup function
function cleanupOldBlobUrls() {
  // Keep only URLs from current chapter
  const currentUrls = new Set(imageUrls.values());
  const urlsToRevoke = [...activeBlobUrls].filter(url => !currentUrls.has(url));

  urlsToRevoke.forEach(url => {
    URL.revokeObjectURL(url);
    activeBlobUrls.delete(url);
  });
}
```

### Fix 3: Image Size Limiting and Compression

```typescript
const MAX_IMAGE_SIZE = 1024 * 1024; // 1MB max per image
const MAX_TOTAL_IMAGE_MEMORY = 20 * 1024 * 1024; // 20MB total
let currentImageMemory = 0;

async function processImageWithSizeLimit(
  img: HTMLImageElement,
  src: string
): Promise<void> {
  // ... resolve path and get zipFile ...

  const blob = await zipFile.async('blob');

  // Check image size
  if (blob.size > MAX_IMAGE_SIZE) {
    console.warn(`Image too large: ${blob.size} bytes (max ${MAX_IMAGE_SIZE})`);
    return;
  }

  // Check total memory
  if (currentImageMemory + blob.size > MAX_TOTAL_IMAGE_MEMORY) {
    console.warn('Total image memory limit reached, skipping image');
    return;
  }

  const blobUrl = URL.createObjectURL(blob);
  currentImageMemory += blob.size;
  imageUrls.set(src, blobUrl);
  img.setAttribute('src', blobUrl);
}
```

### Fix 4: Lazy Load Images with Intersection Observer

```typescript
function processImagesWithLazyLoading(
  html: string,
  archiveZip: any,
  baseUrl: string | undefined,
  chapterPath: string
): { html: string; cleanup: () => void } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const images = Array.from(doc.querySelectorAll('img'));

  if (images.length === 0) {
    return { html, cleanup: () => {} };
  }

  const imageUrls: Map<string, string> = new Map();
  const activeBlobUrls = new Set<string>();

  // Set data-src for lazy loading
  images.forEach(img => {
    const src = img.getAttribute('src');
    if (src && !src.startsWith('data:')) {
      img.setAttribute('data-src', src);
      img.setAttribute('src', '');  // Remove src for lazy loading
      img.classList.add('lazy-image');
    }
  });

  const result = doc.querySelector('div');
  const processedHtml = result ? result.innerHTML : html;

  // Setup Intersection Observer for lazy loading
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(async (entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const dataSrc = img.getAttribute('data-src');

          if (dataSrc) {
            await loadImage(img, dataSrc);
            img.classList.remove('lazy-image');
            observer.unobserve(img);
          }
        }
      });
    },
    {
      rootMargin: '50px',
    }
  );

  // Cleanup function
  function cleanup() {
    observer.disconnect();
    activeBlobUrls.forEach(url => URL.revokeObjectURL(url));
    activeBlobUrls.clear();
  }

  async function loadImage(img: HTMLImageElement, src: string) {
    if (imageUrls.has(src)) {
      img.setAttribute('src', imageUrls.get(src)!);
      return;
    }

    try {
      const resolvedPath = await resolveImagePath(src, baseUrl, chapterPath);
      // ... resolve zip file and load blob ...

      const blob = await zipFile.async('blob');
      const blobUrl = URL.createObjectURL(blob);
      imageUrls.set(src, blobUrl);
      activeBlobUrls.add(blobUrl);
      img.setAttribute('src', blobUrl);
    } catch (err) {
      console.warn(`Failed to load image: ${src}`, err);
    }
  }

  return {
    html: processedHtml,
    cleanup,
  };
}
```

Usage:
```typescript
let currentCleanup: (() => void) | null = null;

function renderCurrentChapter() {
  if (currentCleanup) {
    currentCleanup();
  }

  const chapter = bookStore.chapters[bookStore.currentChapter];
  if (!chapter) {
    articleRef.value!.innerHTML = '<p>No chapter content available.</p>';
    return;
  }

  const { html, cleanup } = processImagesWithLazyLoading(
    chapter.content || '',
    currentBook?.archive?.zip,
    currentBaseUrl,
    chapter.href
  );

  articleRef.value!.innerHTML = html;
  currentCleanup = cleanup;

  // ... rest of rendering logic
}

onUnmounted(() => {
  if (currentCleanup) {
    currentCleanup();
  }
});
```

### Fix 5: Use WebP Format if Supported

```typescript
async function convertToWebP(blob: Blob): Promise<Blob> {
  // Check browser support
  const canvas = document.createElement('canvas');
  if (!canvas.toDataURL('image/webp').startsWith('data:image/webp')) {
    return blob; // No WebP support
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);

      canvas.toBlob(
        (webpBlob) => {
          URL.revokeObjectURL(url);
          resolve(webpBlob || blob);
        },
        'image/webp',
        0.85 // Quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to convert image to WebP'));
    };

    img.src = url;
  });
}
```

## Additional Optimizations
1. Implement image caching across chapters
2. Add loading placeholders for images
3. Use progressive JPEG encoding
4. Implement image deduplication
5. Add error handling with retry logic
6. Use Service Worker to cache images
7. Implement image compression before storing
8. Add support for responsive images (srcset)
9. Use blur-up technique for faster perceived loading
10. Monitor memory usage and warn user if high
