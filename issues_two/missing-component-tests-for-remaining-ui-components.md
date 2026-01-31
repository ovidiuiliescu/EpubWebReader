# Missing Component Tests for Remaining UI Components

**Severity:** Medium  
**Issue Type:** Missing Component Tests

## Affected Files
- `src/components/ChapterList.vue` (lines 1-61) - Chapter navigation
- `src/components/Controls.vue` (lines 1-204) - UI controls
- `src/components/DropZone.vue` (lines 1-129) - File upload
- `src/components/HomeScreen.vue` (lines 1-342) - Landing page
- `src/components/LibraryPanel.vue` (lines 1-295) - Library UI
- `src/App.vue` (lines 1-139) - Root component

## Description
Six UI components have zero test coverage. These components handle critical user interactions including file uploads, chapter navigation, settings controls, library management, and app routing.

**Untested Features:**

### ChapterList.vue
- Chapter rendering with hierarchy levels (lines 35-51)
- Active chapter highlighting (lines 40-42)
- Chapter selection (lines 12-15)
- Empty state display (lines 55-57)

### Controls.vue
- Font size controls (lines 109-130)
- Theme cycling button (lines 133-147)
- Wide mode toggle (lines 150-158)
- Chapter navigation (lines 43-102)
- Progress bar display (lines 196-201)
- Mobile vs desktop layouts (lines 40-69, 76-102)

### DropZone.vue
- Drag and drop events (lines 15-32)
- File picker (lines 41-43)
- Drag state styling (lines 55-60)
- File validation (lines 24-31)

### HomeScreen.vue
- Library loading (lines 19-29)
- Book grid display (lines 225-326)
- Cover image loading (lines 31-39)
- Book opening (lines 41-47)
- Book removal (lines 63-72)
- Export functionality (lines 49-61)
- Drag and drop (lines 82-102)

### LibraryPanel.vue
- Library list display (lines 205-272)
- Book opening (lines 65-75)
- Book removal (lines 77-82)
- Clear library (lines 276-284)
- File upload (lines 84-102)

### App.vue
- Panel toggle logic (lines 29-45)
- Panel mutual exclusion (lines 30-32, 37-38, 43-44)
- Conditional rendering based on book state (lines 64-79, 82-128)
- Mobile overlay (lines 132-136)

## Why This Needs Testing
- **User interactions**: All direct user interactions happen in these components
- **Event handling**: Multiple event emitters and listeners
- **Conditional rendering**: Complex v-if/v-else logic
- **State synchronization**: Components must sync with stores
- **Accessibility**: ARIA labels and keyboard navigation
- **Responsive design**: Mobile vs desktop behavior
- **File handling**: Drag-drop, file picker validation
- **Error handling**: Edge cases and user feedback

## Implementation Plan

### 1. ChapterList Tests
`src/components/ChapterList.test.vue`:
```typescript
describe('ChapterList', () => {
  it('should render chapter list', () => {
    // Test chapters display
  });

  it('should highlight current chapter', () => {
    // Test active styling
  });

  it('should emit close event on chapter select', () => {
    // Test emit
  });

  it('should display chapter levels correctly', () => {
    // Test nested chapters
  });
});
```

### 2. Controls Tests
`src/components/Controls.test.vue`:
```typescript
describe('Controls', () => {
  it('should increase font size', () => {
    // Test font increase
  });

  it('should decrease font size', () => {
    // Test font decrease
  });

  it('should cycle theme', () => {
    // Test theme toggle
  });

  it('should toggle wide mode', () => {
    // Test wide mode
  });

  it('should navigate to next chapter', () => {
    // Test next button
  });

  it('should navigate to previous chapter', () => {
    // Test prev button
  });

  it('should disable prev button at first chapter', () => {
    // Test disabled state
  });

  it('should disable next button at last chapter', () => {
    // Test disabled state
  });

  it('should show progress bar', () => {
    // Test progress display
  });
});
```

### 3. DropZone Tests
`src/components/DropZone.test.vue`:
```typescript
describe('DropZone', () => {
  it('should emit drop event on file drop', () => {
    // Test drop emit
  });

  it('should show drag state', () => {
    // Test drag styling
  });

  it('should open file picker on click', () => {
    // Test file picker
  });

  it('should validate EPUB file type', () => {
    // Test .epub extension
  });

  it('should reject non-EPUB files', () => {
    // Test file validation
  });

  it('should handle keyboard activation', () => {
    // Test Enter key
  });
});
```

### 4. HomeScreen Tests
`src/components/HomeScreen.test.vue`:
```typescript
describe('HomeScreen', () => {
  it('should load library on mount', () => {
    // Test library init
  });

  it('should display book cards', () => {
    // Test grid display
  });

  it('should show cover images', () => {
    // Test cover loading
  });

  it('should show fallback when no cover', () => {
    // Test missing cover
  });

  it('should open book on click', () => {
    // Test book opening
  });

  it('should export book', () => {
    // Test export functionality
  });

  it('should remove book', () => {
    // Test removal
  });

  it('should handle drag and drop', () => {
    // Test library drop
  });
});
```

### 5. LibraryPanel Tests
`src/components/LibraryPanel.test.vue`:
```typescript
describe('LibraryPanel', () => {
  it('should display book list', () => {
    // Test list rendering
  });

  it('should open book on click', () => {
    // Test book opening
  });

  it('should remove book', () => {
    // Test removal
  });

  it('should clear all books', () => {
    // Test clear library
  });

  it('should handle drag and drop', () => {
    // Test file upload
  });

  it('should format dates correctly', () => {
    // Test date formatting
  });
});
```

### 6. App Component Tests
`src/App.test.vue`:
```typescript
describe('App', () => {
  it('should show home screen when no book', () => {
    // Test conditional rendering
  });

  it('should show loading state', () => {
    // Test loading
  });

  it('should show book viewer when book loaded', () => {
    // Test book display
  });

  it('should toggle TOC panel', () => {
    // Test panel toggle
  });

  it('should toggle search panel', () => {
    // Test panel toggle
  });

  it('should toggle library panel', () => {
    // Test panel toggle
  });

  it('should close other panels when opening one', () => {
    // Test panel mutual exclusion
  });

  it('should show mobile overlay', () => {
    // Test overlay
  });
});
```

## Expected Outcomes
- Full component test coverage for all UI components
- User interactions validated
- Accessibility verified
- Responsive behavior tested
- Coverage > 80% for all components

## Dependencies
- Must complete "Missing Test Framework and Testing Infrastructure" issue first
- Needs store mocks
