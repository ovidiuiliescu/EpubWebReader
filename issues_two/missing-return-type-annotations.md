# Missing Return Type Annotations

**Severity:** Medium

**Affected Files:**
- `src/App.vue:19,29,35,41,47,51`
- `src/components/BookViewer.vue:38,63,141,168,238,249,253`
- `src/components/ChapterList.vue:12`
- `src/components/Controls.vue:19,23,27`
- `src/components/DropZone.vue:15,20,24,34,41`
- `src/components/HomeScreen.vue:31,41,49,63,74,82,87,94,99,104,111`
- `src/components/LibraryPanel.vue:33,43,48,63,77,82,87,94,99,104,110`
- `src/components/SearchPanel.vue:18,51`
- `src/composables/useTheme.ts:49`
- `src/composables/useSearch.ts:9`
- `src/stores/library.ts:29,45,54,82,109,120,126,132,138,142,155`
- `src/stores/book.ts:22,66,72,78,84,101,107,111`

## Description

Many functions throughout the codebase lack explicit return type annotations. While TypeScript can often infer return types, explicit annotations provide better documentation, help catch refactoring errors, and improve code maintainability.

### Examples:

**src/App.vue:**
```typescript
function handleFileDrop(file: File, shouldCache: boolean = true, existingBookId?: string) {  // Missing : void
  // ...
}

function toggleToc() {  // Missing : void
  // ...
}
```

**src/stores/book.ts:**
```typescript
async function loadBook(file: File, shouldCache: boolean = true, existingBookId?: string): Promise<void> {  // Has return type - good
  // ...
}

function setChapter(index: number) {  // Missing : void
  // ...
}
```

**src/stores/library.ts:**
```typescript
async function init() {  // Missing : Promise<void>
  // ...
}

async function loadBooks() {  // Missing : Promise<void>
  // ...
}
```

## Why This is Problematic

1. **Reduced Code Documentation**: Return types serve as inline documentation. Without them, developers must read the function body to understand what it returns.

2. **Inconsistent Code Style**: Some functions have return types while others don't, making the codebase harder to navigate.

3. **Refactoring Risk**: If a function implementation changes to return a different type, TypeScript won't warn if the return type wasn't explicitly specified.

4. **API Contracts Unclear**: For public functions (like those exported from composables), missing return types make the API unclear.

5. **IDE Support Weaker**: Auto-completion suggestions may be less accurate when return types are inferred rather than explicit.

6. **Catch Logic Errors**: Sometimes functions accidentally return values when they shouldn't (e.g., returning `undefined` instead of nothing). Explicit return types catch these errors.

## Implementation Plan

### Step 1: Add Return Types to Event Handlers in Vue Components

Update all event handler functions to include `: void` return type:

**src/App.vue:**
```typescript
function handleFileDrop(file: File, shouldCache: boolean = true, existingBookId?: string): void {
  // ...
}

function toggleToc(): void {
  // ...
}

function toggleSearch(): void {
  // ...
}

function toggleLibrary(): void {
  // ...
}

function closePanels(): void {
  // ...
}
```

**src/components/ChapterList.vue:**
```typescript
function selectChapter(index: number): void {
  // ...
}
```

**src/components/Controls.vue:**
```typescript
function increaseFontSize(): void {
  settingsStore.setFontSize(settingsStore.preferences.fontSize + 2);
}

function decreaseFontSize(): void {
  settingsStore.setFontSize(settingsStore.preferences.fontSize - 2);
}

function cycleTheme(): void {
  useTheme().cycleTheme();
}
```

**src/components/DropZone.vue:**
```typescript
function handleDragOver(event: DragEvent): void {
  event.preventDefault();
  isDragging.value = true;
}

function handleDragLeave(): void {
  isDragging.value = false;
}

function handleDrop(event: DragEvent): void {
  event.preventDefault();
  isDragging.value = false;
  
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    emit('drop', files[0]);
  }
}

function handleFileSelect(event: Event): void {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    emit('drop', target.files[0]);
  }
}

function openFilePicker(): void {
  fileInput.value?.click();
}
```

### Step 2: Add Return Types to BookViewer Functions

**src/components/BookViewer.vue:**
```typescript
function getFontFamily(font: string): string {
  // ...
}

function handleScroll(): void {
  // ...
}

async function handleLinkClick(event: MouseEvent): Promise<void> {
  // ...
}

function renderCurrentChapter(): void {
  // ...
}

function highlightSearchText(html: string, searchText: string): string {
  // ...
}

function scrollToFirstHighlight(): void {
  // ...
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

### Step 3: Add Return Types to HomeScreen Functions

**src/components/HomeScreen.vue:**
```typescript
async function loadCovers(): Promise<void> {
  // ...
}

async function openBook(metadata: BookMetadata): Promise<void> {
  // ...
}

async function exportBook(metadata: BookMetadata): Promise<void> {
  // ...
}

async function removeBook(id: string): Promise<void> {
  // ...
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

function handleLibraryDragOver(event: DragEvent): void {
  // ...
}

function handleLibraryDragLeave(event: DragEvent): void {
  // ...
}

function handleLibraryDrop(event: DragEvent): void {
  // ...
}

function handleLibraryFileSelect(event: Event): void {
  // ...
}

function openLibraryFilePicker(): void {
  // ...
}
```

**Note**: Also need to fix the `any` types in `openBook` and `exportBook` parameters.

### Step 4: Add Return Types to LibraryPanel Functions

**src/components/LibraryPanel.vue:**
```typescript
async function loadCovers(): Promise<void> {
  // ...
}

function handleDragOver(event: DragEvent): void {
  // ...
}

function handleDragLeave(event: DragEvent): void {
  // ...
}

async function handleDrop(event: DragEvent): Promise<void> {
  // ...
}

async function openBook(metadata: BookMetadata): Promise<void> {
  // ...
}

async function removeBook(id: string): Promise<void> {
  // ...
}

async function handleFileUpload(file: File): Promise<void> {
  // ...
}

function handleFileSelect(event: Event): void {
  // ...
}

function openFilePicker(): void {
  // ...
}

function formatDate(date: Date): string {
  // ...
}
```

### Step 5: Add Return Types to SearchPanel Functions

**src/components/SearchPanel.vue:**
```typescript
async function performSearch(): Promise<void> {
  // ...
}

function goToResult(result: SearchResult): void {
  // ...
}
```

### Step 6: Add Return Types to useTheme Composable

**src/composables/useTheme.ts:**
```typescript
function cycleTheme(): void {
  // ...
}
```

Note: `searchInBook` already has a return type, which is good.

### Step 7: Add Return Types to Store Functions

**src/stores/library.ts:**
```typescript
async function init(): Promise<void> {
  // ...
}

async function loadBooks(): Promise<void> {
  // ...
}

async function cacheBook(
  metadata: BookMetadata,
  epubBlob: Blob,
  coverImage?: Blob
): Promise<void> {
  // ...
}

async function updateReadingProgress(
  bookId: string,
  chapterIndex: number,
  scrollPosition: number,
  percentage: number
): Promise<void> {
  // ...
}

async function getReadingProgress(bookId: string): Promise<{
  chapterIndex: number;
  scrollPosition: number;
  percentage: number;
} | null> {
  // ...
}

async function removeBook(id: string): Promise<void> {
  // ...
}

async function getBookBlob(id: string): Promise<Blob | null> {
  // ...
}

async function getCoverImage(id: string): Promise<Blob | null> {
  // ...
}

async function exportBook(id: string): Promise<Blob | null> {
  // ...
}

async function checkCacheLimit(): Promise<void> {
  // ...
}

async function clearLibrary(): Promise<void> {
  // ...
}
```

**src/stores/book.ts:**
```typescript
// loadBook already has : Promise<void> - good

function setChapter(index: number): void {
  // ...
}

function nextChapter(): void {
  // ...
}

function prevChapter(): void {
  // ...
}

async function updateProgress(session: ReadingProgress): Promise<void> {
  // ...
}

function clearBook(): void {
  // ...
}

function setSearchHighlight(highlight: SearchHighlight | null): void {
  // ...
}

function addChapter(chapter: Chapter): void {
  // ...
}
```

## Priority Order

1. **HIGH**: Add return types to all store functions (library.ts, book.ts) - these are core business logic
2. **MEDIUM**: Add return types to composables (useTheme.ts)
3. **MEDIUM**: Add return types to Vue component event handlers (App.vue, ChapterList.vue, Controls.vue, DropZone.vue)
4. **LOW**: Add return types to helper functions in BookViewer.vue, HomeScreen.vue, LibraryPanel.vue, SearchPanel.vue

## Testing Considerations

After implementing these changes:
- Run TypeScript compiler to verify no type errors are introduced
- Run the application and verify all functionality still works
- Check that async functions properly await their operations
- Verify that event handlers don't accidentally return values
