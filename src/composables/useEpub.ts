import type { EpubBook, BookMetadata, Chapter, TocItem } from '@/types/epub';

type EpubFactory = (input: ArrayBuffer | string | Blob) => any;

let ePub: EpubFactory | null = null;
let jsZipReady: Promise<void> | null = null;

async function ensureJsZipLoaded(): Promise<void> {
  if (typeof (globalThis as any).JSZip === 'function') {
    return;
  }

  if (!jsZipReady) {
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
  }

  await jsZipReady;
}

function resolveEpubFactory(module: unknown): EpubFactory {
  const candidates: unknown[] = [];

  // Common shapes seen with ESM/CJS/UMD interop in Vite.
  candidates.push(module);
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

  // UMD build: importing executes the script, which attaches ePub to global.
  candidates.push((globalThis as any).ePub);

  const factory = candidates.find(value => typeof value === 'function');
  if (typeof factory === 'function') {
    return factory as EpubFactory;
  }

  const keys = module && typeof module === 'object' ? Object.keys(module as object).join(', ') : '';
  const globalType = typeof (globalThis as any).ePub;
  throw new TypeError(
    `Unable to resolve epubjs factory function. Module keys: ${keys || '(none)'} ` +
      `and typeof module is ${typeof module}. globalThis.ePub is ${globalType}.`,
  );
}

async function getEpub(): Promise<EpubFactory> {
  await ensureJsZipLoaded();

  if (!ePub) {
    const module = await import('epubjs');
    ePub = resolveEpubFactory(module);
  }

  return ePub;
}

export function useEpub() {
  async function loadEpub(file: File, existingBookId?: string): Promise<EpubBook> {
    const ePubFactory = await getEpub();
    const arrayBuffer = await file.arrayBuffer();
    const book = ePubFactory(arrayBuffer);

    await book.ready;

    const metadata = await book.loaded.metadata;
    const navigation = await book.loaded.navigation;
    
    const bookId = existingBookId || await generateBookId(file);
    
    const bookMetadata: BookMetadata = {
      id: bookId,
      title: metadata.title || 'Untitled',
      author: metadata.creator || 'Unknown Author',
      coverImage: undefined,
      description: metadata.description,
      publisher: metadata.publisher,
      publishedAt: metadata.publishedAt,
      language: metadata.language,
      addedAt: new Date(),
      lastReadAt: new Date(),
      progress: 0,
      currentChapter: 0,
    };

    const coverBlob = await loadCover(book);
    const toc = await loadToc(navigation);

    let baseUrl: string | undefined;
    try {
      const rootfile = await book.loaded.rootfile;
      if (rootfile && typeof rootfile === 'object') {
        const rootfileObj = rootfile as Record<string, unknown>;
        const rootPath = (rootfileObj.rootfileUrl || rootfileObj.path || rootfileObj.rootPath) as string | undefined;
        if (rootPath) {
          const lastSlash = rootPath.lastIndexOf('/');
          baseUrl = lastSlash >= 0 ? rootPath.substring(0, lastSlash + 1) : '';
        }
      }
    } catch {
      console.warn('Unable to determine base URL from book packaging');
    }

    const chapters = await loadChapters(book, baseUrl, toc);


    return {
      metadata: bookMetadata,
      chapters,
      toc,
      coverBlob: coverBlob || undefined,
    };
  }

  async function loadCover(book: any): Promise<Blob | null> {
    try {
      const cover = await book.coverUrl();
      if (cover) {
        const response = await fetch(cover);
        return await response.blob();
      }
    } catch (err) {
      console.warn('Failed to load cover image', err);
      return null;
    }
    return null;
  }

  async function loadToc(navigation: any): Promise<TocItem[]> {
    const toc: TocItem[] = [];

    if (navigation.toc) {
      for (const item of navigation.toc) {
        toc.push({
          id: item.id || item.href,
          href: item.href,
          title: item.label,
          level: 0,
          children: [],
        });
      }
    }

    return toc;
  }

  async function loadChapters(book: any, baseUrl: string | undefined, toc: TocItem[]): Promise<Chapter[]> {
    const chapters: Chapter[] = [];

    for (const item of toc) {
      const content = await loadChapterContent(book, baseUrl, item.href, item.title);
      chapters.push({
        id: item.id,
        href: item.href,
        title: item.title,
        level: item.level,
        content,
      });

      if (item.children) {
        for (const child of item.children) {
          const childContent = await loadChapterContent(book, baseUrl, child.href, child.title);
          chapters.push({
            id: child.id || child.href,
            href: child.href,
            title: child.title,
            level: 1,
            content: childContent,
          });
        }
      }
    }

    return chapters;
  }

  async function loadChapterContent(book: any, baseUrl: string | undefined, href: string, title: string): Promise<string> {
    try {
      const archiveZip = (book as any).archive?.zip;

      if (!archiveZip || typeof archiveZip.file !== 'function') {
        console.warn(`Archive zip not available for chapter: ${title} (${href})`);
        return `<p>Unable to load chapter: ${title}</p>`;
      }

      let chapterPath: string;
      if (href.startsWith('http://') || href.startsWith('https://')) {
        try {
          const parsed = new URL(href);
          chapterPath = parsed.pathname;
        } catch {
          chapterPath = href;
        }
      } else if (baseUrl) {
        try {
          chapterPath = new URL(href, baseUrl).pathname;
        } catch {
          chapterPath = href;
        }
      } else {
        chapterPath = href;
      }

      chapterPath = chapterPath.replace(/^\//, '');
      chapterPath = decodeURIComponent(chapterPath);

      let zipFile = archiveZip.file(chapterPath);
      
      if (!zipFile) {
        const allFiles = archiveZip.files ? Object.keys(archiveZip.files) : [];
        const matchingFile = allFiles.find(f => f.endsWith(chapterPath) || f.endsWith(`/${chapterPath}`));
        
        if (matchingFile) {
          zipFile = archiveZip.file(matchingFile);
          chapterPath = matchingFile;
        }
      }

      if (!zipFile) {
        console.warn(`Chapter file not found in archive: ${title} (${chapterPath})`);
        return `<p>Unable to load chapter: ${title}</p>`;
      }

      const xhtml = await zipFile.async('string');
      if (!xhtml || xhtml.trim() === '') {
        console.warn(`Empty chapter content: ${title} (${chapterPath})`);
        return `<p>Empty chapter: ${title}</p>`;
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(xhtml, 'application/xhtml+xml');

      if (!doc) {
        console.warn(`Failed to parse chapter: ${title} (${chapterPath})`);
        return `<p>Unable to load chapter: ${title}</p>`;
      }

      let body = doc.body;

      if (!body) {
        const docEl = doc.documentElement;
        const debugOuter = docEl?.outerHTML?.substring(0, 200).replace(/\s+/g, ' ');
        console.warn(
          `No body element in chapter: ${title} (${chapterPath}) ` +
          `Document element: ${docEl?.tagName || 'none'}, ` +
          `outerHTML preview: ${debugOuter || '(empty)'}`,
        );

        if (docEl) {
          const bodyCandidates = docEl.getElementsByTagName('body');
          if (bodyCandidates.length > 0) {
            body = bodyCandidates[0];
          } else {
            const nsBody = docEl.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'body');
            if (nsBody.length > 0) {
              body = nsBody[0];
            }
          }
        }

        if (!body) {
          return `<p>Unable to load chapter: ${title}</p>`;
        }
      }

      let innerHTML = body.innerHTML;
      if (!innerHTML || innerHTML.trim() === '') {
        console.warn(`Empty body in chapter: ${title} (${chapterPath})`);
        return `<p>Empty chapter: ${title}</p>`;
      }

      innerHTML = await processImages(innerHTML, archiveZip, baseUrl, chapterPath);

      return innerHTML;
    } catch (err) {
      console.warn(`Failed to load chapter content: ${title} (${href})`, err);
      return `<p>Unable to load chapter: ${title}</p>`;
    }
  }

  async function resolveImagePath(href: string, baseUrl: string | undefined, chapterPath: string): Promise<string> {
    if (href.startsWith('http://') || href.startsWith('https://')) {
      try {
        const parsed = new URL(href);
        return parsed.pathname;
      } catch {
        return href;
      }
    }

    if (href.startsWith('data:')) {
      return href;
    }

    if (href.startsWith('#')) {
      return href;
    }

    try {
      if (baseUrl) {
        const fullUrl = new URL(href, `http://localhost/${baseUrl}`);
        return fullUrl.pathname.substring(1);
      }
    } catch {
      return href;
    }

    const chapterDirEnd = chapterPath.lastIndexOf('/');
    if (chapterDirEnd >= 0) {
      const chapterDir = chapterPath.substring(0, chapterDirEnd + 1);
      try {
        const fullUrl = new URL(href, `http://localhost/${chapterDir}`);
        return fullUrl.pathname.substring(1);
      } catch {
        return chapterDir + href;
      }
    }

    return href;
  }

  async function processImages(html: string, archiveZip: any, baseUrl: string | undefined, chapterPath: string): Promise<string> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const images = doc.querySelectorAll('img');

    if (images.length === 0) {
      return html;
    }

    const imageUrls: Map<string, string> = new Map();

    for (const img of images) {
      const src = img.getAttribute('src');
      if (!src) continue;

      if (imageUrls.has(src)) {
        img.setAttribute('src', imageUrls.get(src)!);
        continue;
      }

      if (src.startsWith('data:')) {
        continue;
      }

      const resolvedPath = await resolveImagePath(src, baseUrl, chapterPath);
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
        const blob = await zipFile.async('blob');
        const blobUrl = URL.createObjectURL(blob);
        imageUrls.set(src, blobUrl);
        img.setAttribute('src', blobUrl);
      } catch (err) {
        console.warn(`Failed to load image: ${normalizedPath}`, err);
      }
    }

    const result = doc.querySelector('div');
    return result ? result.innerHTML : html;
  }

  async function generateBookId(file: File): Promise<string> {
    const timestamp = Date.now();
    const hashBuffer = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `${file.name}-${timestamp}-${hashHex.substring(0, 8)}`;
  }

  return {
    loadEpub,
  };
}

export const epub = useEpub();
