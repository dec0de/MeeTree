# Changelog

All notable changes to MeeTree are documented in this file.

## 1.0.1 - 2026-06-20

### Fixed

- Make the navigation icon explicitly white for Nextcloud's sidebar.
- Make final tree branch connectors render as clearer L-shaped elbows.

## 1.0.0 - 2026-06-20

### Changed

- Replace the app navigation icon with a background-free monochrome tree-note mark.

## 0.1.13 - 2026-06-20

### Added

- Add a draggable divider between the tree and editor panes, with per-browser width persistence.

## 0.1.12 - 2026-06-20

### Fixed

- Detect failed autosaves instead of showing Saved after an unsuccessful response.
- Warn before browser refresh while edits are still dirty or saving.

## 0.1.11 - 2026-06-20

### Fixed

- Prefer the newest imported MeeTree document on reload when no explicit active document has been remembered yet.
- Hide MeeTree's internal state file from the file browser.

## 0.1.10 - 2026-06-20

### Fixed

- Remember the active MeeTree document and reload it after browser refresh or app restart.

## 0.1.9 - 2026-06-20

### Fixed

- Recognize JSON files that store a list of nodes and show all entries instead of wrapping the list as one node.
- Handle HJT files whose top-level depth starts above zero.

## 0.1.8 - 2026-06-20

### Fixed

- Preserve all top-level HJT nodes instead of replacing earlier branches with the last top-level node.

## 0.1.7 - 2026-06-20

### Fixed

- Keep the root tree branch expanded so collapsing it cannot hide all real notes.

## 0.1.6 - 2026-06-20

### Changed

- Make the search input span the search panel and lay search options out horizontally.

## 0.1.5 - 2026-06-20

### Changed

- Simplify the sidebar into separate Open and Export controls with compact tree actions.
- Use normal-weight tree labels and stronger tree connector lines.

## 0.1.4 - 2026-06-20

### Changed

- Render the Nextcloud file browser with ordinary list rows instead of button elements.

## 0.1.3 - 2026-06-20

### Changed

- Restyle the Nextcloud file browser as a familiar file list with icons, names, and format metadata.

## 0.1.2 - 2026-06-20

### Fixed

- Prevent the Nextcloud file browser from crashing when folders contain unsupported file types.

## 0.1.1 - 2026-06-20

### Fixed

- Use the full Nextcloud page width for the MeeTree editor.
- Route the Nextcloud file browser through the document endpoint to avoid 404s on newly added routes.
- Show clearer file-browser loading and error feedback.

## 0.1.0 - 2026-06-20

### Added

- Initial Nextcloud app scaffold for MeeTree.
- Native MeeTree JSON working document format.
- TreePad Lite HJT import and export.
- First-pass CherryTree CTD import and export.
- Standalone browser preview for UI and format testing.
- Tree editing with add, delete, sort, drag-and-drop, expand, and collapse.
- Debounced autosave with visible save status.
- Search panel with title/content, case-sensitive, and regex options.
