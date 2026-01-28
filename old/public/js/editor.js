// Editor & Search Functionality

function getEditorModeForFile(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const modeMap = {
        'md': 'markdown',
        'txt': 'markdown',
        'js': 'javascript',
        'json': { name: 'javascript', json: true },
        'html': 'htmlmixed',
        'htm': 'htmlmixed',
        'css': 'css',
        'py': 'python',
        'xml': 'xml'
    };
    return modeMap[ext] || 'markdown';
}

function initPanelEditor(index) {
    const textarea = document.getElementById('textarea-' + index);
    if (!textarea) return;

    const panel = panels[index];
    const mode = panel.file ? getEditorModeForFile(panel.file) : 'markdown';

    const editor = CodeMirror.fromTextArea(textarea, {
        mode: mode,
        theme: 'dracula',
        lineNumbers: true,
        lineWrapping: true,
        extraKeys: {
            'Ctrl-S': () => savePanel(index),
            'Cmd-S': () => savePanel(index),
            'Ctrl-F': () => toggleSearch(index),
            'Cmd-F': () => toggleSearch(index)
        }
    });

    editor.setValue(panels[index].content);
    editor.on('change', () => {
        panels[index].content = editor.getValue();
        updatePanelPreview(index);
        triggerAutoSave(index);
    });

    panels[index].editor = editor;
    updatePanelPreview(index);
}

function updatePanelPreview(index) {
    const content = document.getElementById('content-' + index);
    if (content) {
        const panel = panels[index];
        const ext = panel.file ? panel.file.split('.').pop().toLowerCase() : 'md';
        
        // Only render markdown for .md and .txt files
        if (ext === 'md' || ext === 'txt') {
            content.innerHTML = marked.parse(panels[index].content);
            
            // Render LaTeX equations
            if (typeof renderMathInElement !== 'undefined') {
                renderMathInElement(content, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\[', right: '\\]', display: true},
                        {left: '\\(', right: '\\)', display: false}
                    ],
                    throwOnError: false
                });
            }
        } else {
            // For non-markdown files, show a message in preview mode
            content.innerHTML = '<div style="padding: 20px; color: #888;">Vista previa no disponible para este tipo de archivo. Use el modo de edición.</div>';
        }
    }
}

// Search Logic
const searchState = {};

function toggleSearch(index) {
    const searchBar = document.getElementById(`search-bar-${index}`);
    const isVisible = searchBar.classList.contains('visible');
    
    if (isVisible) {
        searchBar.classList.remove('visible');
        clearSearch(index);
        if (panels[index].editor) panels[index].editor.focus();
    } else {
        searchBar.classList.add('visible');
        setTimeout(() => {
            const input = document.getElementById(`search-input-${index}`);
            input.focus();
            input.select();
            if (input.value) performSearch(index);
        }, 10);
    }
}

function clearSearch(index) {
    clearPreviewHighlights(index);
    if (panels[index].editor) {
        panels[index].editor.getAllMarks().forEach(mark => {
            if (mark.className === 'highlight-match' || mark.className === 'highlight-current') {
                mark.clear();
            }
        });
    }
    delete searchState[index];
    const countEl = document.getElementById(`search-count-${index}`);
    if (countEl) countEl.textContent = '0/0';
}

function clearPreviewHighlights(index) {
    const content = document.getElementById('content-' + index);
    if (!content) return;
    content.querySelectorAll('.preview-highlight').forEach(span => {
        span.replaceWith(document.createTextNode(span.textContent));
    });
}

function performSearch(index) {
    const query = document.getElementById(`search-input-${index}`).value;
    const editor = panels[index].editor;
    const panelMode = panels[index].mode;
    
    clearSearch(index);
    searchState[index] = { matches: [], current: -1 };

    if (!query) return;

    if (panelMode === 'preview') {
        searchState[index].mode = 'preview';
        searchState[index].matches = performPreviewSearch(index, query);
    } else {
        if (!editor) return;
        searchState[index].mode = 'editor';
        const cursor = editor.getSearchCursor(query);
        while (cursor.findNext()) {
            const from = cursor.from();
            const to = cursor.to();
            editor.markText(from, to, { className: 'highlight-match' });
            searchState[index].matches.push({ from, to });
        }
    }

    const count = searchState[index].matches.length;
    
    if (count > 0) {
        searchState[index].current = 0;
        highlightCurrent(index);
    }
    
    document.getElementById(`search-count-${index}`).textContent = 
        count > 0 ? `${searchState[index].current + 1}/${count}` : '0/0';
}

function performPreviewSearch(index, query) {
    const content = document.getElementById('content-' + index);
    if (!content) return [];

    const matches = [];
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            return node.nodeValue.includes(query) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
    });

    const textNodes = [];
    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    textNodes.forEach(node => {
        const text = node.nodeValue;
        let idx = 0;
        let hasMatch = false;
        const frag = document.createDocumentFragment();

        while (true) {
            const found = text.indexOf(query, idx);
            if (found === -1) break;
            hasMatch = true;
            if (found > idx) {
                frag.appendChild(document.createTextNode(text.slice(idx, found)));
            }
            const span = document.createElement('span');
            span.className = 'highlight-match preview-highlight';
            span.textContent = text.slice(found, found + query.length);
            frag.appendChild(span);
            matches.push(span);
            idx = found + query.length;
        }

        if (hasMatch) {
            if (idx < text.length) {
                frag.appendChild(document.createTextNode(text.slice(idx)));
            }
            node.parentNode.replaceChild(frag, node);
        }
    });

    return matches;
}

function highlightCurrent(index) {
    const state = searchState[index];
    if (!state || state.matches.length === 0) return;

    const editor = panels[index].editor;
    const panelMode = panels[index].mode;

    if (state.mode === 'preview') {
        document.querySelectorAll(`#content-${index} .preview-highlight`).forEach(el => {
            el.classList.remove('highlight-current');
            el.classList.add('highlight-match');
        });
        const matchEl = state.matches[state.current];
        if (matchEl) {
            matchEl.classList.remove('highlight-match');
            matchEl.classList.add('highlight-current');
            matchEl.scrollIntoView({ block: 'center', inline: 'nearest' });
        }
    } else {
        if (panelMode === 'preview') {
            // If user switched modes, keep search in editor but avoid switching view.
            return;
        }
    
        editor.getAllMarks().forEach(mark => {
            if (mark.className === 'highlight-current') mark.clear();
        });

        const match = state.matches[state.current];
        editor.markText(match.from, match.to, { className: 'highlight-current' });
        editor.setSelection(match.from, match.to);
        editor.scrollIntoView(match.from, 200);
    }

    document.getElementById(`search-count-${index}`).textContent = 
        `${state.current + 1}/${state.matches.length}`;
}

function findNext(index) {
    const state = searchState[index];
    if (!state || state.matches.length === 0) return;
    state.current = (state.current + 1) % state.matches.length;
    highlightCurrent(index);
}

function findPrev(index) {
    const state = searchState[index];
    if (!state || state.matches.length === 0) return;
    state.current = (state.current - 1 + state.matches.length) % state.matches.length;
    highlightCurrent(index);
}

// Export Functions
function downloadMD(index) {
    const panel = panels[index];
    if (!panel.file) return;

    const blob = new Blob([panel.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = panel.file.split('/').pop();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function copyForDocs(index) {
    if (typeof index === 'undefined') index = activePanel;
    
    const panel = panels[index];
    if (!panel.file) {
        showToast('Selecciona un archivo primero');
        return;
    }
    
    let contentElement = document.getElementById('content-' + index);
    if (!contentElement) return;

    const range = document.createRange();
    range.selectNode(contentElement);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    try {
        document.execCommand('copy');
        showToast('Copiado para Google Docs');
    } catch (err) {
        showToast('Error al copiar');
    }
    selection.removeAllRanges();
}

function exportPDF(index) {
    if (typeof index === 'undefined') index = activePanel;
    
    const panel = panels[index];
    if (!panel.file) {
        showToast('Selecciona un archivo primero');
        return;
    }

    const element = document.getElementById('content-' + index);
    if (!element) return;

    const filename = panel.file.split('/').pop().replace('.md', '.pdf');
    
    const opt = {
        margin: [15, 20, 15, 20],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
}

// Markdown Toolbar Functions
function insertMarkdown(index, before, after = '', placeholder = '') {
    const editor = panels[index].editor;
    if (!editor) return;
    
    const selection = editor.getSelection();
    const text = selection || placeholder;
    const newText = before + text + after;
    
    editor.replaceSelection(newText);
    
    // If there was no selection, select the placeholder text
    if (!selection && placeholder) {
        const cursor = editor.getCursor();
        editor.setSelection(
            { line: cursor.line, ch: cursor.ch - after.length - placeholder.length },
            { line: cursor.line, ch: cursor.ch - after.length }
        );
    }
    
    editor.focus();
}

function insertHeading(index, level) {
    const hashes = '#'.repeat(level);
    insertMarkdown(index, hashes + ' ', '', 'Título');
}

function insertBold(index) {
    insertMarkdown(index, '**', '**', 'texto en negrita');
}

function insertItalic(index) {
    insertMarkdown(index, '*', '*', 'texto en cursiva');
}

function insertLink(index) {
    insertMarkdown(index, '[', '](url)', 'texto del enlace');
}

function insertImage(index) {
    insertMarkdown(index, '![', '](url)', 'descripción de la imagen');
}

function insertCode(index) {
    insertMarkdown(index, '`', '`', 'código');
}

function insertCodeBlock(index) {
    insertMarkdown(index, '```\n', '\n```', 'código');
}

function insertList(index) {
    const editor = panels[index].editor;
    if (!editor) return;
    
    const cursor = editor.getCursor();
    editor.replaceRange('- ', cursor);
    editor.focus();
}

function insertNumberedList(index) {
    const editor = panels[index].editor;
    if (!editor) return;
    
    const cursor = editor.getCursor();
    editor.replaceRange('1. ', cursor);
    editor.focus();
}

function insertTable(index) {
    const tableMarkdown = `| Columna 1 | Columna 2 | Columna 3 |
|-----------|-----------|-----------|
| Celda 1   | Celda 2   | Celda 3   |
| Celda 4   | Celda 5   | Celda 6   |
`;
    
    const editor = panels[index].editor;
    if (!editor) return;
    
    const cursor = editor.getCursor();
    editor.replaceRange(tableMarkdown, cursor);
    editor.focus();
}

function insertLatex(index, inline = true) {
    if (inline) {
        insertMarkdown(index, '$', '$', 'fórmula LaTeX');
    } else {
        insertMarkdown(index, '$$\n', '\n$$', 'fórmula LaTeX en bloque');
    }
}

function insertQuote(index) {
    const editor = panels[index].editor;
    if (!editor) return;
    
    const cursor = editor.getCursor();
    editor.replaceRange('> ', cursor);
    editor.focus();
}

function insertHorizontalRule(index) {
    const editor = panels[index].editor;
    if (!editor) return;
    
    const cursor = editor.getCursor();
    editor.replaceRange('\n---\n', cursor);
    editor.focus();
}
