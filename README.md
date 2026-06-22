# MeeTree

MeeTree is a Nextcloud app for TreePad-style hierarchical notes.

MeeTree stores notes as native `.mtre` files containing JSON. It imports and exports compatibility formats around that native model.

## Features

- Tree note navigation with a Jreepad-inspired split layout
- Edit node title and Markdown content with a toggleable Edit mode
- Add child nodes and delete non-root nodes
- Drag and drop nodes before, after, or inside other nodes
- Expand or collapse the whole tree from the tree toolbar
- Undo tree add, delete, move, and sort actions
- Remember collapsed and expanded branches per document
- Create new `.mtre` tree files from the File menu
- Open and convert supported files from Nextcloud Files
- Import `.mtre`, `.hjt`, `.ctd`, and JSON files from your computer
- Export MeeTree, `.hjt`, and `.ctd` files
- Search titles, content, case-sensitive text, and regular expressions
- Standalone browser preview for quick UI testing

## Install In Nextcloud

Place the `meetree/` app directory in `custom_apps/meetree` or symlink it there, then enable it:

```sh
php occ app:enable meetree
```

## Standalone Preview

To preview the interface without Nextcloud, open `meetree/standalone/index.html` in a browser or serve the repository root locally:

```sh
python3 -m http.server 8080
```

Then visit `http://localhost:8080/meetree/standalone/`. The standalone preview saves data to browser `localStorage` and supports local import/export, but it does not test Nextcloud routing, authentication, or file storage.

## File Formats

MeeTree's native extension is `.mtre`. The file contents are JSON so advanced users can inspect or repair files with a text editor.

## Markdown Content

Node content is plain Markdown text. MeeTree opens nodes in preview mode by default; press `Edit` to toggle editing. MeeTree supports common Markdown formatting such as headings, bold and italic text, links, lists, task lists, blockquotes, inline code, fenced code blocks, horizontal rules, and line breaks.

## Storage Behavior

New trees are created in `/MeeTree/` by default, for example `/MeeTree/untitled.mtre`.

### Import From Computer

Files imported with the browser's local file picker are saved as converted `.mtre` files under `/MeeTree/`. Browsers expose the selected file name and contents, but not the original local folder path.

### Open/Convert From Nextcloud

Files opened from Nextcloud Files keep their Nextcloud location.

Native `.mtre` files autosave back to the same file.

Legacy files such as `.hjt` or `.ctd` are converted to `.mtre` beside the source file when possible, for example `/Notes/project.hjt` becomes `/Notes/project.mtre`. If MeeTree cannot write beside the source file, it falls back to `/MeeTree/`.

MeeTree writes TreePad 2.7 Lite-style HJT:

```text
<Treepad version 2.7>
dt=Text
<node>
Title
0
Content
<end node> 5P9i0s8y19Z
```

CherryTree `.ctd` XML has first-pass plain text support. CherryTree `.ctb` SQLite, encrypted `.ctz/.ctx`, and Jreepad `.jree` are not implemented yet.
