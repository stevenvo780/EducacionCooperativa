document.addEventListener('DOMContentLoaded', () => {
    marked.use({
        breaks: true,
        gfm: true
    });

    if (authToken) {
        document.getElementById('login-overlay').style.display = 'none';
        loadFileList().then(() => {
            restoreSession();
            setupSidebarDragDrop();
        });
        updateWorkspaceInfo();
    } else {
        // Redirect to landing page if not authenticated
        // unless we're on a special page
        const currentPath = window.location.pathname;
        if (currentPath === '/index.html' || currentPath === '/') {
            window.location.href = '/landing.html';
        }
    }

    setupKeyboardShortcuts();
});

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveCurrentPanel();
        }

        // Switch panels with Ctrl+1,2,3,4
        if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '4') {
            const index = parseInt(e.key) - 1;
            if (index < gridSize) {
                e.preventDefault();
                setActivePanel(index);
            }
        }
    });
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

// Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((reg) => {
                console.log('SW registered:', reg.scope);
            })
            .catch((err) => {
                console.log('SW registration failed:', err);
            });
    });
}

// PWA Install
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Check if install button already exists
    if (!document.getElementById('pwa-install-btn')) {
        const installBtn = document.createElement('button');
        installBtn.id = 'pwa-install-btn';
        installBtn.className = 'btn btn-primary btn-sm';
        installBtn.innerHTML = '📲 Instalar App';
        installBtn.style.marginLeft = '10px';
        installBtn.onclick = async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    showToast('App instalada correctamente');
                }
                deferredPrompt = null;
                installBtn.remove();
            }
        };
        const toolbar = document.querySelector('.top-toolbar');
        // Insert before the last spacer or at end
        toolbar.appendChild(installBtn);
    }
});

async function createInvite() {
    if (!authToken) {
        showToast('Inicia sesión primero', 'error');
        return;
    }
    try {
        const email = prompt('Correo del invitado (opcional):') || '';
        const response = await fetch('/api/invitations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + authToken
            },
            body: JSON.stringify({ email })
        });
        if (!response.ok) throw new Error('No se pudo crear invitación');
        const data = await response.json();
        await navigator.clipboard.writeText(data.link);
        showToast('Enlace copiado al portapapeles');
    } catch (err) {
        console.error(err);
        showToast('Error al crear invitación', 'error');
    }
}

function updateWorkspaceInfo() {
    const ws = localStorage.getItem('workspace') || '';
    const el = document.getElementById('workspace-info');
    if (el) el.textContent = ws ? `Espacio: ${ws}` : '';
}
