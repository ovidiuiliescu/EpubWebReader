<div align="center">

  # 📚 EpubWebReader

  **A clean, functional EPUB reader for the web - 100% AI-generated**

  [![GitHub Pages](https://img.shields.io/badge/GitHub-Pages-121013?style=flat&logo=github)](https://ovidiuiliescu.github.io/EpubWebReader)
  [![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?style=flat&logo=vue.js)](https://vuejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat&logo=tailwindcss)](https://tailwindcss.com/)

  [Check it out live](https://ovidiuiliescu.github.io/EpubWebReader)

</div>

---

## 💡 The Story

I wanted to build an EPUB reader for the web. No servers, just pure browser magic. So I told an AI what I wanted, and this is what it made. Every single line of code, every bit of documentation, this README included - all prompts, babyyy! No human hands have touched any of it.

---

## 🤖 The AI Team

This project was built by a squad of AI coding agents:

- **[opencode](https://opencode.ai)** - Lead developer. Handled most of the architecture, implementation, and refactoring.
- **[MinMax M2.1](https://minimax.ai)** - Contributed to features and implementation details.
- **[GLM 4.7](https://glm.ai)** - Helped with code generation and optimization.

I just described what I wanted, they made it happen. Pretty wild, right?

---

## 🎯 What It Does

### The Basics
- Drag and drop EPUB files directly into the browser
- Read books with clean, comfortable typography
- Navigate chapters with a table of contents
- Track your reading progress
- Keep a library of up to 10 books (stored locally in your browser)

### Personalization
- 4 reading themes: Light, Dark, Sepia, Warm
- Font size controls (12px - 32px)
- Multiple font families to choose from
- Adjust line height and spacing to your liking

### Nice-to-haves
- Full-text search across all chapters
- Keyboard shortcuts for power users
- Auto-saves your reading position
- Works offline once it's loaded

### It's accessible too
- WCAG 2.1 AA compliant
- Full keyboard navigation
- Screen reader support
- Respectful of reduced motion preferences

---

## 🛠️ What It's Built With

| Tech | Why |
|------|-----|
| Vue 3 | Reactivity, components, composition API |
| TypeScript | Type safety, better DX |
| Pinia | State management |
| Tailwind CSS | Styling without writing CSS |
| epub.js | Parses and renders EPUBs |
| IDB | Wrapper for IndexedDB storage |
| VueUse | Handy composition utilities |
| Vite | Fast dev server and bundler |

---

## 🚀 Running It Yourself

You'll need Node.js 18+.

```bash
# Clone it
git clone https://github.com/ovidiuiliescu/EpubWebReader.git
cd EpubWebReader

# Install dependencies
npm install

# Start dev server
npm run dev
# Open http://localhost:5173

# Build for production
npm run build

# Build standalone version (works offline)
npm run build:standalone
```

---

## ⌨️ Keyboard Shortcuts

| Key | What it does |
|-----|--------------|
| `+` / `=` | Bigger font |
| `-` | Smaller font |
| `T` | Switch themes |
| `Ctrl+F` / `Cmd+F` | Search |
| `Esc` | Close panels |
| `←` | Previous chapter |
| `→` | Next chapter |

---

## 📂 How It's Organized

```
EpubWebReader/
├── src/
│   ├── components/       # Vue components
│   ├── composables/      # Reusable logic
│   ├── stores/           # Pinia stores
│   ├── types/            # TypeScript types
│   └── styles/           # Global styles
├── public/               # Static assets
├── docs/                 # GitHub Pages build
├── dist/                 # Production build
├── AGENTS.md            # Guidelines for AI agents
└── requirements.md      # What I originally asked for
```

---

## 🌐 Deployment

This is meant to be hosted statically - no server needed:

- **GitHub Pages** - Already configured, just push and go
- **Netlify** - Drag the `dist/` folder
- **Vercel** - Connect your repo
- **Any static host** - Upload the files

The `npm run build:standalone` command creates a version that works completely offline with relative paths.

---

## 🤝 Want to Contribute?

Sure! Here's how:

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Run `npm run lint && npm run typecheck`
5. Commit with a clear message
6. Push and open a Pull Request

Check out [AGENTS.md](./AGENTS.md) if you're using AI agents too.

---

## 📝 License

MIT - go wild.

---

## 🙏 Shoutouts

- [epub.js](https://github.com/futurepress/epub.js) - Does all the heavy lifting for EPUB parsing
- [Vue.js](https://vuejs.org/) - Makes building UIs actually fun
- [Tailwind CSS](https://tailwindcss.com/) - CSS that doesn't make you hate yourself
- The AI tools that made this entire project possible

---

<div align="center">

  Made with ❤️ by AI prompts only

  [⬆ Back to top](#-epubwebreader)

</div>
