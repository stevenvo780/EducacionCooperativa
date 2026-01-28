// WebSocket Real-time Collaboration

let ws = null;
let wsReconnectTimer = null;
let currentClientId = null;

function initWebSocket() {
    if (!authToken) {
        console.log('No auth token, skipping WebSocket');
        return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('WebSocket connected');
            currentClientId = Math.random().toString(36).substring(7);
            clearTimeout(wsReconnectTimer);
            
            // Join current file rooms
            panels.forEach((panel, index) => {
                if (panel.file) {
                    joinFileRoom(panel.file);
                }
            });
            
            showToast('Conectado - Edición colaborativa activa', 'success');
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (e) {
                console.error('Error parsing WebSocket message:', e);
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        ws.onclose = () => {
            console.log('WebSocket disconnected');
            ws = null;
            
            // Try to reconnect after 3 seconds
            wsReconnectTimer = setTimeout(() => {
                console.log('Attempting to reconnect WebSocket...');
                initWebSocket();
            }, 3000);
        };
        
    } catch (error) {
        console.error('Error initializing WebSocket:', error);
    }
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'update':
            handleRemoteUpdate(data);
            break;
        case 'users':
            handleUsersUpdate(data);
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

function handleRemoteUpdate(data) {
    // Ignore updates from ourselves
    if (data.clientId === currentClientId) {
        return;
    }
    
    // Find panel with this file
    panels.forEach((panel, index) => {
        if (panel.file === data.file && panel.editor) {
            const editor = panel.editor;
            const currentCursor = editor.getCursor();
            const scrollInfo = editor.getScrollInfo();
            
            // Use a flag to prevent broadcasting during remote update
            panel._updatingFromRemote = true;
            
            // Update content
            editor.setValue(data.content);
            
            // Restore cursor position (validate it's within bounds)
            const lineCount = editor.lineCount();
            const validLine = Math.min(currentCursor.line, lineCount - 1);
            const lineLength = editor.getLine(validLine)?.length || 0;
            const validCh = Math.min(currentCursor.ch, lineLength);
            editor.setCursor({ line: validLine, ch: validCh });
            editor.scrollTo(scrollInfo.left, scrollInfo.top);
            
            // Update panel content and preview
            panels[index].content = data.content;
            updatePanelPreview(index);
            
            // Clear the flag after a short delay to avoid race conditions
            setTimeout(() => {
                panel._updatingFromRemote = false;
            }, 100);
        }
    });
}

function handleUsersUpdate(data) {
    // Update UI to show active users
    const userCount = data.users ? data.users.length : 0;
    console.log(`Active users: ${userCount}`);
    
    // You can add UI elements to show active users
    // For now, just log it
}

function joinFileRoom(filePath) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'join',
            file: filePath
        }));
    }
}

function broadcastUpdate(filePath, content) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'update',
            file: filePath,
            content: content,
            clientId: currentClientId
        }));
    }
}

// Disconnect WebSocket when page unloads
window.addEventListener('beforeunload', () => {
    if (ws) {
        ws.close();
    }
});
