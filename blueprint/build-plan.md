# Build Plan

## MVP

- [x] 1. **App shell & minimal theme** — Vite React shell, routing (SPA-safe for GitHub Pages), Excalidraw-minimal MUI theme, base path config
- [x] 2. **Home projects management** — project list/grid (newest first) with create/rename/delete (unique name validation, delete confirm), empty state, localStorage persistence
- [x] 3. **Tree canvas with auto-layout** — centered root node, strict tree auto-layout (SVG + lines), fixed-size circular nodes with char-limited text, pan/drag + wheel/pinch zoom + re-center, persisted viewport
- [x] 4. **Node add & edit interactions** — multiple plus buttons around node (hover on desktop / tap on mobile, large touch targets) to add child + auto-focus inline editor; inline edit with limit enforcement
- [ ] 5. **Context menu & branch controls** — right-click / long-press menu for Edit/Delete/Collapse-Expand, subtree delete with confirm (delete count), collapsed badge/indicator, persisted collapsed state with layout reflow
- [ ] 6. **PNG export** — client-side export of the map as PNG (whole tree fitted, light background), export button on editor
- [ ] 7. **Deploy & polish** — GitHub Pages build config, SPA 404 fallback, lastEdited timestamps, responsive/touch polish, error handling for storage/empty maps, zoom % indicator

## Post-MVP

- [ ] 8. **Dense text & media nodes** — rectangle nodes for images/video/links and expanded text type (post-circle MVP)
- [ ] 9. **Graph cross-links** — allow arbitrary links between nodes (breaks strict tree)
- [ ] 10. **Undo/redo history** — in-memory stack for add/delete/edit/collapse (noted as deferred)
- [ ] 11. **Home enhancements** — duplicate project, search/filter/sort, JSON import/export
- [ ] 12. **Cloud sync & sharing** — auth + synced storage + shareable links (replaces local-only)
- [ ] 13. **Presentation & a11y polish** — present mode, dark mode, keyboard nav, PDF/print, ads evaluation
