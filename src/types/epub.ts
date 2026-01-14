export interface BookMetadata {
  id: string;
  title: string;
  author: string;
  coverImage?: string;
  description?: string;
  publisher?: string;
  publishedAt?: string;
  language?: string;
  addedAt: Date;
  lastReadAt: Date;
  progress: number;
  currentChapter: number;
}

export interface Chapter {
  id: string;
  href: string;
  title: string;
  level: number;
  content?: string;
}

export interface TocItem extends Chapter {
  children?: TocItem[];
}

export interface ReadingProgress {
  bookId: string;
  cfi: string;
  scrollPosition: number;
  chapterIndex: number;
  percentage: number;
  timestamp: Date;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'sepia' | 'warm';
  fontSize: number;
  fontFamily: 'georgia' | 'campote' | 'arial' | 'verdana';
  lineHeight: number;
  padding: number;
  wideMode: boolean;
}

export interface SearchResult {
  chapterIndex: number;
  chapterTitle: string;
  excerpt: string;
  cfi: string;
  searchText: string;
  matchedText: string;
  matchIndex: number;
}

export interface SearchHighlight {
  chapterIndex: number;
  searchText: string;
  matchIndex?: number;
}

export type EpubResult<T> = { success: true; data: T } | { success: false; error: Error };

export interface EpubBook {
  metadata: BookMetadata;
  chapters: Chapter[];
  toc: TocItem[];
  coverBlob?: Blob;
}
