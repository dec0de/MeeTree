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
    const previewEl = document.getElementById('meetree-node-preview');
    const editModeButton = document.getElementById('meetree-edit-mode');
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
    let uiStateTimer = null;
    let isDirty = false;
    let uiStateDirty = false;
    let isSaving = false;
    let saveQueued = false;
    let currentFileBrowserPath = '/';
    let editorMode = 'preview';
    const undoStack = [];
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

    async function responseErrorMessage(response, fallback) {
        const text = await response.text().catch(() => '');
        if (!text) {
            return fallback;
        }
        try {
            const data = JSON.parse(text);
            return data.message || data.error || fallback;
        } catch (error) {
            return text.length > 180 ? `${fallback}: ${text.slice(0, 180)}...` : `${fallback}: ${text}`;
        }
    }

    function markDirty(immediate = false) {
        isDirty = true;
        setSaveState('Unsaved changes');
        if (saveTimer) {
            clearTimeout(saveTimer);
        }
        saveTimer = setTimeout(() => saveNow(), immediate ? 0 : 1000);
    }

    function markUiStateDirty() {
        uiStateDirty = true;
        if (uiStateTimer) {
            clearTimeout(uiStateTimer);
        }
        uiStateTimer = setTimeout(() => saveNow(), 5000);
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

    function collapseSubtree(node) {
        collapsedIds.add(node.id);
        (node.children || []).forEach(child => collapseSubtree(child));
    }

    function expandSubtree(node) {
        collapsedIds.delete(node.id);
        (node.children || []).forEach(child => expandSubtree(child));
    }

    function expandSelectedBranch() {
        const info = selectedInfo();
        if (!info) {
            setStatus('Select a branch to expand');
            return;
        }
        const node = info.node;
        expandSubtree(node);
        saveCollapsedState();
        renderTree();
        markUiStateDirty();
        setStatus(node.id === documentData.root.id ? 'Expanded whole tree' : 'Expanded branch');
    }

    function collapseSelectedBranch() {
        const info = selectedInfo();
        if (!info) {
            setStatus('Select a branch to collapse');
            return;
        }
        const node = info.node;
        collapseSubtree(node);
        saveCollapsedState();
        renderTree();
        markUiStateDirty();
        setStatus(node.id === documentData.root.id ? 'Collapsed whole tree' : 'Collapsed branch');
    }

    function loadCollapsedState() {
        collapsedIds.clear();
        const ids = documentData && documentData.uiState && Array.isArray(documentData.uiState.collapsedIds) ? documentData.uiState.collapsedIds : [];
        ids.forEach(id => collapsedIds.add(String(id)));
    }

    function saveCollapsedState() {
        documentData.uiState = documentData.uiState || {};
        documentData.uiState.collapsedIds = Array.from(collapsedIds);
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function pushUndoState() {
        syncEditorToNode();
        undoStack.push({
            root: clone(documentData.root),
            selectedId,
            collapsedIds: Array.from(collapsedIds),
        });
        if (undoStack.length > 50) {
            undoStack.shift();
        }
    }

    function undoLastChange() {
        const previous = undoStack.pop();
        if (!previous) {
            setStatus('Nothing to undo');
            return;
        }
        documentData.root = previous.root;
        collapsedIds.clear();
        previous.collapsedIds.forEach(id => collapsedIds.add(id));
        saveCollapsedState();
        selectedId = findNode(previous.selectedId) ? previous.selectedId : documentData.root.id;
        selectNode(selectedId, false);
        markDirty(true);
        setStatus('Undid last tree change');
    }

    function isTextEditingTarget(target) {
        return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable;
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

    function safeFilenamePart(value) {
        const cleaned = String(value || 'branch').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ');
        return (cleaned || 'branch').slice(0, 80);
    }

    function branchExportDocument(node) {
        return {
            version: documentData.version || 1,
            root: clone(node),
            uiState: { collapsedIds: [] },
            source: { format: 'json', filename: `${safeFilenamePart(node.title)}.mtre` },
        };
    }

    function downloadFile(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function exportSelectedBranchJson() {
        syncEditorToNode();
        const info = selectedInfo();
        if (!info) {
            setStatus('Select a branch to export');
            return;
        }

        const branchDocument = branchExportDocument(info.node);
        const filename = branchDocument.source.filename;
        downloadFile(JSON.stringify(branchDocument, null, 2) + '\n', filename, 'application/json;charset=utf-8');
        setStatus(`Exported branch ${info.node.title || 'Untitled'} as ${filename}`);
    }

    function formatLabel(format) {
        if (format === 'hjt') {
            return 'HJT';
        }
        if (format === 'ctd') {
            return 'CTD';
        }
        return 'MeeTree';
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        })[char]);
    }

    function safeUrl(value) {
        try {
            const url = new URL(value, window.location.href);
            return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : '';
        } catch (error) {
            return '';
        }
    }

    function renderInlineMarkdown(value) {
        const placeholders = [];
        function hold(html) {
            placeholders.push(html);
            return `\u0000${placeholders.length - 1}\u0000`;
        }

        value = String(value).replace(/`([^`]+)`/g, (match, code) => hold(`<code>${escapeHtml(code)}</code>`));
        value = value.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (match, label, href) => {
            const url = safeUrl(href);
            return url ? hold(`<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(label)}</a>`) : label;
        });
        value = escapeHtml(value)
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/__([^_]+)__/g, '<strong>$1</strong>')
            .replace(/(^|\W)\*([^*]+)\*/g, '$1<em>$2</em>')
            .replace(/(^|\W)_([^_]+)_/g, '$1<em>$2</em>')
            .replace(/~~([^~]+)~~/g, '<del>$1</del>');
        return value.replace(/\u0000(\d+)\u0000/g, (match, index) => placeholders[Number(index)] || '');
    }

    function isMarkdownBlockStart(line) {
        return /^\s*(```|#{1,6}\s+|([-*_])\s*\2\s*\2\s*$|>|[-*+]\s+|\d+\.\s+)/.test(line);
    }

    function renderMarkdown(markdown) {
        const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
        const html = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];
            if (line.trim() === '') {
                let blankCount = 0;
                while (i < lines.length && lines[i].trim() === '') {
                    blankCount++;
                    i++;
                }
                for (let blankIndex = 1; blankIndex < blankCount && html.length > 0; blankIndex++) {
                    html.push('<div class="meetree-markdown-spacer" aria-hidden="true"></div>');
                }
                continue;
            }

            if (/^\s*```/.test(line)) {
                const code = [];
                i++;
                while (i < lines.length && !/^\s*```/.test(lines[i])) {
                    code.push(lines[i]);
                    i++;
                }
                if (i < lines.length) {
                    i++;
                }
                html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
                continue;
            }

            const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
            if (heading) {
                const level = heading[1].length;
                html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
                i++;
                continue;
            }

            if (/^\s*([-*_])\s*\1\s*\1\s*$/.test(line)) {
                html.push('<hr>');
                i++;
                continue;
            }

            if (/^\s*>/.test(line)) {
                const quote = [];
                while (i < lines.length && /^\s*>/.test(lines[i])) {
                    quote.push(lines[i].replace(/^\s*>\s?/, ''));
                    i++;
                }
                html.push(`<blockquote>${renderMarkdown(quote.join('\n'))}</blockquote>`);
                continue;
            }

            const listMatch = line.match(/^\s*(?:([-*+])|(\d+)\.)\s+(.+)$/);
            if (listMatch) {
                const ordered = Boolean(listMatch[2]);
                const tag = ordered ? 'ol' : 'ul';
                const items = [];
                while (i < lines.length) {
                    const item = lines[i].match(/^\s*(?:([-*+])|(\d+)\.)\s+(.+)$/);
                    if (!item || Boolean(item[2]) !== ordered) {
                        break;
                    }
                    let content = item[3];
                    const task = content.match(/^\[( |x|X)\]\s+(.+)$/);
                    if (task) {
                        const checked = task[1].toLowerCase() === 'x' ? ' checked' : '';
                        content = `<input type="checkbox" disabled${checked}>${renderInlineMarkdown(task[2])}`;
                    } else {
                        content = renderInlineMarkdown(content);
                    }
                    items.push(`<li>${content}</li>`);
                    i++;
                }
                html.push(`<${tag}>${items.join('')}</${tag}>`);
                continue;
            }

            const paragraph = [line.trim()];
            i++;
            while (i < lines.length && lines[i].trim() !== '' && !isMarkdownBlockStart(lines[i])) {
                paragraph.push(lines[i].trim());
                i++;
            }
            html.push(`<p>${renderInlineMarkdown(paragraph.join('\n')).replace(/\n/g, '<br>')}</p>`);
        }

        return html.join('\n');
    }

    function updateMarkdownPreview() {
        previewEl.innerHTML = renderMarkdown(contentEl.value);
    }

    function setEditorMode(mode) {
        editorMode = mode;
        const preview = mode === 'preview';
        if (preview) {
            syncEditorToNode();
            updateMarkdownPreview();
        } else {
            contentEl.focus();
        }
        contentEl.hidden = preview;
        previewEl.hidden = !preview;
        editModeButton.classList.toggle('active', !preview);
        editModeButton.textContent = preview ? 'Edit' : 'Preview';
        editModeButton.setAttribute('aria-pressed', preview ? 'false' : 'true');
        editModeButton.title = preview ? 'Switch to edit mode' : 'Switch to preview mode';
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

            pushUndoState();
            const [movingNode] = sourceInfo.siblings.splice(sourceInfo.index, 1);
            if (mode === 'inside') {
                targetInfo.node.children = targetInfo.node.children || [];
                targetInfo.node.children.unshift(movingNode);
                collapsedIds.delete(targetInfo.node.id);
                saveCollapsedState();
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
                    selectNode(node.id);
                    if (collapsedIds.has(node.id)) {
                        collapsedIds.delete(node.id);
                    } else {
                        collapseSubtree(node);
                    }
                    saveCollapsedState();
                    markUiStateDirty();
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
        if (editorMode === 'preview') {
            updateMarkdownPreview();
        }
        renderTree();
    }

    async function loadDocument() {
        const response = await fetch(endpoint, { headers: headers() });
        if (!response.ok) {
            throw new Error(`Could not load document (${response.status})`);
        }
        documentData = await response.json();
        undoStack.length = 0;
        selectedId = null;
        loadCollapsedState();
        updateExportFormatDefault();
        selectNode(documentData.root.id, false);
        setEditorMode('preview');
        uiStateDirty = false;
        isDirty = false;
        setStatus(`Loaded ${activeFilePath() || 'MeeTree/tree.mtre'}`);
    }

    async function saveNow() {
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
        if (uiStateTimer) {
            clearTimeout(uiStateTimer);
            uiStateTimer = null;
        }
        if (!documentData) {
            return;
        }
        if (isSaving) {
            saveQueued = true;
            return;
        }
        syncEditorToNode();
        if (!isDirty && !uiStateDirty) {
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
                throw new Error(await responseErrorMessage(response, `Save failed (${response.status})`));
            }
            isDirty = false;
            uiStateDirty = false;
            setSaveState('Saved');
            setStatus(`Saved ${activeFilePath() || 'document'}`);
        } catch (error) {
            setSaveState('Autosave failed');
            setStatus(error.message);
        } finally {
            isSaving = false;
            if (saveQueued) {
                saveQueued = false;
                if (uiStateDirty) {
                    markUiStateDirty();
                } else {
                    markDirty(true);
                }
            }
        }
    }

    async function createNewTree() {
        const filename = window.prompt('New tree name', 'untitled');
        if (filename === null) {
            return;
        }
        await saveNow();
        setStatus('Creating new tree...');
        const response = await fetch(OC.generateUrl('/apps/meetree/document/new'), {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ filename }),
        });
        if (!response.ok) {
            throw new Error(await responseErrorMessage(response, `Could not create new tree (${response.status})`));
        }
        documentData = await response.json();
        undoStack.length = 0;
        selectedId = null;
        loadCollapsedState();
        updateExportFormatDefault();
        selectNode(documentData.root.id, false);
        setEditorMode('preview');
        uiStateDirty = false;
        isDirty = false;
        setSaveState('Saved');
        openMenu.hidden = true;
        setStatus(documentData.message || `Created ${activeFilePath()}`);
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
        pushUndoState();
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
        pushUndoState();
        const multiplier = direction === 'desc' ? -1 : 1;
        found.node.children.sort((left, right) => multiplier * (left.title || '').localeCompare(right.title || '', undefined, { sensitivity: 'base' }));
        renderTree();
        markDirty(true);
        setStatus(direction === 'desc' ? 'Sorted branch Z-A' : 'Sorted branch A-Z');
    }

    document.getElementById('meetree-sort-asc').addEventListener('click', () => sortSelectedChildren('asc'));
    document.getElementById('meetree-sort-desc').addEventListener('click', () => sortSelectedChildren('desc'));
    document.getElementById('meetree-expand-all').addEventListener('click', expandSelectedBranch);
    document.getElementById('meetree-collapse-all').addEventListener('click', collapseSelectedBranch);

    document.getElementById('meetree-delete-node').addEventListener('click', () => {
        const info = selectedInfo();
        if (!info || !info.parent || !info.siblings) {
            setStatus('The root node cannot be deleted');
            return;
        }
        if ((info.node.children || []).length > 0 && !window.confirm('Delete this node and all child nodes?')) {
            return;
        }
        pushUndoState();
        info.siblings.splice(info.index, 1);
        const nextSelection = info.siblings[info.index] || info.siblings[info.index - 1] || info.parent;
        selectNode(nextSelection.id);
        markDirty(true);
        setStatus('Node deleted');
    });

    document.getElementById('meetree-undo').addEventListener('click', undoLastChange);

    titleEl.addEventListener('input', () => {
        syncEditorToNode();
        renderTree();
        markDirty();
    });
    contentEl.addEventListener('input', () => {
        syncEditorToNode();
        if (editorMode === 'preview') {
            updateMarkdownPreview();
        }
        markDirty();
    });
    titleEl.addEventListener('blur', () => saveNow());
    contentEl.addEventListener('blur', () => saveNow());

    editModeButton.addEventListener('click', () => setEditorMode(editorMode === 'edit' ? 'preview' : 'edit'));

    document.getElementById('meetree-new-tree').addEventListener('click', () => {
        createNewTree().catch(error => setStatus(error.message));
    });

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
        undoStack.length = 0;
        selectedId = null;
        loadCollapsedState();
        updateExportFormatDefault();
        selectNode(documentData.root.id, false);
        setEditorMode('preview');
        uiStateDirty = false;
        isDirty = false;
        setSaveState('Saved');
        setStatus(`Imported ${file.name}`);
    });

    document.getElementById('meetree-export').addEventListener('click', async () => {
        await saveNow();
        if (exportFormatEl.value === 'json') {
            exportSelectedBranchJson();
            return;
        }
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
        undoStack.length = 0;
        selectedId = null;
        loadCollapsedState();
        updateExportFormatDefault();
        selectNode(documentData.root.id, false);
        setEditorMode('preview');
        uiStateDirty = false;
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
        if (uiStateDirty && !isDirty && !isSaving && !saveQueued) {
            saveNow();
            return;
        }
        if (isDirty || isSaving || saveQueued) {
            saveNow();
            event.preventDefault();
            event.returnValue = '';
        }
    });

    window.addEventListener('keydown', event => {
        if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z' && !isTextEditingTarget(event.target)) {
            event.preventDefault();
            undoLastChange();
        }
    });

    initDivider();
    loadDocument().catch(error => setStatus(error.message));
})();
