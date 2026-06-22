# MeeTree

MeeTree is a Nextcloud app for TreePad-style hierarchical notes.

MeeTree stores notes as native `.mtre` files containing JSON. It imports and exports compatibility formats around that native model.

## Features

- Tree note navigation with a Jreepad-inspired split layout
- Edit node title and Markdown content with Edit/Preview modes
- Add child nodes and delete non-root nodes
- Create new `.mtre` tree files from the File menu
- Import `.mtre`, `.hjt`, `.ctd`, and JSON files
- Import CherryTree `.ctd` XML files
- Export JSON, `.hjt`, and `.ctd` files
- Search titles, content, case-sensitive text, and regular expressions

## Install In Nextcloud

Place this directory in `apps/meetree` or symlink it there, then enable it:

```sh
php occ app:enable meetree
```

## Standalone Preview

To preview the interface without Nextcloud, open `standalone/index.html` in a browser or serve the directory locally:

```sh
python3 -m http.server 8080
```

Then visit `http://localhost:8080/meetree/standalone/` from the repository root. The standalone preview saves data to browser `localStorage` and supports local HJT import/export, but it does not test Nextcloud routing, authentication, or file storage.

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

## App Store Release

The Nextcloud App Store archive must contain one top-level folder named `meetree`, matching the app id in `appinfo/info.xml`.

Create a release archive from the repository root with:

```sh
./meetree/scripts/package-release.sh
```

Then sign the generated archive with the app certificate private key:

```sh
openssl dgst -sha512 -sign ~/.nextcloud/certificates/meetree.key build/meetree-1.0.19.tar.gz | openssl base64
```
