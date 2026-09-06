# Build Plan

## MVP

- [x] 1. **App shell & minimal theme** — Vite React shell, routing (SPA-safe for GitHub Pages), Excalidraw-minimal MUI theme, base path config
- [x] 2. **Home projects management** — project list/grid (newest first) with create/rename/delete (unique name validation, delete confirm), empty state, localStorage persistence
- [x] 3. **Tree canvas with auto-layout** — centered root node, strict tree auto-layout (SVG + lines), fixed-size circular nodes with char-limited text, pan/drag + wheel/pinch zoom + re-center, persisted viewport
- [x] 4. **Node add & edit interactions** — multiple plus buttons around node (hover on desktop / tap on mobile, large touch targets) to add child + auto-focus inline editor; inline edit with limit enforcement
- [x] 5. **Context menu & branch controls** — right-click / long-press menu for Edit/Delete/Collapse-Expand, subtree delete with confirm (delete count), collapsed badge/indicator, persisted collapsed state with layout reflow
- [x] 6. **PNG export** — client-side export of the map as PNG (whole tree fitted, light background), export button on editor
- [x] 7. **Deploy & polish** — GitHub Pages build config, SPA 404 fallback, lastEdited timestamps, responsive/touch polish, error handling for storage/empty maps, zoom % indicator

## Post-MVP

- [x] 8. **Node text limit 30** — tighten node text from 60 to 30 chars (validation, counter, tests; existing over-limit nodes display as-is until edited)
- [x] 9. **Design polish pass** — lock palette/typography tokens, refine collapse badge and empty-state feel, responsive check; interaction refinements: add badges smaller with larger offset from node and auto-hide on click-out/deselect, collapse badge click toggles expand/collapse, node rename commits on blur (click-out), project rename inline like node instead of dialog box
- [ ] 10. **Tree layout quality pass** — fix misleading placements: (a) root → A[right], B[right], D[right] + B → C[left] makes C read as root child; (b) root → A[right], B[right] + B → C[right] + A → D[bottom] makes D edge cross B edge / sit over C edge; improve subtree separation, edge routing, and parent-proximity so parentage stays readable
- [ ] 11. **PNG export preview** — in-editor preview of whole-tree fitted PNG before download (confirm/download + cancel), light background as today
- [ ] 12. **IndexedDB storage** — migrate persistence to IndexedDB primary with localStorage fallback for environments without it (notably mobile-framework WebViews) plus unavailable warning
- [ ] 13. **Dense text & media nodes** — rectangle nodes for images/video/links and expanded text type (post-circle MVP)
- [ ] 14. **Graph cross-links** — allow arbitrary links between nodes (breaks strict tree)
- [ ] 15. **Undo/redo history** — in-memory stack for add/delete/edit/collapse (noted as deferred)
- [ ] 16. **Home enhancements** — duplicate project, search/filter/sort, JSON import/export
- [ ] 17. **Cloud sync & sharing** — auth + synced storage + shareable links (replaces local-only)
- [ ] 18. **Presentation & a11y polish** — present mode, dark mode, keyboard nav (incl. Select + Del to delete selected node), PDF/print, ads evaluation
- [ ] 19. **Multi-select nodes** — multi-select nodes with bulk actions (delete/collapse/move TBD)
