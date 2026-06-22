(function() {
    'use strict';

    const storageKey = 'meetree.standalone.document';
    const sidebarWidthStorageKey = 'meetree.sidebarWidth';
    const endMarker = '<end node> 5P9i0s8y19Z';
    const app = document.getElementById('meetree-app');
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
    const searchPanel = document.getElementById('meetree-search-panel');
    const searchPanelHeader = searchPanel.querySelector('.meetree-search-panel-header');
    const searchInput = document.getElementById('meetree-search-input');
    const searchResults = document.getElementById('meetree-search-results');
    let documentData = loadDocument();
    let selectedId = documentData.root.id;
    let draggedNodeId = null;
    let saveTimer = null;
    let uiStateTimer = null;
    let isDirty = false;
    let uiStateDirty = false;
    let isSaving = false;
    let saveQueued = false;
    let editorMode = 'preview';
    const undoStack = [];
    const collapsedIds = new Set();

    function newId() {
        return Math.random().toString(16).slice(2) + Date.now().toString(16);
    }

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

    function emptyDocument() {
        return {
            format: 'meetree',
            version: 1,
            source: { format: 'json', filename: 'tree.mtre' },
            root: {
                id: newId(),
                title: '<Untitled node>',
                content: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
                children: [],
            },
        };
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

    function markUiStateDirty() {
        uiStateDirty = true;
        if (uiStateTimer) {
            clearTimeout(uiStateTimer);
        }
        uiStateTimer = setTimeout(() => saveNow(), 5000);
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
                i++;
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
            html.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
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

    function loadDocument() {
        const stored = localStorage.getItem(storageKey);
        if (!stored) {
            return emptyDocument();
        }
        try {
            return normaliseDocument(JSON.parse(stored));
        } catch (error) {
            return emptyDocument();
        }
    }

    function normaliseDocument(document) {
        if (Array.isArray(document)) {
            document = { root: syntheticRoot('JSON document', document) };
        } else if (document && Array.isArray(document.root)) {
            document.root = syntheticRoot('JSON document', document.root);
        } else if (!document || typeof document.root !== 'object' || Array.isArray(document.root)) {
            document = { root: document || {} };
        }
        document.format = 'meetree';
        document.version = 1;
        document.source = document.source || { format: 'json', filename: 'tree.mtre' };
        document.uiState = document.uiState && typeof document.uiState === 'object' && !Array.isArray(document.uiState) ? document.uiState : {};
        document.uiState.collapsedIds = Array.isArray(document.uiState.collapsedIds) ? document.uiState.collapsedIds.filter(id => ['string', 'number', 'boolean'].includes(typeof id)).map(String) : [];
        document.root = normaliseNode(document.root, 'Untitled');
        return document;
    }

    function syntheticRoot(title, children) {
        return { id: newId(), title, content: '', children };
    }

    function normaliseNode(node, fallbackTitle) {
        node = node && typeof node === 'object' && !Array.isArray(node) ? node : {};
        const children = Array.isArray(node.children) ? node.children : Array.isArray(node.nodes) ? node.nodes : [];
        return {
            ...node,
            id: node.id ? String(node.id) : newId(),
            title: node.title || node.name ? String(node.title || node.name) : fallbackTitle,
            content: node.content || node.body || node.text ? String(node.content || node.body || node.text) : '',
            children: children.filter(child => child && typeof child === 'object').map(child => normaliseNode(child, 'Untitled')),
        };
    }

    function saveNow() {
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
        if (uiStateTimer) {
            clearTimeout(uiStateTimer);
            uiStateTimer = null;
        }
        if (isSaving) {
            saveQueued = true;
            return;
        }
        if (!isDirty && !uiStateDirty) {
            setSaveState('Saved');
            return;
        }
        isSaving = true;
        setSaveState('Saving...');
        syncEditorToNode();
        documentData.format = 'meetree';
        documentData.version = 1;
        documentData.source = documentData.source || { format: 'json', filename: 'tree.mtre' };
        localStorage.setItem(storageKey, JSON.stringify(documentData));
        isDirty = false;
        uiStateDirty = false;
        isSaving = false;
        renderTree();
        setSaveState('Saved');
        if (saveQueued) {
            saveQueued = false;
            if (uiStateDirty) {
                markUiStateDirty();
            } else {
                markDirty(true);
            }
        }
    }

    function createNewTree() {
        if (!window.confirm('Create a new tree? This replaces the standalone preview document in this browser.')) {
            return;
        }
        documentData = emptyDocument();
        documentData.source.filename = 'untitled.mtre';
        undoStack.length = 0;
        selectedId = documentData.root.id;
        loadCollapsedState();
        updateExportFormatDefault();
        selectNode(documentData.root.id, false);
        setEditorMode('preview');
        isDirty = true;
        saveNow();
        openMenu.hidden = true;
        setStatus('Created new standalone tree');
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

    function basenameWithoutKnownExtension(filename) {
        return (filename || 'meetree').replace(/\.(mtre|json|hjt|ctd)$/i, '');
    }

    function exportFilename(format) {
        const base = basenameWithoutKnownExtension(documentData.source && documentData.source.filename);
        if (format === 'json') {
            return `${base}.mtre`;
        }
        return `${base}.${format}`;
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
        link.click();
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

    function encodeHjt(documentToEncode) {
        let output = '<Treepad version 2.7>\n';
        function writeNode(node, depth) {
            const title = (node.title || 'Untitled').replace(/[\r\n]+/g, ' ');
            const content = (node.content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            output += `dt=Text\n<node>\n${title}\n${depth}\n${content}\n${endMarker}\n`;
            (node.children || []).forEach(child => writeNode(child, depth + 1));
        }
        writeNode(documentToEncode.root, 0);
        return output;
    }

    function decodeHjt(hjt) {
        const lines = hjt.split(/\r\n|\r|\n/);
        let index = lines[0] && lines[0].trim().startsWith('<Treepad') ? 1 : 0;
        const root = { id: newId(), title: 'HJT document', content: '', children: [] };
        const stack = [];
        let baseDepth = null;

        while (index < lines.length) {
            while (index < lines.length && lines[index].trim() === '') {
                index++;
            }
            if (index >= lines.length) {
                break;
            }
            if (lines[index].trim().toLowerCase() === 'dt=text') {
                index++;
            }
            if (lines[index] !== '<node>') {
                throw new Error(`Expected <node> at HJT line ${index + 1}`);
            }

            let title = lines[++index] || 'Untitled';
            let depthLine = lines[++index] || '0';
            while (!/^\d+$/.test(depthLine) && index + 1 < lines.length) {
                title += ` ${depthLine}`;
                depthLine = lines[++index];
            }
            let depth = Number.parseInt(depthLine, 10);
            if (baseDepth === null) {
                baseDepth = depth;
            }
            depth -= baseDepth;
            if (depth < 0) {
                baseDepth += depth;
                depth = 0;
            }
            index++;

            const content = [];
            while (index < lines.length && lines[index] !== endMarker) {
                content.push(lines[index]);
                index++;
            }
            if (index >= lines.length) {
                throw new Error('Missing HJT end node marker');
            }
            index++;

            const node = { id: newId(), title, content: content.join('\n'), children: [] };
            if (depth === 0) {
                root.children.push(node);
                stack[0] = node;
                stack.length = 1;
            } else {
                const parent = stack[depth - 1];
                if (!parent) {
                    throw new Error(`Invalid HJT depth at node "${title}"`);
                }
                parent.children.push(node);
                stack[depth] = node;
                stack.length = depth + 1;
            }
        }

        if (root.children.length === 0) {
            return emptyDocument();
        }
        return {
            format: 'meetree',
            version: 1,
            source: { format: 'hjt', filename: 'import.hjt' },
            root: root.children.length === 1 ? root.children[0] : root,
        };
    }

    function decodeCtd(ctd) {
        const xml = new DOMParser().parseFromString(ctd, 'application/xml');
        const rootEl = xml.documentElement;
        if (!rootEl || rootEl.nodeName !== 'cherrytree') {
            throw new Error('This is not a supported CherryTree CTD document');
        }

        function readNode(element) {
            const content = Array.from(element.children)
                .filter(child => child.nodeName === 'rich_text' || child.nodeName === 'codebox')
                .map(child => child.textContent || '')
                .filter(Boolean)
                .join('\n');
            return {
                id: element.getAttribute('unique_id') || newId(),
                title: element.getAttribute('name') || 'Untitled',
                content,
                children: Array.from(element.children).filter(child => child.nodeName === 'node').map(readNode),
                compat: {
                    cherrytree: {
                        unique_id: element.getAttribute('unique_id') || '',
                        prog_lang: element.getAttribute('prog_lang') || 'custom-colors',
                        tags: element.getAttribute('tags') || '',
                        readonly: element.getAttribute('readonly') || '0',
                    },
                },
            };
        }

        const nodes = Array.from(rootEl.children).filter(child => child.nodeName === 'node').map(readNode);
        const root = nodes.length === 1 ? nodes[0] : { id: newId(), title: 'CherryTree document', content: '', children: nodes };
        return { format: 'meetree', version: 1, source: { format: 'ctd', filename: 'import.ctd' }, root };
    }

    function encodeCtd(documentToEncode) {
        function escapeXml(value) {
            return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
        function writeNode(node, depth) {
            const compat = node.compat && node.compat.cherrytree ? node.compat.cherrytree : {};
            const id = String(compat.unique_id || node.id || '').replace(/\D+/g, '') || String(Date.now());
            const indent = '  '.repeat(depth);
            let xml = `${indent}<node unique_id="${escapeXml(id)}" master_id="0" name="${escapeXml(node.title || 'Untitled')}" prog_lang="${escapeXml(compat.prog_lang || 'custom-colors')}" tags="${escapeXml(compat.tags || '')}" readonly="${escapeXml(compat.readonly || '0')}" nosearch_me="0" nosearch_ch="0" custom_icon_id="0" is_bold="0" foreground="" ts_creation="${Math.floor(Date.now() / 1000)}" ts_lastsave="${Math.floor(Date.now() / 1000)}">\n`;
            if (node.content) {
                xml += `${indent}  <rich_text>${escapeXml(node.content)}</rich_text>\n`;
            }
            (node.children || []).forEach(child => {
                xml += writeNode(child, depth + 1);
            });
            xml += `${indent}</node>\n`;
            return xml;
        }
        return `<?xml version="1.0" ?>\n<cherrytree>\n${writeNode(documentToEncode.root, 1)}</cherrytree>\n`;
    }

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
        const results = [];
        if (query) {
            searchNode(documentData.root, [], query, {
                titles: document.getElementById('meetree-search-title').checked,
                content: document.getElementById('meetree-search-content').checked,
                caseSensitive: document.getElementById('meetree-search-case').checked,
                regex: document.getElementById('meetree-search-regex').checked,
            }, results);
        }

        searchResults.textContent = '';
        results.forEach(result => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'meetree-search-result';
            button.textContent = `${result.path} (${result.matches.join(', ')})`;
            button.addEventListener('click', () => selectNode(result.id));
            searchResults.appendChild(button);
        });
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

    document.getElementById('meetree-new-tree').addEventListener('click', createNewTree);

    document.getElementById('meetree-import-file').addEventListener('change', async event => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        try {
            const content = await file.text();
            if (file.name.toLowerCase().endsWith('.ctd')) {
                documentData = decodeCtd(content);
                documentData.source.filename = file.name;
            } else if (/\.(mtre|json)$/i.test(file.name)) {
                documentData = normaliseDocument(JSON.parse(content));
                documentData.source = documentData.source || { format: 'json', filename: file.name };
                documentData.source.format = documentData.source.format || 'json';
                documentData.source.filename = documentData.source.filename || file.name;
            } else {
                documentData = decodeHjt(content);
                documentData.source.filename = file.name;
            }
            undoStack.length = 0;
            selectedId = null;
            loadCollapsedState();
            updateExportFormatDefault();
            isDirty = true;
            saveNow();
            selectNode(documentData.root.id, false);
            setEditorMode('preview');
            setStatus(`Imported ${file.name}`);
        } catch (error) {
            setStatus(error.message);
        }
    });

    document.getElementById('meetree-export').addEventListener('click', () => {
        saveNow();
        const format = exportFormatEl.value;
        if (format === 'hjt') {
            downloadFile(encodeHjt(documentData), exportFilename(format), 'text/plain;charset=utf-8');
        } else if (format === 'ctd') {
            downloadFile(encodeCtd(documentData), exportFilename(format), 'application/xml;charset=utf-8');
        } else {
            exportSelectedBranchJson();
        }
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

    searchPanelHeader.addEventListener('pointerdown', event => {
        if (event.target.closest('button')) {
            return;
        }
        const rect = searchPanel.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        searchPanel.classList.add('dragging');
        searchPanelHeader.setPointerCapture(event.pointerId);

        function onMove(moveEvent) {
            const maxLeft = window.innerWidth - searchPanel.offsetWidth - 8;
            const maxTop = window.innerHeight - searchPanel.offsetHeight - 8;
            const left = Math.min(Math.max(8, moveEvent.clientX - offsetX), Math.max(8, maxLeft));
            const top = Math.min(Math.max(8, moveEvent.clientY - offsetY), Math.max(8, maxTop));
            searchPanel.style.left = `${left}px`;
            searchPanel.style.top = `${top}px`;
            searchPanel.style.right = 'auto';
        }

        function onUp(upEvent) {
            searchPanel.classList.remove('dragging');
            searchPanelHeader.releasePointerCapture(upEvent.pointerId);
            searchPanelHeader.removeEventListener('pointermove', onMove);
            searchPanelHeader.removeEventListener('pointerup', onUp);
            searchPanelHeader.removeEventListener('pointercancel', onUp);
        }

        searchPanelHeader.addEventListener('pointermove', onMove);
        searchPanelHeader.addEventListener('pointerup', onUp);
        searchPanelHeader.addEventListener('pointercancel', onUp);
    });

    searchInput.addEventListener('input', runSearch);
    ['meetree-search-title', 'meetree-search-content', 'meetree-search-case', 'meetree-search-regex'].forEach(id => {
        document.getElementById(id).addEventListener('change', runSearch);
    });

    updateExportFormatDefault();
    initDivider();
    loadCollapsedState();
    selectedId = null;
    selectNode(documentData.root.id, false);
    setEditorMode('preview');
    setSaveState('Saved');
    window.addEventListener('beforeunload', () => {
        if (isDirty || uiStateDirty) {
            saveNow();
        }
    });
    window.addEventListener('keydown', event => {
        if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z' && !isTextEditingTarget(event.target)) {
            event.preventDefault();
            undoLastChange();
        }
    });
    setStatus('Standalone preview loaded');
})();
