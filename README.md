<div align="center">

  # 📚 EpubWebReader

  **A beautiful, fully-featured EPUB reader built for the web**

  [![GitHub Pages](https://img.shields.io/badge/GitHub-Pages-121013?style=flat&logo=github)](https://ovidiu-ionescu.github.io/EpubWebReader)
  [![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?style=flat&logo=vue.js)](https://vuejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat&logo=tailwindcss)](https://tailwindcss.com/)

  [Live Demo](https://ovidiu-ionescu.github.io/EpubWebReader) · [Report Bug](https://github.com/ovidiu-ionescu/EpubWebReader/issues)

</div>

---

## ✨ Vibecoded with AI

This project is proudly **vibecoded** - primarily built using modern AI coding assistants:

- **[opencode](https://opencode.ai)** - Main development agent handling architecture, implementation, and refinement
- **[MinMax M2.1](https://minimax.ai)** - Contributing to feature design and implementation
- **[GLM 4.7](https://glm.ai)** - Assisting with code generation and optimization

The combination of these AI agents enables rapid, high-quality development while maintaining clean, maintainable code.

---

## 🎯 Features

### Core Functionality
- **Drag & Drop Upload** - Drop EPUB files directly into the reader
- **Beautiful Rendering** - Clean typography and layout optimized for reading
- **Chapter Navigation** - Hierarchical table of contents with quick-jump functionality
- **Reading Progress** - Track your progress within chapters and across the entire book
- **Persistent Library** - Cache up to 10 books in IndexedDB with LRU eviction

### Customization
- **4 Reading Themes** - Light, Dark, Sepia, and Warm modes
- **Font Controls** - Adjustable font size (12px-32px) and font family selection
- **Reading Comfort** - Line height and padding adjustments

### Advanced Features
- **Full-Text Search** - Search across all chapters with highlighted results
- **Keyboard Shortcuts** - Navigate and control the reader efficiently
- **Auto-Save Progress** - Reading position and preferences saved automatically
- **Offline Ready** - Works completely offline after initial load

### Accessibility
- WCAG 2.1 AA compliant
- Full keyboard navigation
- Screen reader support
- Reduced motion preferences
- ARIA labels on all interactive elements

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Vue 3** | Reactive UI framework with Composition API |
| **TypeScript** | Type-safe development |
| **Pinia** | State management |
| **Tailwind CSS** | Utility-first styling |
| **epub.js** | EPUB parsing and rendering |
| **IDB** | IndexedDB wrapper for storage |
| **VueUse** | Composition utilities |
| **Vite** | Fast build tool and dev server |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/ovidiu-ionescu/EpubWebReader.git
cd EpubWebReader

# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev

# Open http://localhost:5173
```

### Build

```bash
# Build for production (GitHub Pages)
npm run build

# Build standalone package (works offline with relative paths)
npm run build:standalone
```

### Preview Production Build

```bash
npm run preview
```

---

## ⌨️ Keyboard Shortcuts

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

## 📁 Project Structure

```
EpubWebReader/
├── src/
│   ├── components/       # Vue components
│   ├── composables/      # Reusable composition functions
│   ├── stores/           # Pinia stores
│   ├── types/            # TypeScript definitions
│   └── styles/           # Global styles
├── public/               # Static assets
├── docs/                 # GitHub Pages build output
├── dist/                 # Production build output
├── AGENTS.md            # AI agent development guidelines
└── requirements.md      # Detailed requirements
```

---

## 🌐 Deployment

This project is designed for **static hosting** with zero server requirements:

- **GitHub Pages** - Default deployment target (already configured)
- **Netlify** - Drag and drop the `dist/` folder
- **Vercel** - Connect your GitHub repository
- **Any static host** - Upload the built files

The standalone build (`npm run build:standalone`) creates a completely offline-capable version with relative asset paths.

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the [AGENTS.md](./AGENTS.md) guidelines
4. Run linting and type checking (`npm run lint && npm run typecheck`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

---

## 📝 License

This project is open source and available under the MIT License.

---

## 🙏 Acknowledgments

- [epub.js](https://github.com/futurepress/epub.js) - Core EPUB parsing library
- [Vue.js](https://vuejs.org/) - The progressive JavaScript framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- All AI tools that made this project possible

---

<div align="center">

  Made with ❤️ using AI

  [⬆ Back to Top](#-epubwebreader)

</div>
