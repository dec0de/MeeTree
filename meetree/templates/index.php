<?php
/** @var array $_ */
?>
<div id="meetree-app" data-endpoint="<?php p($_['endpoint']); ?>">
    <aside class="meetree-sidebar">
        <header class="meetree-header">
            <h2>MeeTree</h2>
            <button type="button" id="meetree-file-toggle">File</button>
            <button type="button" id="meetree-add-node">New node</button>
            <button type="button" id="meetree-delete-node">Delete</button>
            <button type="button" id="meetree-sort-asc">Sort A-Z</button>
            <button type="button" id="meetree-sort-desc">Sort Z-A</button>
            <button type="button" id="meetree-search-toggle">Search</button>
        </header>
        <div id="meetree-file-menu" class="meetree-file-actions" hidden>
            <label class="button" for="meetree-import-file">Import</label>
            <input id="meetree-import-file" type="file" accept=".hjt,.ctd,.json,.txt,text/plain,application/json,application/xml" />
            <label for="meetree-export-format">Export as</label>
            <select id="meetree-export-format">
                <option value="json">MeeTree JSON</option>
                <option value="hjt">TreePad/Jreepad HJT</option>
                <option value="ctd">CherryTree CTD</option>
            </select>
            <button type="button" id="meetree-export">Export</button>
        </div>
        <nav id="meetree-tree" class="meetree-tree" aria-label="MeeTree document tree"></nav>
    </aside>
    <main class="meetree-editor">
        <div class="meetree-editor-toolbar">
            <input id="meetree-node-title" type="text" placeholder="Node title" />
            <span id="meetree-save-state" class="meetree-save-state">Saved</span>
        </div>
        <textarea id="meetree-node-content" spellcheck="true" placeholder="Write this node's content here"></textarea>
        <p id="meetree-status" role="status"></p>
    </main>
    <section id="meetree-search-panel" class="meetree-search-panel" hidden>
        <header class="meetree-search-panel-header">
            <strong>Search</strong>
            <button type="button" id="meetree-search-close" aria-label="Close search">Close</button>
        </header>
        <div class="meetree-search">
            <input id="meetree-search-input" type="search" placeholder="Search titles and content" />
            <label><input id="meetree-search-title" type="checkbox" checked /> Titles</label>
            <label><input id="meetree-search-content" type="checkbox" checked /> Content</label>
            <label><input id="meetree-search-case" type="checkbox" /> Match case</label>
            <label><input id="meetree-search-regex" type="checkbox" /> Regex</label>
            <div id="meetree-search-results" class="meetree-search-results"></div>
        </div>
    </section>
</div>
