#!/usr/bin/env python3
"""
Servidor unificado HTTP + WebSocket en el mismo puerto
Compatible con ngrok y túneles
"""

import asyncio
import json
import os
import mimetypes
import secrets
import string
from pathlib import Path
from aiohttp import web, WSMsgType

import firebase_admin
from firebase_admin import credentials, firestore

PORT = 8888

# Configuración de directorios
# Prioridad: Variable de entorno > Carpeta local 'documentos'
ENV_DOCS_DIR = os.getenv('DOCS_DIR')
if ENV_DOCS_DIR:
    BASE_DIR = Path(ENV_DOCS_DIR)
else:
    BASE_DIR = Path(__file__).parent / 'documentos'

if not BASE_DIR.exists():
    print(f"Advertencia: Directorio de documentos no encontrado en {BASE_DIR}")
    # Intentar crearlo si no existe para evitar errores
    try:
        BASE_DIR.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        print(f"No se pudo crear el directorio de documentos: {e}")

STATIC_DIR = Path(__file__).parent / 'public'
PASSWORD = os.getenv('PASSWORD', 'admin')
FIREBASE_CREDENTIALS_JSON = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
FIREBASE_AVAILABLE = False

if not firebase_admin._apps:
    try:
        if FIREBASE_CREDENTIALS_JSON:
            cred = credentials.Certificate(json.loads(FIREBASE_CREDENTIALS_JSON))
        elif Path("serviceAccountKey.json").exists():
            cred = credentials.Certificate("serviceAccountKey.json")
        else:
            cred = None
        if cred:
            firebase_admin.initialize_app(cred)
            FIREBASE_AVAILABLE = True
    except Exception as e:
        print(f"No se pudo inicializar Firebase: {e}")

db = firestore.client() if FIREBASE_AVAILABLE else None

# Fallback en memoria cuando no hay Firebase
MEM_SESSIONS = {}
MEM_INVITES = {}

# Estado global
clients = {}
file_rooms = {}

# Tipos MIME adicionales
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/json', '.json')
mimetypes.add_type('image/svg+xml', '.svg')


async def handle_index(request):
    """Sirve index.html"""
    return web.FileResponse(STATIC_DIR / 'index.html')


async def handle_static(request):
    """Sirve archivos estáticos"""
    filename = request.match_info.get('filename', '')
    filepath = STATIC_DIR / filename

    if filepath.exists() and filepath.is_file():
        return web.FileResponse(filepath)
    return web.Response(status=404, text='Not found')


async def handle_login(request):
    """Maneja el login devolviendo un token simple"""
    try:
        data = await request.json()
        email = (data.get('email') or '').strip().lower()
        password = data.get('password')
        invite = (data.get('invite') or '').strip()

        if not email:
            return web.json_response({'error': 'Email requerido'}, status=400)

        workspace = None

        # Validar invitación
        if invite:
            invite_data = fetch_invite(invite)
            if not invite_data:
                return web.json_response({'error': 'Invitación no válida'}, status=401)
            workspace = invite_data.get('workspace')

        if password != PASSWORD and not workspace:
            return web.json_response({'success': False, 'error': 'Password incorrecto'}, status=401)

        if not workspace:
            workspace = sanitize_workspace(email)

        token = create_session(email, workspace)
        ensure_user_workspace(workspace)

        return web.json_response({'success': True, 'token': token, 'workspace': workspace})
    except Exception:
        return web.json_response({'error': 'Error de proceso'}, status=400)


async def handle_api_files(request):
    """Lista archivos del usuario"""
    session = await require_auth(request)
    if not session:
        return web.json_response({'error': 'No autorizado'}, status=401)

    user_files = []
    allowed_exts = {'.md', '.txt', '.pdf', '.html', '.css', '.js', '.py', '.doc', '.docx', '.odt', '.png', '.jpg', '.jpeg', '.gif', '.svg'}
    user_root = BASE_DIR / session['workspace']

    for root, dirs, files in os.walk(user_root):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d != 'visor_markdown']

        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in allowed_exts:
                full_path = Path(root) / file
                rel_path = full_path.relative_to(BASE_DIR)
                user_files.append(str(rel_path))

    user_files.sort()
    return web.json_response(user_files)


async def handle_raw_file(request):
    """Sirve archivos crudos del usuario (PDFs, imágenes, etc)"""
    session = await require_auth(request, allow_query_token=True)
    if not session:
        return web.Response(status=401)

    rel_path = request.match_info.get('path', '')
    if not rel_path:
        return web.Response(status=404)

    full_path = (BASE_DIR / session['workspace'] / rel_path).resolve()
    if not str(full_path).startswith(str((BASE_DIR / session['workspace']).resolve())):
        return web.Response(status=403)

    if not full_path.exists():
        return web.Response(status=404)

    return web.FileResponse(full_path)


async def handle_api_file(request):
    """Lee contenido de un archivo"""
    session = await require_auth(request)
    if not session:
        return web.json_response({'error': 'No autorizado'}, status=401)

    rel_path = request.query.get('path', '')

    if not rel_path:
        return web.json_response({'error': 'Falta path'}, status=400)

    try:
        full_path = (BASE_DIR / session['workspace'] / rel_path).resolve()
        if not str(full_path).startswith(str((BASE_DIR / session['workspace']).resolve())):
            return web.json_response({'error': 'Acceso denegado'}, status=403)

        if not full_path.exists():
            return web.json_response({'error': 'No encontrado'}, status=404)

        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()

        return web.json_response({'content': content})

    except Exception as e:
        return web.json_response({'error': str(e)}, status=500)


async def handle_api_save(request):
    """Guarda un archivo"""
    session = await require_auth(request)
    if not session:
        return web.json_response({'error': 'No autorizado'}, status=401)
    try:
        data = await request.json()
        rel_path = data.get('path')
        content = data.get('content')

        if not rel_path or content is None:
            return web.json_response({'error': 'Faltan parámetros'}, status=400)

        full_path = (BASE_DIR / session['workspace'] / rel_path).resolve()
        if not str(full_path).startswith(str((BASE_DIR / session['workspace']).resolve())):
            return web.json_response({'error': 'Acceso denegado'}, status=403)

        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return web.json_response({'success': True})

    except Exception as e:
        return web.json_response({'error': str(e)}, status=500)

async def handle_api_upload(request):
    """Sube archivos"""
    session = await require_auth(request)
    if not session:
        return web.json_response({'error': 'No autorizado'}, status=401)
    try:
        reader = await request.multipart()
    except Exception:
        return web.json_response({'error': 'No multipart'}, status=400)

    count = 0
    upload_dir = BASE_DIR / session['workspace']
    upload_dir.mkdir(parents=True, exist_ok=True)

    while True:
        part = await reader.next()
        if part is None:
            break
        
        if part.name == 'files':
            filename = part.filename 
            if not filename: continue
            
            # Simple sanitization
            filename = os.path.basename(filename)
            filepath = upload_dir / filename
            
            with open(filepath, 'wb') as f:
                while True:
                    chunk = await part.read_chunk()
                    if not chunk:
                        break
                    f.write(chunk)
            count += 1
    
    return web.json_response({'count': count})

async def handle_websocket(request):
    """Maneja conexiones WebSocket"""
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    client_id = id(ws)
    clients[client_id] = {'ws': ws, 'file': None}
    print(f'Cliente conectado: {client_id}')

    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                try:
                    data = json.loads(msg.data)

                    if data['type'] == 'join':
                        file_path = data['file']
                        clients[client_id]['file'] = file_path

                        if file_path not in file_rooms:
                            file_rooms[file_path] = []
                        if client_id not in file_rooms[file_path]:
                            file_rooms[file_path].append(client_id)

                        await broadcast_users(file_path)

                    elif data['type'] == 'update':
                        file_path = data['file']

                        for cid in file_rooms.get(file_path, []):
                            if cid != client_id and cid in clients:
                                try:
                                    await clients[cid]['ws'].send_json({
                                        'type': 'update',
                                        'file': file_path,
                                        'content': data['content'],
                                        'clientId': data.get('clientId')
                                    })
                                except:
                                    pass

                except json.JSONDecodeError:
                    pass

            elif msg.type == WSMsgType.ERROR:
                print(f'Error WebSocket: {ws.exception()}')

    finally:
        file_path = clients.get(client_id, {}).get('file')
        if file_path and file_path in file_rooms:
            if client_id in file_rooms[file_path]:
                file_rooms[file_path].remove(client_id)
            await broadcast_users(file_path)

        if client_id in clients:
            del clients[client_id]
        print(f'Cliente desconectado: {client_id}')

    return ws


async def broadcast_users(file_path):
    """Envía lista de usuarios"""
    users = [{'id': str(cid)} for cid in file_rooms.get(file_path, []) if cid in clients]
    message = {'type': 'users', 'users': users}

    for cid in file_rooms.get(file_path, []):
        if cid in clients:
            try:
                await clients[cid]['ws'].send_json(message)
            except:
                pass


def create_app():
    """Crea la aplicación"""
    app = web.Application()

    # Rutas
    app.router.add_get('/', handle_index)
    app.router.add_get('/ws', handle_websocket)
    app.router.add_post('/api/login', handle_login)
    app.router.add_get('/api/files', handle_api_files)
    app.router.add_get('/api/file', handle_api_file)
    app.router.add_post('/api/save', handle_api_save)
    app.router.add_post('/api/upload', handle_api_upload)
    app.router.add_post('/api/invitations', handle_api_invite)
    app.router.add_post('/api/invitations/accept', handle_api_invite_accept)
    app.router.add_get('/raw/{path:.*}', handle_raw_file)
    app.router.add_get('/{filename:.*}', handle_static)

    return app


def main():
    print(f"""
╔════════════════════════════════════════════════════════════════╗
║      Visor & Editor Colaborativo de Markdown                   ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║   🌐 HTTP + WebSocket:  http://localhost:{PORT}                  ║
║                                                                ║
║   ✅ Compatible con ngrok (mismo puerto)                       ║
║   ✏️  Edita archivos en tiempo real                            ║
║   👥 Colabora con otros usuarios                               ║
║                                                                ║
║   Presiona Ctrl+C para detener                                 ║
╚════════════════════════════════════════════════════════════════╝
    """)

    app = create_app()
    web.run_app(app, host='0.0.0.0', port=PORT, print=None)


if __name__ == '__main__':
    main()

# Helpers de autenticación e invitaciones
def sanitize_workspace(email: str) -> str:
    safe = ''.join(ch if ch.isalnum() else '-' for ch in email.split('@')[0])
    return safe or 'workspace'

def create_session(email: str, workspace: str) -> str:
    token = secrets.token_urlsafe(24)
    record = {'email': email, 'workspace': workspace}
    if db:
        db.collection('sessions').document(token).set(record)
        db.collection('users').document(email).set({'workspace': workspace}, merge=True)
    else:
        MEM_SESSIONS[token] = record
    return token

def fetch_session(token: str):
    if not token:
        return None
    if db:
        doc = db.collection('sessions').document(token).get()
        return doc.to_dict() if doc.exists else None
    return MEM_SESSIONS.get(token)

def fetch_invite(code: str):
    if not code:
        return None
    if db:
        doc = db.collection('invites').document(code).get()
        return doc.to_dict() if doc.exists else None
    return MEM_INVITES.get(code)

def store_invite(code: str, data: dict):
    if db:
        db.collection('invites').document(code).set(data)
    else:
        MEM_INVITES[code] = data

async def require_auth(request, allow_query_token=False):
    token = None
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
    elif allow_query_token:
        token = request.query.get('token')
    session = fetch_session(token)
    return session

def ensure_user_workspace(workspace: str):
    path = BASE_DIR / workspace
    path.mkdir(parents=True, exist_ok=True)

async def handle_api_invite(request):
    session = await require_auth(request)
    if not session:
        return web.json_response({'error': 'No autorizado'}, status=401)
    data = await request.json()
    target = (data.get('email') or '').lower()
    code = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10))
    invite_data = {'workspace': session['workspace'], 'createdBy': session['email'], 'target': target}
    store_invite(code, invite_data)
    link = f"{request.url.scheme}://{request.host}/?invite={code}"
    return web.json_response({'code': code, 'link': link})

async def handle_api_invite_accept(request):
    data = await request.json()
    invite_code = data.get('invite')
    email = (data.get('email') or '').lower()
    invite_data = fetch_invite(invite_code)
    if not invite_data:
        return web.json_response({'error': 'Invitación no válida'}, status=400)
    workspace = invite_data.get('workspace')
    token = create_session(email or f'guest-{secrets.token_hex(3)}', workspace)
    ensure_user_workspace(workspace)
    return web.json_response({'token': token, 'workspace': workspace})
