// File Format Conversion

async function convertFileToMarkdown(panelIndex) {
    const panel = panels[panelIndex];
    if (!panel.file) {
        showToast('No hay archivo abierto', 'error');
        return;
    }
    
    const ext = panel.file.split('.').pop().toLowerCase();
    
    // Already markdown
    if (ext === 'md') {
        showToast('El archivo ya está en formato Markdown', 'info');
        return;
    }
    
    // Check if conversion is supported
    const supportedFormats = ['txt', 'html', 'htm'];
    if (!supportedFormats.includes(ext)) {
        showToast(`Conversión desde .${ext} no soportada aún. Formatos soportados: ${supportedFormats.join(', ')}`, 'warning');
        return;
    }
    
    const originalContent = panel.content;
    let convertedContent = '';
    
    try {
        switch (ext) {
            case 'txt':
                // Simple text to markdown - wrap in paragraphs
                convertedContent = convertTextToMarkdown(originalContent);
                break;
            case 'html':
            case 'htm':
                convertedContent = convertHtmlToMarkdown(originalContent);
                break;
            default:
                showToast(`Formato .${ext} no soportado`, 'error');
                return;
        }
        
        // Create new filename
        const newFileName = panel.file.replace(/\.[^/.]+$/, '') + '.md';
        
        // Confirm with user
        const confirmed = confirm(`¿Convertir "${panel.file}" a "${newFileName}"?\n\nEsto creará un nuevo archivo en formato Markdown.`);
        if (!confirmed) {
            return;
        }
        
        // Save the new file
        await saveConvertedFile(newFileName, convertedContent);
        
        // Load the new file in the panel
        await loadFileToPanel(newFileName, panelIndex);
        
        showToast(`Archivo convertido exitosamente a ${newFileName}`, 'success');
        
    } catch (error) {
        console.error('Error converting file:', error);
        showToast('Error al convertir el archivo', 'error');
    }
}

function convertTextToMarkdown(text) {
    // Split into lines
    const lines = text.split('\n');
    let markdown = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line === '') {
            markdown += '\n';
            continue;
        }
        
        // Detect headings (lines that are all caps or very short)
        if (line === line.toUpperCase() && line.length < 50 && line.length > 3) {
            markdown += `## ${line}\n\n`;
        }
        // Detect list items
        else if (line.match(/^[-*•]\s/)) {
            markdown += line.replace(/^[-*•]\s/, '- ') + '\n';
        }
        else if (line.match(/^\d+[.)]\s/)) {
            markdown += line.replace(/^(\d+)[.)]\s/, '$1. ') + '\n';
        }
        // Regular paragraph
        else {
            markdown += line + '\n\n';
        }
    }
    
    return markdown;
}

function convertHtmlToMarkdown(html) {
    // Create a temporary div to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    return htmlNodeToMarkdown(temp);
}

function htmlNodeToMarkdown(node) {
    let markdown = '';
    
    for (let child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
            markdown += child.textContent;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            const tag = child.tagName.toLowerCase();
            
            switch (tag) {
                case 'h1':
                    markdown += `# ${child.textContent}\n\n`;
                    break;
                case 'h2':
                    markdown += `## ${child.textContent}\n\n`;
                    break;
                case 'h3':
                    markdown += `### ${child.textContent}\n\n`;
                    break;
                case 'h4':
                    markdown += `#### ${child.textContent}\n\n`;
                    break;
                case 'h5':
                    markdown += `##### ${child.textContent}\n\n`;
                    break;
                case 'h6':
                    markdown += `###### ${child.textContent}\n\n`;
                    break;
                case 'p':
                    markdown += `${htmlNodeToMarkdown(child)}\n\n`;
                    break;
                case 'strong':
                case 'b':
                    markdown += `**${child.textContent}**`;
                    break;
                case 'em':
                case 'i':
                    markdown += `*${child.textContent}*`;
                    break;
                case 'code':
                    markdown += `\`${child.textContent}\``;
                    break;
                case 'pre':
                    const codeContent = child.querySelector('code') ? child.querySelector('code').textContent : child.textContent;
                    markdown += `\`\`\`\n${codeContent}\n\`\`\`\n\n`;
                    break;
                case 'a':
                    const href = child.getAttribute('href') || '#';
                    markdown += `[${child.textContent}](${href})`;
                    break;
                case 'img':
                    const src = child.getAttribute('src') || '';
                    const alt = child.getAttribute('alt') || '';
                    markdown += `![${alt}](${src})`;
                    break;
                case 'ul':
                    for (let li of child.querySelectorAll('li')) {
                        markdown += `- ${li.textContent}\n`;
                    }
                    markdown += '\n';
                    break;
                case 'ol':
                    let index = 1;
                    for (let li of child.querySelectorAll('li')) {
                        markdown += `${index}. ${li.textContent}\n`;
                        index++;
                    }
                    markdown += '\n';
                    break;
                case 'blockquote':
                    const lines = child.textContent.split('\n');
                    lines.forEach(line => {
                        if (line.trim()) {
                            markdown += `> ${line}\n`;
                        }
                    });
                    markdown += '\n';
                    break;
                case 'br':
                    markdown += '\n';
                    break;
                case 'hr':
                    markdown += '\n---\n\n';
                    break;
                default:
                    // For other tags, just get the text content
                    markdown += htmlNodeToMarkdown(child);
            }
        }
    }
    
    return markdown;
}

async function saveConvertedFile(fileName, content) {
    if (!authToken) {
        throw new Error('No autorizado');
    }
    
    const response = await fetch('/api/save', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + authToken
        },
        body: JSON.stringify({
            path: fileName,
            content: content
        })
    });
    
    if (!response.ok) {
        throw new Error('Error al guardar el archivo');
    }
    
    // Refresh file list
    await loadFileList();
}
