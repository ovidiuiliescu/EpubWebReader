# Requirements Document

## Project: EpubWebReader

A static, client-side EPUB reader hosted on GitHub Pages. No server required.

---

## 1. Functional Requirements

### 1.1 EPUB Upload
- **FR-001**: Users can drag and drop `.epub` files onto the application
- **FR-002**: Users can click to browse and select EPUB files via file picker
- **FR-003**: Validate file type (only `.epub` files accepted)
- **FR-004**: Display loading indicator during file parsing
- **FR-005**: Show error message for invalid or corrupted EPUB files

### 1.2 Book Rendering
- **FR-006**: Render EPUB content with proper HTML/CSS formatting
- **FR-007**: Support chapter-by-chapter navigation
- **FR-008**: Maintain reading position (scroll position) per book
- **FR-009**: Smooth scrolling within chapter content
- **FR-010**: Handle EPUB spine order correctly

### 1.3 Table of Contents
- **FR-011**: Extract and display hierarchical TOC from EPUB
- **FR-012**: Quick navigation - click chapter to jump directly
- **FR-013**: Show current chapter indicator in TOC
- **FR-014**: Collapsible/expandable TOC sections

### 1.4 Font Customization
- **FR-015**: Adjustable font size (range: 12px to 32px)
- **FR-016**: Font family selection with Kindle-like defaults:
  - **Georgia** (serif, default)
  - **Campote** (serif, warm)
  - **Arial** (sans-serif)
  - **Verdana** (sans-serif)
- **FR-017**: Line height adjustment
- **FR-018**: Padding/margin controls around text

### 1.5 Theme System
- **FR-019**: Light mode (default)
- **FR-020**: Dark mode
- **FR-021**: Sepia theme (cream background, brown text)
- **FR-022**: Warm theme (off-white background, dark gray text)
- **FR-023**: Theme toggle in UI controls

### 1.6 Reading Features
- **FR-024**: Reading progress indicator (percentage)
- **FR-025**: Chapter progress indicator
- **FR-026**: Remember last read position per book
- **FR-027**: Auto-save reading progress to localStorage

### 1.7 Search
- **FR-028**: Full-text search across all chapters
- **FR-029**: Display search results with chapter context
- **FR-030**: Highlight search terms in content
- **FR-031**: Click search result to jump to location

### 1.8 Persistence
- **FR-032**: Store user preferences (font, theme, etc.) in localStorage
- **FR-033**: Cache opened EPUB files in IndexedDB (not localStorage - larger capacity)
- **FR-034**: Library view showing previously opened books
- **FR-035**: Maximum 10 books cached with LRU eviction
- **FR-036**: Maximum EPUB file size: 50MB

---

## 2. Non-Functional Requirements

### 2.1 Performance
- **NFR-001**: Initial load time < 2 seconds
- **NFR-002**: EPUB parsing < 5 seconds for 50MB files
- **NFR-003**: Smooth scrolling at 60fps
- **NFR-004**: Search results < 1 second

### 2.2 Accessibility
- **NFR-005**: WCAG 2.1 AA compliance
- **NFR-006**: Full keyboard navigation
- **NFR-007**: ARIA labels on all interactive elements
- **NFR-008**: Focus indicators visible
- **NFR-009**: Support reduced motion preference
- **NFR-010**: Screen reader compatible

### 2.3 Browser Support
- **NFR-011**: Chrome/Edge (latest 2 versions)
- **NFR-012**: Firefox (latest 2 versions)
- **NFR-013**: Safari (latest 2 versions)

### 2.4 Security
- **NFR-014**: No external network requests (static only)
- **NFR-015**: All dependencies bundled locally
- **NFR-016**: Content Security Policy headers
- **NFR-017**: Sanitize user-uploaded content

### 2.5 Deployment
- **NFR-018**: Hosted on GitHub Pages
- **NFR-019**: No server-side processing
- **NFR-020**: Works offline (PWA optional)

---

## 3. UI Requirements

### 3.1 Layout
- **UR-001**: Left sidebar for TOC (collapsible)
- **UR-002**: Center content area (max-width: 800px for readability)
- **UR-003**: Top toolbar for controls
- **UR-004**: Bottom progress bar

### 3.2 Controls
- **UR-005**: Font size increase/decrease buttons
- **UR-006**: Theme selector dropdown
- **UR-007**: Font family selector
- **UR-008**: Search input
- **UR-009**: Library button
- **UR-010**: Settings panel

### 3.3 Interactions
- **UR-011**: Drag and drop zone overlay
- **UR-012**: Loading states with spinners
- **UR-013**: Error states with recovery options
- **UR-014**: Success confirmations

---

## 4. Data Models

### 4.1 User Preferences
```typescript
interface UserPreferences {
  theme: 'light' | 'dark' | 'sepia' | 'warm';
  fontSize: number; // px
  fontFamily: 'georgia' | 'campote' | 'arial' | 'verdana';
  lineHeight: number; // multiplier
  padding: number; // px
}
```

### 4.2 Book Metadata
```typescript
interface BookMetadata {
  id: string;
  title: string;
  author: string;
  coverImage?: string;
  addedAt: Date;
  lastReadAt: Date;
  progress: number; // 0-100
  currentChapter: number;
}
```

### 4.3 Reading Session
```typescript
interface ReadingSession {
  bookId: string;
  cfi: string; // EPUB CFI location
  scrollPosition: number;
  chapterIndex: number;
  timestamp: Date;
}
```

---

## 5. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `+` / `=` | Increase font size |
| `-` | Decrease font size |
| `T` | Toggle theme |
| `Ctrl+F` / `Cmd+F` | Open search |
| `Esc` | Close panels/modals |
| `←` | Previous chapter |
| `→` | Next chapter |

---

## 6. Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| vue | ^3.4 | UI framework |
| pinia | ^2.1 | State management |
| epub.js | ^0.3 | EPUB parsing/rendering |
| @vueuse/core | ^10.7 | Composition utilities |
| tailwindcss | ^3.4 | Styling |
| idb | ^8.0 | IndexedDB wrapper |

---

## 7. Future Considerations (Out of Scope)

- Bookmarks and highlights
- Notes annotation
- Multiple file format support (PDF, MOBI)
- Cloud sync across devices
- Social sharing
- Reading goals/stats
