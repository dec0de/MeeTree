# Changelog

All notable changes to MeeTree are documented in this file.

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
