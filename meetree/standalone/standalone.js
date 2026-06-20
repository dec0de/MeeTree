(function() {
    'use strict';

    const storageKey = 'meetree.standalone.document';
    const endMarker = '<end node> 5P9i0s8y19Z';
    const treeEl = document.getElementById('meetree-tree');
    const titleEl = document.getElementById('meetree-node-title');
    const contentEl = document.getElementById('meetree-node-content');
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
    let isDirty = false;
    let isSaving = false;
    let saveQueued = false;
    const collapsedIds = new Set();

    function newId() {
        return Math.random().toString(16).slice(2) + Date.now().toString(16);
    }

    function emptyDocument() {
        return {
            format: 'meetree',
            version: 1,
            source: { format: 'json', filename: 'tree.meetree.json' },
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

    function loadDocument() {
        const stored = localStorage.getItem(storageKey);
        if (!stored) {
            return emptyDocument();
        }
        try {
            return JSON.parse(stored);
        } catch (error) {
            return emptyDocument();
        }
    }

    function saveNow() {
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
        if (isSaving) {
            saveQueued = true;
            return;
        }
        isSaving = true;
        setSaveState('Saving...');
        syncEditorToNode();
        documentData.format = 'meetree';
        documentData.version = 1;
        documentData.source = documentData.source || { format: 'json', filename: 'tree.meetree.json' };
        localStorage.setItem(storageKey, JSON.stringify(documentData));
        isDirty = false;
        isSaving = false;
        renderTree();
        setSaveState('Saved');
        if (saveQueued) {
            saveQueued = false;
            markDirty(true);
        }
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

    function basenameWithoutKnownExtension(filename) {
        return (filename || 'meetree').replace(/\.(meetree\.json|json|hjt|ctd)$/i, '');
    }

    function exportFilename(format) {
        const base = basenameWithoutKnownExtension(documentData.source && documentData.source.filename);
        if (format === 'json') {
            return `${base}.meetree.json`;
        }
        return `${base}.${format}`;
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
            row.appendChild(guides);
            if (children.length > 0) {
                const toggle = document.createElement('button');
                toggle.type = 'button';
                toggle.className = 'meetree-tree-toggle';
                toggle.textContent = collapsedIds.has(node.id) ? '+' : '-';
                toggle.title = collapsedIds.has(node.id) ? 'Expand branch' : 'Collapse branch';
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
            if (collapsedIds.has(node.id)) {
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
        let root = null;
        const stack = [];

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
            const depth = Number.parseInt(depthLine, 10);
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
            if (depth === 0 || !root) {
                root = node;
                stack[0] = root;
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

        return root ? { format: 'meetree', version: 1, source: { format: 'hjt', filename: 'import.hjt' }, root } : emptyDocument();
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
        try {
            const content = await file.text();
            if (file.name.toLowerCase().endsWith('.ctd')) {
                documentData = decodeCtd(content);
                documentData.source.filename = file.name;
            } else if (file.name.toLowerCase().endsWith('.json')) {
                documentData = JSON.parse(content);
                documentData.source = documentData.source || { format: 'json', filename: file.name };
                documentData.source.format = documentData.source.format || 'json';
                documentData.source.filename = documentData.source.filename || file.name;
            } else {
                documentData = decodeHjt(content);
                documentData.source.filename = file.name;
            }
            selectedId = null;
            collapsedIds.clear();
            updateExportFormatDefault();
            isDirty = true;
            saveNow();
            selectNode(documentData.root.id, false);
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
            downloadFile(JSON.stringify(documentData, null, 2) + '\n', exportFilename(format), 'application/json;charset=utf-8');
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
    selectedId = null;
    selectNode(documentData.root.id, false);
    setSaveState('Saved');
    window.addEventListener('beforeunload', () => {
        if (isDirty) {
            saveNow();
        }
    });
    setStatus('Standalone preview loaded');
})();
