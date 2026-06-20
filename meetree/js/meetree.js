(function() {
    'use strict';

    const app = document.getElementById('meetree-app');
    if (!app) {
        return;
    }

    const endpoint = app.dataset.endpoint;
    const sidebarWidthStorageKey = 'meetree.sidebarWidth';
    const treeEl = document.getElementById('meetree-tree');
    const dividerEl = document.getElementById('meetree-divider');
    const titleEl = document.getElementById('meetree-node-title');
    const contentEl = document.getElementById('meetree-node-content');
    const statusEl = document.getElementById('meetree-status');
    const saveStateEl = document.getElementById('meetree-save-state');
    const openMenu = document.getElementById('meetree-open-menu');
    const exportMenu = document.getElementById('meetree-export-menu');
    const exportFormatEl = document.getElementById('meetree-export-format');
    const filePanel = document.getElementById('meetree-file-panel');
    const filePathEl = document.getElementById('meetree-file-path');
    const fileListEl = document.getElementById('meetree-file-list');
    const filePanelHeader = filePanel.querySelector('.meetree-file-panel-header');
    const searchPanel = document.getElementById('meetree-search-panel');
    const searchPanelHeader = searchPanel.querySelector('.meetree-search-panel-header');
    const searchInput = document.getElementById('meetree-search-input');
    const searchResults = document.getElementById('meetree-search-results');
    let documentData = null;
    let selectedId = null;
    let draggedNodeId = null;
    let saveTimer = null;
    let isDirty = false;
    let isSaving = false;
    let saveQueued = false;
    let currentFileBrowserPath = '/';
    const collapsedIds = new Set();

    const requestToken = OC.requestToken;

    function initDivider() {
        const storedWidth = localStorage.getItem(sidebarWidthStorageKey);
        if (storedWidth) {
            app.style.setProperty('--meetree-sidebar-width', storedWidth);
        }
        if (!dividerEl) {
            return;
        }
        dividerEl.addEventListener('pointerdown', event => {
            if (window.matchMedia('(max-width: 800px)').matches) {
                return;
            }
            event.preventDefault();
            dividerEl.classList.add('dragging');
            app.classList.add('resizing-sidebar');
            dividerEl.setPointerCapture(event.pointerId);

            function onMove(moveEvent) {
                const rect = app.getBoundingClientRect();
                const width = Math.min(Math.max(240, moveEvent.clientX - rect.left), Math.max(320, rect.width * 0.7));
                const value = `${Math.round(width)}px`;
                app.style.setProperty('--meetree-sidebar-width', value);
                localStorage.setItem(sidebarWidthStorageKey, value);
            }

            function onUp(upEvent) {
                dividerEl.classList.remove('dragging');
                app.classList.remove('resizing-sidebar');
                dividerEl.releasePointerCapture(upEvent.pointerId);
                dividerEl.removeEventListener('pointermove', onMove);
                dividerEl.removeEventListener('pointerup', onUp);
                dividerEl.removeEventListener('pointercancel', onUp);
            }

            dividerEl.addEventListener('pointermove', onMove);
            dividerEl.addEventListener('pointerup', onUp);
            dividerEl.addEventListener('pointercancel', onUp);
        });
    }

    function setStatus(message) {
        statusEl.textContent = message;
    }

    function setSaveState(message) {
        saveStateEl.textContent = message;
    }

    function markDirty(immediate = false) {
        isDirty = true;
        setSaveState('Unsaved changes');
        if (saveTimer) {
            clearTimeout(saveTimer);
        }
        saveTimer = setTimeout(() => saveNow(), immediate ? 0 : 1000);
    }

    function headers(extra) {
        return Object.assign({
            'Content-Type': 'application/json',
            requesttoken: requestToken,
        }, extra || {});
    }

    function findNode(id, node = documentData.root, parent = null) {
        if (node.id === id) {
            return { node, parent };
        }
        for (const child of node.children || []) {
            const found = findNode(id, child, node);
            if (found) {
                return found;
            }
        }
        return null;
    }

    function selectedInfo() {
        return nodeInfo(selectedId);
    }

    function nodeInfo(id) {
        const found = id ? findNode(id) : null;
        if (!found) {
            return null;
        }
        const siblings = found.parent ? found.parent.children : null;
        const index = siblings ? siblings.findIndex(node => node.id === id) : -1;
        return { ...found, siblings, index };
    }

    function nodeContains(node, id) {
        return (node.children || []).some(child => child.id === id || nodeContains(child, id));
    }

    function updateExportFormatDefault() {
        const format = documentData && documentData.source ? documentData.source.format : 'json';
        exportFormatEl.value = ['hjt', 'ctd', 'json'].includes(format) ? format : 'json';
    }

    function activeFilePath() {
        return documentData && documentData.activeFile ? documentData.activeFile.path || '' : '';
    }

    function exportUrl(format) {
        const path = activeFilePath();
        const params = path ? `?${new URLSearchParams({ path }).toString()}` : '';
        return `${OC.generateUrl(`/apps/meetree/export/${format}`)}${params}`;
    }

    function formatLabel(format) {
        if (format === 'hjt') {
            return 'HJT';
        }
        if (format === 'ctd') {
            return 'CTD';
        }
        return 'MeeTree JSON';
    }

    function makeFileRow(className, onActivate) {
        const row = document.createElement('div');
        row.className = className;
        row.tabIndex = 0;
        row.setAttribute('role', 'listitem');
        row.addEventListener('click', onActivate);
        row.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onActivate();
            }
        });
        return row;
    }

    function syncEditorToNode() {
        const found = selectedId ? findNode(selectedId) : null;
        if (!found) {
            return;
        }
        found.node.title = titleEl.value || 'Untitled';
        found.node.content = contentEl.value;
    }

    function renderTree() {
        treeEl.textContent = '';
        function clearDropClasses() {
            treeEl.querySelectorAll('.drop-before, .drop-inside, .drop-after').forEach(row => {
                row.classList.remove('drop-before', 'drop-inside', 'drop-after');
            });
        }

        function getDropMode(event, row) {
            const rect = row.getBoundingClientRect();
            const ratio = (event.clientY - rect.top) / rect.height;
            if (ratio < 0.33) {
                return 'before';
            }
            if (ratio > 0.66) {
                return 'after';
            }
            return 'inside';
        }

        function canDrop(sourceInfo, targetInfo, mode) {
            if (!sourceInfo || !targetInfo || sourceInfo.node.id === targetInfo.node.id) {
                return false;
            }
            if (sourceInfo.node.id === documentData.root.id) {
                return false;
            }
            if (nodeContains(sourceInfo.node, targetInfo.node.id)) {
                return false;
            }
            return mode === 'inside' || Boolean(targetInfo.parent);
        }

        function applyDrop(targetId, mode) {
            const sourceInfo = nodeInfo(draggedNodeId);
            const targetInfo = nodeInfo(targetId);
            if (!canDrop(sourceInfo, targetInfo, mode)) {
                setStatus('Cannot drop node there');
                return;
            }

            const [movingNode] = sourceInfo.siblings.splice(sourceInfo.index, 1);
            if (mode === 'inside') {
                targetInfo.node.children = targetInfo.node.children || [];
                targetInfo.node.children.unshift(movingNode);
                collapsedIds.delete(targetInfo.node.id);
            } else {
                const refreshedTarget = nodeInfo(targetId);
                const targetSiblings = refreshedTarget.parent.children;
                const targetIndex = targetSiblings.findIndex(node => node.id === targetId);
                targetSiblings.splice(mode === 'before' ? targetIndex : targetIndex + 1, 0, movingNode);
            }
            selectNode(movingNode.id);
            markDirty(true);
            setStatus(mode === 'inside' ? 'Moved node inside branch' : 'Moved node');
        }

        function add(node, ancestorHasNext, isLast, isRoot) {
            const row = document.createElement('div');
            row.className = 'meetree-tree-row';
            row.dataset.nodeId = node.id;
            if (!isRoot) {
                row.draggable = true;
                row.addEventListener('dragstart', event => {
                    syncEditorToNode();
                    draggedNodeId = node.id;
                    row.classList.add('dragging');
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', node.id);
                });
                row.addEventListener('dragend', () => {
                    draggedNodeId = null;
                    row.classList.remove('dragging');
                    clearDropClasses();
                });
            }
            row.addEventListener('dragover', event => {
                if (!draggedNodeId) {
                    return;
                }
                const mode = getDropMode(event, row);
                if (!canDrop(nodeInfo(draggedNodeId), nodeInfo(node.id), mode)) {
                    return;
                }
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                clearDropClasses();
                row.classList.add(`drop-${mode}`);
            });
            row.addEventListener('dragleave', event => {
                if (!row.contains(event.relatedTarget)) {
                    row.classList.remove('drop-before', 'drop-inside', 'drop-after');
                }
            });
            row.addEventListener('drop', event => {
                if (!draggedNodeId) {
                    return;
                }
                event.preventDefault();
                const mode = getDropMode(event, row);
                clearDropClasses();
                applyDrop(node.id, mode);
            });
            const guides = document.createElement('span');
            guides.className = 'meetree-tree-guides';
            ancestorHasNext.forEach(hasNext => {
                const guide = document.createElement('span');
                guide.className = `meetree-tree-guide ${hasNext ? 'continue' : 'blank'}`;
                guides.appendChild(guide);
            });
            if (!isRoot) {
                const connector = document.createElement('span');
                connector.className = `meetree-tree-guide ${isLast ? 'elbow' : 'tee'}`;
                guides.appendChild(connector);
            }
            const children = node.children || [];
            const isCollapsed = collapsedIds.has(node.id);
            row.appendChild(guides);
            if (children.length > 0) {
                const toggle = document.createElement('button');
                toggle.type = 'button';
                toggle.className = 'meetree-tree-toggle';
                toggle.textContent = isCollapsed ? '+' : '-';
                toggle.title = isCollapsed ? 'Expand branch' : 'Collapse branch';
                toggle.addEventListener('click', event => {
                    event.stopPropagation();
                    if (collapsedIds.has(node.id)) {
                        collapsedIds.delete(node.id);
                    } else {
                        collapsedIds.add(node.id);
                    }
                    renderTree();
                });
                row.appendChild(toggle);
            } else {
                const spacer = document.createElement('span');
                spacer.className = 'meetree-tree-toggle-spacer';
                row.appendChild(spacer);
            }
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = node.title || 'Untitled';
            button.classList.toggle('active', node.id === selectedId);
            button.addEventListener('click', () => selectNode(node.id));
            row.appendChild(button);
            treeEl.appendChild(row);
            if (isCollapsed) {
                return;
            }
            const childAncestors = isRoot ? ancestorHasNext : ancestorHasNext.concat(!isLast);
            children.forEach((child, index) => {
                add(child, childAncestors, index === children.length - 1, false);
            });
        }
        add(documentData.root, [], true, true);
    }

    function selectNode(id, shouldSync = true) {
        if (shouldSync) {
            syncEditorToNode();
        }
        selectedId = id;
        const found = findNode(id);
        if (!found) {
            return;
        }
        titleEl.value = found.node.title || '';
        contentEl.value = found.node.content || '';
        renderTree();
    }

    async function loadDocument() {
        const response = await fetch(endpoint, { headers: headers() });
        if (!response.ok) {
            throw new Error(`Could not load document (${response.status})`);
        }
        documentData = await response.json();
        selectedId = null;
        updateExportFormatDefault();
        selectNode(documentData.root.id, false);
        setStatus(`Loaded ${activeFilePath() || 'MeeTree/tree.meetree.json'}`);
    }

    async function saveNow() {
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
        if (!documentData) {
            return;
        }
        if (isSaving) {
            saveQueued = true;
            return;
        }
        syncEditorToNode();
        if (!isDirty) {
            setSaveState('Saved');
            return;
        }
        isSaving = true;
        setSaveState('Saving...');
        renderTree();
        try {
            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: headers(),
                body: JSON.stringify({ document: documentData }),
            });
            if (!response.ok) {
                throw new Error(`Save failed (${response.status})`);
            }
            isDirty = false;
            setSaveState('Saved');
        } catch (error) {
            setSaveState('Save failed');
            setStatus(error.message);
        } finally {
            isSaving = false;
            if (saveQueued) {
                saveQueued = false;
                markDirty(true);
            }
        }
    }

    function newId() {
        return Math.random().toString(16).slice(2) + Date.now().toString(16);
    }

    document.getElementById('meetree-add-node').addEventListener('click', () => {
        syncEditorToNode();
        const found = findNode(selectedId);
        if (!found) {
            return;
        }
        const child = { id: newId(), title: 'New node', content: '', children: [] };
        found.node.children = found.node.children || [];
        found.node.children.unshift(child);
        selectNode(child.id);
        markDirty(true);
        setStatus('New child node added');
    });

    function sortSelectedChildren(direction) {
        syncEditorToNode();
        const found = findNode(selectedId);
        if (!found || !Array.isArray(found.node.children) || found.node.children.length < 2) {
            setStatus('Selected branch has fewer than two children to sort');
            return;
        }
        const multiplier = direction === 'desc' ? -1 : 1;
        found.node.children.sort((left, right) => multiplier * (left.title || '').localeCompare(right.title || '', undefined, { sensitivity: 'base' }));
        renderTree();
        markDirty(true);
        setStatus(direction === 'desc' ? 'Sorted branch Z-A' : 'Sorted branch A-Z');
    }

    document.getElementById('meetree-sort-asc').addEventListener('click', () => sortSelectedChildren('asc'));
    document.getElementById('meetree-sort-desc').addEventListener('click', () => sortSelectedChildren('desc'));

    document.getElementById('meetree-delete-node').addEventListener('click', () => {
        const info = selectedInfo();
        if (!info || !info.parent || !info.siblings) {
            setStatus('The root node cannot be deleted');
            return;
        }
        if ((info.node.children || []).length > 0 && !window.confirm('Delete this node and all child nodes?')) {
            return;
        }
        info.siblings.splice(info.index, 1);
        const nextSelection = info.siblings[info.index] || info.siblings[info.index - 1] || info.parent;
        selectNode(nextSelection.id);
        markDirty(true);
        setStatus('Node deleted');
    });

    titleEl.addEventListener('input', () => {
        syncEditorToNode();
        renderTree();
        markDirty();
    });
    contentEl.addEventListener('input', () => {
        syncEditorToNode();
        markDirty();
    });
    titleEl.addEventListener('blur', () => saveNow());
    contentEl.addEventListener('blur', () => saveNow());

    document.getElementById('meetree-import-file').addEventListener('change', async event => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        const content = await file.text();
        const response = await fetch(OC.generateUrl('/apps/meetree/import'), {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ filename: file.name, content }),
        });
        documentData = await response.json();
        selectedId = null;
        collapsedIds.clear();
        updateExportFormatDefault();
        selectNode(documentData.root.id, false);
        isDirty = false;
        setSaveState('Saved');
        setStatus(`Imported ${file.name}`);
    });

    document.getElementById('meetree-export').addEventListener('click', async () => {
        await saveNow();
        window.location.href = exportUrl(exportFormatEl.value);
    });

    async function loadFileList(path = '/') {
        currentFileBrowserPath = path;
        filePathEl.textContent = path;
        fileListEl.textContent = 'Loading...';
        const response = await fetch(`${endpoint}?${new URLSearchParams({ browse: '1', path }).toString()}`, {
            headers: headers(),
        });
        if (!response.ok) {
            throw new Error(`Could not list Nextcloud files (${response.status})`);
        }
        const data = await response.json();
        currentFileBrowserPath = data.path;
        filePathEl.textContent = data.path;
        fileListEl.textContent = '';
        fileListEl.setAttribute('role', 'list');

        if (data.parent !== null) {
            const up = makeFileRow('meetree-file-row meetree-file-folder', () => loadFileList(data.parent));
            up.innerHTML = '<span class="meetree-file-icon" aria-hidden="true"></span><span class="meetree-file-name">..</span><span class="meetree-file-meta">Parent folder</span>';
            fileListEl.appendChild(up);
        }

        data.entries.forEach(entry => {
            const row = makeFileRow(`meetree-file-row meetree-file-${entry.type}`, () => {
                if (entry.type === 'folder') {
                    loadFileList(entry.path);
                } else {
                    openNextcloudFile(entry.path).catch(error => setStatus(error.message));
                }
            });
            const icon = document.createElement('span');
            icon.className = 'meetree-file-icon';
            icon.setAttribute('aria-hidden', 'true');
            const name = document.createElement('span');
            name.className = 'meetree-file-name';
            name.textContent = entry.name;
            const meta = document.createElement('span');
            meta.className = 'meetree-file-meta';
            meta.textContent = entry.type === 'folder' ? 'Folder' : formatLabel(entry.format);
            row.append(icon, name, meta);
            fileListEl.appendChild(row);
        });

        if (fileListEl.textContent === '') {
            fileListEl.textContent = 'No supported files found in this folder.';
        }
    }

    async function openNextcloudFile(path) {
        await saveNow();
        const response = await fetch(`${endpoint}?${new URLSearchParams({ open: path }).toString()}`, {
            headers: headers(),
        });
        if (!response.ok) {
            throw new Error(`Could not open ${path} (${response.status})`);
        }
        documentData = await response.json();
        selectedId = null;
        collapsedIds.clear();
        updateExportFormatDefault();
        selectNode(documentData.root.id, false);
        isDirty = false;
        setSaveState('Saved');
        filePanel.hidden = true;
        setStatus(documentData.message || `Opened ${path}`);
    }

    const openNextcloudButton = document.getElementById('meetree-open-nextcloud');
    if (openNextcloudButton) {
        openNextcloudButton.addEventListener('click', () => {
            filePanel.hidden = false;
            setStatus('Opening Nextcloud file browser...');
            loadFileList(currentFileBrowserPath).catch(error => {
                fileListEl.textContent = error.message;
                setStatus(error.message);
            });
        });
    }

    document.getElementById('meetree-file-close').addEventListener('click', () => {
        filePanel.hidden = true;
    });

    document.getElementById('meetree-file-refresh').addEventListener('click', () => {
        loadFileList(currentFileBrowserPath).catch(error => {
            fileListEl.textContent = error.message;
            setStatus(error.message);
        });
    });

    document.getElementById('meetree-file-up').addEventListener('click', () => {
        const parent = currentFileBrowserPath === '/' ? '/' : currentFileBrowserPath.replace(/\/[^/]+\/?$/, '') || '/';
        loadFileList(parent).catch(error => {
            fileListEl.textContent = error.message;
            setStatus(error.message);
        });
    });

    document.getElementById('meetree-open-toggle').addEventListener('click', () => {
        openMenu.hidden = !openMenu.hidden;
        exportMenu.hidden = true;
    });

    document.getElementById('meetree-export-toggle').addEventListener('click', () => {
        exportMenu.hidden = !exportMenu.hidden;
        openMenu.hidden = true;
    });

    document.getElementById('meetree-search-toggle').addEventListener('click', () => {
        searchPanel.hidden = !searchPanel.hidden;
        if (!searchPanel.hidden) {
            searchInput.focus();
            runSearch();
        }
    });

    document.getElementById('meetree-search-close').addEventListener('click', () => {
        searchPanel.hidden = true;
    });

    function makePanelDraggable(panel, header) {
        header.addEventListener('pointerdown', event => {
            if (event.target.closest('button')) {
                return;
            }
            const rect = panel.getBoundingClientRect();
            const offsetX = event.clientX - rect.left;
            const offsetY = event.clientY - rect.top;
            panel.classList.add('dragging');
            header.setPointerCapture(event.pointerId);

            function onMove(moveEvent) {
                const maxLeft = window.innerWidth - panel.offsetWidth - 8;
                const maxTop = window.innerHeight - panel.offsetHeight - 8;
                const left = Math.min(Math.max(8, moveEvent.clientX - offsetX), Math.max(8, maxLeft));
                const top = Math.min(Math.max(8, moveEvent.clientY - offsetY), Math.max(8, maxTop));
                panel.style.left = `${left}px`;
                panel.style.top = `${top}px`;
                panel.style.right = 'auto';
            }

            function onUp(upEvent) {
                panel.classList.remove('dragging');
                header.releasePointerCapture(upEvent.pointerId);
                header.removeEventListener('pointermove', onMove);
                header.removeEventListener('pointerup', onUp);
                header.removeEventListener('pointercancel', onUp);
            }

            header.addEventListener('pointermove', onMove);
            header.addEventListener('pointerup', onUp);
            header.addEventListener('pointercancel', onUp);
        });
    }

    makePanelDraggable(filePanel, filePanelHeader);
    makePanelDraggable(searchPanel, searchPanelHeader);

    function textMatches(haystack, query, caseSensitive, regex) {
        if (!regex) {
            return caseSensitive ? haystack.includes(query) : haystack.toLowerCase().includes(query.toLowerCase());
        }
        try {
            return new RegExp(query, caseSensitive ? '' : 'i').test(haystack);
        } catch (error) {
            return false;
        }
    }

    function searchNode(node, path, query, options, results) {
        const nodePath = path.concat(node.title || 'Untitled');
        const matches = [];
        if (options.titles && textMatches(node.title || '', query, options.caseSensitive, options.regex)) {
            matches.push('title');
        }
        if (options.content && textMatches(node.content || '', query, options.caseSensitive, options.regex)) {
            matches.push('content');
        }
        if (matches.length) {
            results.push({ id: node.id, path: nodePath.join(' / '), matches });
        }
        (node.children || []).forEach(child => searchNode(child, nodePath, query, options, results));
    }

    function runSearch() {
        syncEditorToNode();
        const query = searchInput.value.trim();
        const data = { results: [] };
        if (query) {
            searchNode(documentData.root, [], query, {
                titles: document.getElementById('meetree-search-title').checked,
                content: document.getElementById('meetree-search-content').checked,
                caseSensitive: document.getElementById('meetree-search-case').checked,
                regex: document.getElementById('meetree-search-regex').checked,
            }, data.results);
        }
        searchResults.textContent = '';
        data.results.forEach(result => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'meetree-search-result';
            button.textContent = `${result.path} (${result.matches.join(', ')})`;
            button.addEventListener('click', () => selectNode(result.id));
            searchResults.appendChild(button);
        });
    }

    searchInput.addEventListener('input', runSearch);
    ['meetree-search-title', 'meetree-search-content', 'meetree-search-case', 'meetree-search-regex'].forEach(id => {
        document.getElementById(id).addEventListener('change', runSearch);
    });

    window.addEventListener('beforeunload', event => {
        if (isDirty || isSaving || saveQueued) {
            saveNow();
            event.preventDefault();
            event.returnValue = '';
        }
    });

    initDivider();
    loadDocument().catch(error => setStatus(error.message));
})();
