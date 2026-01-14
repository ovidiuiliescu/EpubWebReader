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
  async function loadEpub(file: File): Promise<EpubBook> {
    const ePubFactory = await getEpub();
    const arrayBuffer = await file.arrayBuffer();
    const book = ePubFactory(arrayBuffer);

    await book.ready;

    const metadata = await book.loaded.metadata;
    const navigation = await book.loaded.navigation;
    
    const bookId = await generateBookId(file);
    
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
    const chapters = await loadChapters(navigation, toc);

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

  async function loadChapters(navigation: any, toc: TocItem[]): Promise<Chapter[]> {
    const chapters: Chapter[] = [];
    
    for (const item of toc) {
      try {
        const chapterDoc = await navigation.get(item.href);
        const content = chapterDoc?.document?.body?.innerHTML || '';
        
        chapters.push({
          id: item.id,
          href: item.href,
          title: item.title,
          level: item.level,
          content,
        });
      } catch (err) {
        console.warn(`Failed to load chapter: ${item.title}`, err);
        chapters.push({
          id: item.id,
          href: item.href,
          title: item.title,
          level: item.level,
          content: `<p>Unable to load chapter content.</p>`,
        });
      }
      
      if (item.children) {
        for (const child of item.children) {
          try {
            const chapterDoc = await navigation.get(child.href);
            const content = chapterDoc?.document?.body?.innerHTML || '';
            
            chapters.push({
              id: child.id || child.href,
              href: child.href,
              title: child.title,
              level: 1,
              content,
            });
          } catch (err) {
            chapters.push({
              id: child.id || child.href,
              href: child.href,
              title: child.title,
              level: 1,
              content: `<p>Unable to load chapter content.</p>`,
            });
          }
        }
      }
    }
    
    return chapters;
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
