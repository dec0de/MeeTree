# MeeTree

MeeTree is a Nextcloud app for TreePad-style hierarchical notes.

MeeTree stores notes as native `.mtre` files containing JSON. It imports and exports compatibility formats around that native model.

## Features

- Tree note navigation with a Jreepad-inspired split layout
- Edit node title and Markdown content with Edit/Preview modes
- Add child nodes and delete non-root nodes
- Drag and drop nodes before, after, or inside other nodes
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

MeeTree also reads older native filenames such as `.meetree` and `.meetree.json` for compatibility.

## Storage Behavior

New trees are created in `/MeeTree/` by default, for example `/MeeTree/untitled.mtre`.

Files imported from your computer are saved as converted `.mtre` files under `/MeeTree/`, because browsers do not expose the original local folder path.

Files opened from Nextcloud Files keep their location. Native `.mtre` files autosave back to the same file. Legacy files such as `.hjt` or `.ctd` are converted to `.mtre` beside the source file when possible. If MeeTree cannot write beside the source file, it falls back to `/MeeTree/`.

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

## GitHub Releases

Create a release archive from the repository root with:

```sh
./meetree/scripts/package-release.sh
```

The archive contains one top-level folder named `meetree`, matching the app id in `meetree/appinfo/info.xml`.

## App Store Release

After the Nextcloud app certificate is issued, sign the generated archive with the app certificate private key:

```sh
openssl dgst -sha512 -sign ~/.nextcloud/certificates/meetree.key build/meetree-1.0.19.tar.gz | openssl base64
```

Use the resulting signature and GitHub release archive URL when uploading the release to the Nextcloud App Store.
