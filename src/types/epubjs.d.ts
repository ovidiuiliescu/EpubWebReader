declare module 'epubjs' {
  interface Epub {
    (data: ArrayBuffer | string): any;
    ready: Promise<void>;
    loaded: {
      metadata: Promise<any>;
      package: Promise<any>;
      navigation: Promise<{
        toc: Array<{ id?: string; href: string; label: string; children?: any[] }>;
        get: (href: string) => Promise<any>;
      }>;
    };
    coverUrl(): Promise<string | null>;
  }

  const ePub: Epub;
  export default ePub;
}
