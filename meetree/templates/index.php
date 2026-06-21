<?php
/** @var array $_ */
?>
<div id="meetree-app" data-endpoint="<?php p($_['endpoint']); ?>">
    <aside class="meetree-sidebar">
        <header class="meetree-header">
            <h2>MeeTree</h2>
            <button type="button" id="meetree-open-toggle">File</button>
            <button type="button" id="meetree-export-toggle">Export</button>
            <button type="button" id="meetree-search-toggle">Search</button>
        </header>
        <div id="meetree-open-menu" class="meetree-file-actions" hidden>
            <button type="button" id="meetree-new-tree">Create New Tree</button>
            <button type="button" id="meetree-open-nextcloud">Open/Convert from Nextcloud</button>
            <label class="button" for="meetree-import-file">Import from computer</label>
            <input id="meetree-import-file" type="file" accept=".hjt,.ctd,.json,.txt,text/plain,application/json,application/xml" />
        </div>
        <div id="meetree-export-menu" class="meetree-file-actions" hidden>
            <select id="meetree-export-format">
                <option value="json">MeeTree JSON</option>
                <option value="hjt">TreePad/Jreepad HJT</option>
                <option value="ctd">CherryTree CTD</option>
            </select>
            <button type="button" id="meetree-export">Export</button>
        </div>
        <div class="meetree-tree-actions" aria-label="Tree actions">
            <button type="button" id="meetree-add-node" title="New child node">+ Node</button>
            <button type="button" id="meetree-delete-node">Delete</button>
            <button type="button" id="meetree-sort-asc">Sort A-Z</button>
            <button type="button" id="meetree-sort-desc">Sort Z-A</button>
            <button type="button" id="meetree-undo" title="Undo last tree change">↶</button>
        </div>
        <nav id="meetree-tree" class="meetree-tree" aria-label="MeeTree document tree"></nav>
    </aside>
    <div id="meetree-divider" class="meetree-divider" role="separator" aria-orientation="vertical" aria-label="Resize tree panel"></div>
    <main class="meetree-editor">
        <div class="meetree-editor-toolbar">
            <input id="meetree-node-title" type="text" placeholder="Node title" />
            <button type="button" id="meetree-edit-mode" class="meetree-mode-button active">Edit</button>
            <button type="button" id="meetree-preview-mode" class="meetree-mode-button">Preview</button>
            <span id="meetree-save-state" class="meetree-save-state">Saved</span>
        </div>
        <textarea id="meetree-node-content" spellcheck="true" placeholder="Write Markdown content here"></textarea>
        <article id="meetree-node-preview" class="meetree-markdown-preview" hidden></article>
        <p id="meetree-status" role="status"></p>
    </main>
    <section id="meetree-search-panel" class="meetree-search-panel" hidden>
        <header class="meetree-search-panel-header">
            <strong>Search</strong>
            <button type="button" id="meetree-search-close" aria-label="Close search">Close</button>
        </header>
        <div class="meetree-search">
            <input id="meetree-search-input" type="search" placeholder="Search titles and content" />
            <div class="meetree-search-options">
                <label><input id="meetree-search-title" type="checkbox" checked /> Titles</label>
                <label><input id="meetree-search-content" type="checkbox" checked /> Content</label>
                <label><input id="meetree-search-case" type="checkbox" /> Match case</label>
                <label><input id="meetree-search-regex" type="checkbox" /> Regex</label>
            </div>
            <div id="meetree-search-results" class="meetree-search-results"></div>
        </div>
    </section>
    <section id="meetree-file-panel" class="meetree-file-panel" hidden>
        <header class="meetree-file-panel-header">
            <strong>Open from Nextcloud</strong>
            <button type="button" id="meetree-file-close" aria-label="Close file browser">Close</button>
        </header>
        <div class="meetree-file-browser">
            <div class="meetree-file-path" id="meetree-file-path">/</div>
            <div class="meetree-file-browser-actions">
                <button type="button" id="meetree-file-up">Up</button>
                <button type="button" id="meetree-file-refresh">Refresh</button>
            </div>
            <div id="meetree-file-list" class="meetree-file-list"></div>
        </div>
    </section>
</div>
