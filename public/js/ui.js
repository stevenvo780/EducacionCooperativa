// UI Rendering & Interaction

function renderPanels() {
    const container = document.getElementById('panels-container');
    container.innerHTML = '';

    for (let i = 0; i < gridSize; i++) {
        const panel = panels[i];
        const div = document.createElement('div');
        div.className = 'panel' + (i === activePanel ? ' active' : '');
        div.id = 'panel-' + i;
        div.dataset.index = i;
        
        // Panel D&D
        div.ondragover = (e) => {
            e.preventDefault();
            div.classList.add('drag-over');
        };
        div.ondragleave = (e) => {
            div.classList.remove('drag-over');
        };
        div.ondrop = (e) => {
            e.preventDefault();
            div.classList.remove('drag-over');
            const path = e.dataTransfer.getData('text');
            if (path) loadFileToPanel(path, i);
        };
        
        div.onclick = (e) => {
            if (!e.target.closest('.panel-header button')) {
                setActivePanel(i);
            }
        };

        if (panel.file) {
            let contentHtml = '';
            const isMarkdown = panel.file && (panel.file.endsWith('.md') || panel.file.endsWith('.txt'));
            
            if (panel.type === 'pdf') {
                contentHtml = `
                    <div class="panel-content" style="background: #525659;">
                        <iframe src="/raw/${panel.file}" width="100%" height="100%" style="border:none;"></iframe>
                    </div>
                `;
            } else {
                contentHtml = `
                ${isMarkdown && panel.mode === 'edit' ? `
                <div class="markdown-toolbar" id="md-toolbar-${i}">
                    <div class="toolbar-group">
                        <button class="toolbar-btn" onclick="insertHeading(${i}, 1)" title="Título 1"><i class="fas fa-heading"></i>1</button>
                        <button class="toolbar-btn" onclick="insertHeading(${i}, 2)" title="Título 2"><i class="fas fa-heading"></i>2</button>
                        <button class="toolbar-btn" onclick="insertHeading(${i}, 3)" title="Título 3"><i class="fas fa-heading"></i>3</button>
                    </div>
                    <div class="toolbar-separator"></div>
                    <div class="toolbar-group">
                        <button class="toolbar-btn" onclick="insertBold(${i})" title="Negrita"><i class="fas fa-bold"></i></button>
                        <button class="toolbar-btn" onclick="insertItalic(${i})" title="Cursiva"><i class="fas fa-italic"></i></button>
                        <button class="toolbar-btn" onclick="insertCode(${i})" title="Código inline"><i class="fas fa-code"></i></button>
                    </div>
                    <div class="toolbar-separator"></div>
                    <div class="toolbar-group">
                        <button class="toolbar-btn" onclick="insertLink(${i})" title="Enlace"><i class="fas fa-link"></i></button>
                        <button class="toolbar-btn" onclick="insertImage(${i})" title="Imagen"><i class="fas fa-image"></i></button>
                        <button class="toolbar-btn" onclick="insertQuote(${i})" title="Cita"><i class="fas fa-quote-right"></i></button>
                    </div>
                    <div class="toolbar-separator"></div>
                    <div class="toolbar-group">
                        <button class="toolbar-btn" onclick="insertList(${i})" title="Lista"><i class="fas fa-list-ul"></i></button>
                        <button class="toolbar-btn" onclick="insertNumberedList(${i})" title="Lista numerada"><i class="fas fa-list-ol"></i></button>
                        <button class="toolbar-btn" onclick="insertTable(${i})" title="Tabla"><i class="fas fa-table"></i></button>
                    </div>
                    <div class="toolbar-separator"></div>
                    <div class="toolbar-group">
                        <button class="toolbar-btn" onclick="insertLatex(${i}, true)" title="Fórmula LaTeX inline">$x$</button>
                        <button class="toolbar-btn" onclick="insertLatex(${i}, false)" title="Fórmula LaTeX en bloque">$$</button>
                        <button class="toolbar-btn" onclick="insertCodeBlock(${i})" title="Bloque de código"><i class="fas fa-file-code"></i></button>
                    </div>
                </div>
                ` : ''}
                <div class="panel-content">
                    <div class="editor-pane ${panel.mode === 'preview' ? 'hidden' : ''}" id="editor-${i}">
                        <textarea id="textarea-${i}"></textarea>
                    </div>
                    <div class="preview-pane ${panel.mode === 'edit' ? 'hidden' : ''}" id="preview-${i}">
                        <div class="markdown-content" id="content-${i}"></div>
                    </div>
                </div>`;
            }

            div.innerHTML = `
                <div class="panel-header">
                    <span class="panel-title" title="${panel.file}"><i class="fas ${getFileIcon(panel.file)}"></i> ${panel.file.split('/').pop().replace('.md', '')}</span>
                    
                    <div class="panel-actions">
                        ${panel.type === 'pdf' ? '' : `
                        <button class="panel-btn" onclick="savePanel(${i})" title="Guardar (Ctrl+S)"><i class="fas fa-save"></i></button>
                        <button class="panel-btn" onclick="refreshPanel(${i})" title="Recargar contenido"><i class="fas fa-sync-alt"></i></button>
                        <button class="panel-btn" onclick="toggleSearch(${i})" title="Buscar en documento"><i class="fas fa-search"></i></button>
                        <div class="separator"></div>
                        `}
                        <button class="panel-btn" onclick="openDownloadModal(${i})" title="Descargar / Exportar"><i class="fas fa-download"></i></button>
                        
                        ${panel.type === 'pdf' ? '' : `
                        ${!panel.file.endsWith('.md') && (panel.file.endsWith('.txt') || panel.file.endsWith('.html') || panel.file.endsWith('.htm')) ? `
                        <button class="panel-btn" onclick="convertFileToMarkdown(${i})" title="Convertir a Markdown"><i class="fas fa-file-import"></i> MD</button>
                        ` : ''}
                        <div class="separator"></div>
                        <button class="panel-btn ${panel.mode === 'edit' ? 'active' : ''}" onclick="setPanelMode(${i}, 'edit')" title="Editar"><i class="fas fa-pen"></i></button>
                        <button class="panel-btn ${panel.mode === 'split' ? 'active' : ''}" onclick="setPanelMode(${i}, 'split')" title="Dividir"><i class="fas fa-columns"></i></button>
                        <button class="panel-btn ${panel.mode === 'preview' ? 'active' : ''}" onclick="setPanelMode(${i}, 'preview')" title="Vista previa"><i class="fas fa-eye"></i></button>
                        `}
                    </div>
                    
                    ${panel.type !== 'pdf' ? `<!-- Search Bar -->
                    <div class="panel-search-bar" id="search-bar-${i}">
                        <input type="text" 
                            class="search-input" 
                            id="search-input-${i}" 
                            placeholder="Buscar..." 
                            onkeydown="if(event.key === 'Enter') { event.shiftKey ? findPrev(${i}) : findNext(${i}) }"
                            oninput="performSearch(${i})">
                        <span class="search-count" id="search-count-${i}">0/0</span>
                        <button class="panel-btn" onclick="findPrev(${i})" title="Anterior (Shift+Enter)"><i class="fas fa-chevron-up"></i></button>
                        <button class="panel-btn" onclick="findNext(${i})" title="Siguiente (Enter)"><i class="fas fa-chevron-down"></i></button>
                        <button class="panel-btn" onclick="toggleSearch(${i})" title="Cerrar"><i class="fas fa-times"></i></button>
                    </div>` : ''}
                    
                    <button class="panel-close" onclick="closePanel(${i})" title="Cerrar"><i class="fas fa-times"></i></button>
                </div>
                
                ${contentHtml}
            `;
        } else {
            div.innerHTML = `
                <div class="empty-panel">
                    <div class="empty-panel-icon"><i class="far fa-file-alt"></i></div>
                    <div class="empty-panel-text">Arrastra un archivo aquí</div>
                </div>
            `;
        }

        container.appendChild(div);
        
        if (panel.file) {
             initPanelEditor(i);
        }
    }
    updateActivePanelInfo();
}

function getFileIcon(path) {
    if (!path) return 'fa-file';
    const ext = path.split('.').pop().toLowerCase();
    switch(ext) {
        case 'md': return 'fa-file-alt';
        case 'pdf': return 'fa-file-pdf';
        case 'txt': return 'fa-file-lines';
        case 'doc': case 'docx': return 'fa-file-word';
        case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': return 'fa-file-image';
        case 'js': return 'fa-file-code';
        case 'json': return 'fa-file-code';
        case 'html': case 'htm': return 'fa-file-code';
        case 'css': return 'fa-file-code';
        case 'py': return 'fa-file-code';
        case 'xml': return 'fa-file-code';
        default: return 'fa-file';
    }
}

function renderFileTree(files) {
    const tree = {};

    files.forEach(file => {
        const parts = file.split('/');
        let current = tree;

        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                current[parts[i]] = { __files: [] };
            }
            current = current[parts[i]];
        }

        if (!current.__files) current.__files = [];
        current.__files.push({ name: parts[parts.length - 1], path: file });
    });

    const container = document.getElementById('file-tree');
    container.innerHTML = renderFolder(tree);

    container.querySelectorAll('.folder-name').forEach(el => {
        el.onclick = () => {
           el.parentElement.classList.toggle('open');
           const icon = el.querySelector('.icon i');
           if (el.parentElement.classList.contains('open')) {
               icon.classList.remove('fa-folder');
               icon.classList.add('fa-folder-open');
           } else {
               icon.classList.add('fa-folder');
               icon.classList.remove('fa-folder-open');
           }
        };
    });

    container.querySelectorAll('.file-item').forEach(el => {
        el.onclick = () => loadFileToPanel(el.dataset.path, activePanel);
    });
}

function renderFolder(obj) {
    let html = '';

    for (const key of Object.keys(obj).sort()) {
        if (key === '__files') continue;
        html += `
            <div class="folder">
                <div class="folder-name"><span class="icon"><i class="fas fa-folder"></i></span> ${key}</div>
                <div class="folder-contents">${renderFolder(obj[key])}</div>
            </div>
        `;
    }

    if (obj.__files) {
        obj.__files.sort((a, b) => a.name.localeCompare(b.name)).forEach(file => {
            html += `
                <div class="file-item" 
                     data-path="${file.path}" 
                     draggable="true" 
                     ondragstart="event.dataTransfer.setData('text', '${file.path}')">
                     <i class="fas ${getFileIcon(file.path)}"></i> ${file.name.replace('.md', '')}
                </div>`;
        });
    }

    return html;
}

function closePanel(index) {
    panels[index] = { file: null, content: '', editor: null, mode: 'preview' };
    renderPanels();
    saveSession();
}

function setGrid(size) {
    gridSize = size;
    const container = document.getElementById('panels-container');
    container.className = 'panels-container grid-' + size;

    document.querySelectorAll('.grid-selector .btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.grid) === size);
    });

    while (panels.length < size) {
        panels.push({ file: null, content: '', editor: null, mode: 'preview' });
    }

    renderPanels();
    saveSession();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const btn = document.getElementById('sidebar-toggle');
    sidebar.classList.toggle('collapsed');
    const isCollapsed = sidebar.classList.contains('collapsed');
    btn.innerHTML = isCollapsed ? '<i class="fas fa-chevron-right"></i>' : '<i class="fas fa-chevron-left"></i>';
    btn.style.left = isCollapsed ? '0' : 'calc(var(--sidebar-width) - 4px)';
}

function setActivePanel(index) {
    activePanel = index;
    document.querySelectorAll('.panel').forEach((p, i) => {
        p.classList.toggle('active', i === index);
        p.style.outline = i === index ? '2px solid var(--primary)' : 'none';
    });
    updateActivePanelInfo();
    saveSession();
}

function updateActivePanelInfo() {
    const info = document.getElementById('active-panel-info');
    const panel = panels[activePanel];
    if (panel && panel.file) {
        info.textContent = `Panel ${activePanel + 1}: ${panel.file.split('/').pop()}`;
    } else {
        info.textContent = `Panel activo: ${activePanel + 1}`;
    }
}

function setPanelMode(index, mode) {
    panels[index].mode = mode;

    const editorPane = document.getElementById('editor-' + index);
    const previewPane = document.getElementById('preview-' + index);

    if (editorPane && previewPane) {
        editorPane.classList.toggle('hidden', mode === 'preview');
        previewPane.classList.toggle('hidden', mode === 'edit');
        if (panels[index].editor) panels[index].editor.refresh();
    }

    const panel = document.getElementById('panel-' + index);
    if (panel) {
        panel.querySelectorAll('.panel-actions .panel-btn').forEach(btn => {
           if (btn.querySelector('.fa-pen') || btn.querySelector('.fa-columns') || btn.querySelector('.fa-eye')) btn.classList.remove('active');
        });
        
        const modeIcons = { 'edit': 'fa-pen', 'split': 'fa-columns', 'preview': 'fa-eye' };
        const iconClass = modeIcons[mode];
        const activeBtn = panel.querySelector(`.panel-actions .panel-btn .${iconClass}`)?.parentElement;
        if (activeBtn) activeBtn.classList.add('active');
    }
    saveSession();
}

// Download Modal
function openDownloadModal(index) {
    panelForDownload = index;
    const overlay = document.getElementById('download-modal-overlay');
    const modal = document.getElementById('download-modal');
    overlay.style.display = 'flex';
    setTimeout(() => modal.classList.add('open'), 10);
}

function closeDownloadModal(e) {
    if (e && e.target.id !== 'download-modal-overlay' && !e.target.closest('.modal-close')) return;
    
    const overlay = document.getElementById('download-modal-overlay');
    const modal = document.getElementById('download-modal');
    modal.classList.remove('open');
    setTimeout(() => {
        overlay.style.display = 'none';
        panelForDownload = null;
    }, 200);
}

function executeDownload(type) {
    if (panelForDownload === null) return;
    switch(type) {
        case 'md': downloadMD(panelForDownload); break;
        case 'pdf': exportPDF(panelForDownload); break;
        case 'copy': copyForDocs(panelForDownload); break;
    }
    closeDownloadModal({ target: { id: 'download-modal-overlay' } });
}

function setupSidebarDragDrop() {
    const sidebar = document.getElementById('sidebar');
    if(!sidebar) return;
    
    sidebar.ondragover = (e) => {
        e.preventDefault();
        sidebar.classList.add('drag-over');
    };
    
    sidebar.ondragleave = (e) => {
        sidebar.classList.remove('drag-over');
    };
    
    sidebar.ondrop = (e) => {
        e.preventDefault();
        sidebar.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files);
        }
    };
}

function toggleToolbar() {
    const toolbar = document.querySelector('.top-toolbar');
    const btn = document.getElementById('toolbar-toggle');
    toolbar.classList.toggle('collapsed');
    const isCollapsed = toolbar.classList.contains('collapsed');
    btn.innerHTML = isCollapsed ? '<i class="fas fa-chevron-down"></i>' : '<i class="fas fa-chevron-up"></i>';
}

function collapseAllFolders() {
    document.querySelectorAll('.file-tree .folder').forEach(folder => {
        folder.classList.remove('open');
        const icon = folder.querySelector('.folder-name .icon i');
        if (icon) {
            icon.classList.remove('fa-folder-open');
            icon.classList.add('fa-folder');
        }
    });
}
