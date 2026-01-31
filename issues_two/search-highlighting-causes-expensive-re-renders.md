# Search Highlighting Causes Expensive Re-renders

## Severity
High

## Affected Files
- `src/components/BookViewer.vue:168-236`
- `src/components/BookViewer.vue:252-266`

## Description
The search highlighting functionality triggers expensive full re-renders of chapter content. The `highlightSearchText` function (lines 168-236) performs DOM parsing and creates new DOM elements for every search match. When search highlight changes, the entire chapter HTML is replaced via `articleRef.value.innerHTML = content` (line 156), causing:

1. Full browser layout recalculation
2. Loss of scroll position
3. Destruction of any attached event listeners
4. Reparsing of the entire HTML document

The `watchEffect` (lines 253-257) and `watch` on `searchHighlight` (lines 259-266) trigger this expensive operation unnecessarily.

## Impact on User Experience
- Noticeable UI lag when searching in large chapters
- Janky scrolling during/after search operations
- Lost scroll position when navigating search results
- Potential memory leaks from not properly cleaning up DOM nodes

## Implementation Plan

### Option 1: Use CSS-Based Highlighting (Recommended)
Replace DOM manipulation with CSS-based highlighting using `<mark>` elements and CSS pseudo-elements. Create a single highlight overlay that doesn't require full HTML replacement.

```typescript
// Instead of replacing innerHTML, use CSS-based highlighting
function applySearchHighlights(searchText: string) {
  // Remove existing highlights
  articleRef.value?.querySelectorAll('.search-highlight').forEach(el => {
    const parent = el.parentNode;
    parent?.replaceChild(document.createTextNode(el.textContent || ''), el);
    parent?.normalize();
  });

  if (!searchText.trim()) return;

  // Add new highlights using TreeWalker with minimal DOM changes
  const walker = document.createTreeWalker(
    articleRef.value!,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (node.parentNode?.nodeName === 'SCRIPT' || node.parentNode?.nodeName === 'STYLE') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const nodesToHighlight: Text[] = [];
  let node: Node | null;

  while ((node = walker.nextNode())) {
    if ((node.textContent || '').toLowerCase().includes(searchText.toLowerCase())) {
      nodesToHighlight.push(node as Text);
    }
  }

  const regex = new RegExp(`(${escapeRegex(searchText)})`, 'gi');
  nodesToHighlight.forEach(textNode => {
    const fragment = document.createDocumentFragment();
    const parts = (textNode.textContent || '').split(regex);

    parts.forEach(part => {
      if (regex.test(part)) {
        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        mark.textContent = part;
        fragment.appendChild(mark);
      } else if (part) {
        fragment.appendChild(document.createTextNode(part));
      }
    });

    textNode.parentNode?.replaceChild(fragment, textNode);
  });
}
```

### Option 2: Virtual DOM Highlighting
Use Vue's v-html directive with a computed property that caches highlighted HTML, only regenerating when search query changes.

```typescript
const highlightedContent = computed(() => {
  if (!bookStore.searchHighlight) {
    return currentChapterContent.value;
  }
  return highlightSearchText(currentChapterContent.value, bookStore.searchHighlight.searchText);
});
```

### Option 3: Canvas/Overlay Highlighting
Create an SVG or canvas overlay that highlights text positions without modifying the DOM, preserving all original elements and scroll position.

## Additional Optimizations
1. Debounce the search highlight application to avoid rapid successive updates
2. Only highlight visible portions of content (lazy highlighting)
3. Use `requestAnimationFrame` to batch DOM updates
4. Cache search results to avoid re-parsing the same content
5. Consider using Web Workers for search processing in large documents
