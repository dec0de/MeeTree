# Changelog

All notable changes to MeeTree are documented in this file.

## 1.1.16 - 2026-06-24

### Fixed

- Restore app navigation startup by removing the new Markdown parser from the initial Nextcloud page load.
- Restore the app icon source SVG to a dark foreground for reliable Nextcloud icon processing.

## 1.1.15 - 2026-06-24

### Fixed

- Restore reliable app startup by falling back safely if the Markdown renderer script is unavailable.
- Reorder app metadata to match the Nextcloud appinfo schema.

## 1.1.14 - 2026-06-24

### Changed

- Use the shared TreeMarkdown renderer based on markdown-it so Markdown preview matches Nextcloud `.md` rendering more closely.
- Align Markdown preview styling with NxTree for compatible tree content display.

## 1.1.13 - 2026-06-23

### Added

- Add an App Store screenshot to the app metadata.

## 1.1.12 - 2026-06-23

### Fixed

- Restore Markdown preview line-break behavior and preserve repeated blank lines as visible spacing.

## 1.1.11 - 2026-06-23

### Added

- Add a local helper script for generating Nextcloud App Store registration and release signatures.
- Document the Nextcloud App Store registration and release upload flow.

## 1.1.10 - 2026-06-23

### Added

- Attach an App Store archive signature file to tagged GitHub releases when `MEETREE_SIGNING_KEY` is configured.

## 1.1.9 - 2026-06-23

### Added

- Add the public Nextcloud app signing certificate for MeeTree.
- Sign tagged GitHub release archives when the `MEETREE_SIGNING_KEY` repository secret is configured.

## 1.1.8 - 2026-06-22

### Added

- Add GitHub Actions packaging for MeeTree release archives.
- Publish the packaged app archive as a GitHub Release asset when pushing version tags.

## 1.1.7 - 2026-06-22

### Fixed

- Restore the Undo button as a clearly labeled toolbar action.
- Render Markdown paragraphs from blank-line separated text instead of treating every line break as HTML-style `<br>` output.

## 1.1.6 - 2026-06-22

### Added

- Export the current branch as a standalone `.mtre` file from the existing Export menu.
- Add Export menu helper text explaining branch export behavior.

## 1.1.5 - 2026-06-22

### Fixed

- Set the app navigation icon foreground to white.
- Update the editor mode button label and active styling when toggling between preview and edit mode.

## 1.1.4 - 2026-06-22

### Fixed

- Restore the app navigation icon as a black source SVG so Nextcloud can render it through its app bar icon filter.

## 1.1.3 - 2026-06-22

### Fixed

- Use a white foreground for the app navigation icon so it matches the Nextcloud app bar.

## 1.1.2 - 2026-06-22

### Fixed

- Ensure toolbar Expand and Collapse only target the selected branch and no longer fall back to the whole tree.

## 1.1.1 - 2026-06-22

### Changed

- Make toolbar Expand and Collapse operate on the current tree branch instead of always targeting the whole tree.

## 1.1.0 - 2026-06-22

### Changed

- Remove maintainer-only release signing instructions from the public README.

## 1.0.25 - 2026-06-22

### Fixed

- Clarify that the App Store signing private key must stay local and secret.

## 1.0.24 - 2026-06-22

### Changed

- Debounce saving expand/collapse UI state to reduce autosave writes while browsing the tree.

## 1.0.23 - 2026-06-22

### Changed

- Replace separate Markdown Edit and Preview buttons with a single Edit toggle that defaults to preview mode.

### Added

- Add whole-tree Expand and Collapse actions to the tree toolbar.

## 1.0.22 - 2026-06-22

### Fixed

- Document Markdown content preview support in the README and app metadata.

## 1.0.21 - 2026-06-22

### Changed

- Clarify local import versus Nextcloud open storage behavior in the README.
- Remove pre-release native filename compatibility for .meetree and .meetree.json.

## 1.0.20 - 2026-06-22

### Changed

- Use the repository root README as the single documentation source for release archives.

## 1.0.19 - 2026-06-22

### Fixed

- Clarify where new, imported, opened, and converted MeeTree files are saved.

## 1.0.18 - 2026-06-22

### Fixed

- Point App Store metadata links to the public MeeTree repository.

## 1.0.17 - 2026-06-21

### Changed

- Use .mtre as the native MeeTree file extension while retaining support for existing native file extensions.

## 1.0.16 - 2026-06-21

### Added

- Add Markdown preview mode for node content with support for common formatting.

## 1.0.15 - 2026-06-21

### Changed

- Rename the Open menu button to File for clearer file actions.

## 1.0.14 - 2026-06-21

### Added

- Add a New Tree action that creates a fresh MeeTree JSON document under /MeeTree/ without overwriting existing files.

## 1.0.13 - 2026-06-20

### Changed

- Update app author metadata to Theo Linschooten.

## 1.0.12 - 2026-06-20

### Fixed

- Keep autosave status and bottom status messages consistent after save failures and recoveries.
- Show more detailed autosave failure messages when the server response includes details.

## 1.0.11 - 2026-06-20

### Added

- Remember collapsed and expanded tree branches per document.

## 1.0.10 - 2026-06-20

### Changed

- Move the tree undo button to the right side of the tree action strip.

## 1.0.9 - 2026-06-20

### Added

- Add undo for tree add, delete, move, and sort actions with a ↶ button and Ctrl/Cmd+Z shortcut.

## 1.0.8 - 2026-06-20

### Fixed

- Remove inherited spacing between the search field and search options.

## 1.0.6 - 2026-06-20

### Changed

- Collapsing a branch now collapses all descendant subbranches, while expanding reopens only that branch.

## 1.0.5 - 2026-06-20

### Changed

- Allow the root tree node to collapse and expand like other branches.

## 1.0.4 - 2026-06-20

### Fixed

- Use a black source icon so Nextcloud's icon filter renders it white in the app bar.

## 1.0.3 - 2026-06-20

### Changed

- Tighten spacing between the search input and search options.
- Replace the app icon with a simpler white node-tree mark.

## 1.0.2 - 2026-06-20

### Fixed

- Use solid white filled shapes for the navigation icon to avoid dark stroke rendering.

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
