from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, storage, auth, firestore
import os
import json
import base64
from functools import wraps

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# Configuración desde variables de entorno
FIREBASE_CREDENTIALS_JSON = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
BUCKET_NAME = os.environ.get('FIREBASE_STORAGE_BUCKET', 'udea-filosofia.firebasestorage.app')
APP_PASSWORD = os.environ.get('APP_PASSWORD')

# Inicializar Firebase
if not firebase_admin._apps:
    if FIREBASE_CREDENTIALS_JSON:
        cred_dict = json.loads(FIREBASE_CREDENTIALS_JSON)
        cred = credentials.Certificate(cred_dict)
    else:
        # Fallback para desarrollo local si existe el archivo
        cred = credentials.Certificate("serviceAccountKey.json") if os.path.exists("serviceAccountKey.json") else None
    
    if cred:
        firebase_admin.initialize_app(cred, {
            'storageBucket': BUCKET_NAME
        })

# Cliente Firestore
try:
    db = firestore.client()
except Exception as e:
    print(f"Warning: Firestore init failed: {e}")
    db = None

def check_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'No autorizado'}), 401
        
        try:
            token = auth_header.split(' ')[1]
        except IndexError:
            return jsonify({'error': 'Formato de token inválido'}), 401

        if token == APP_PASSWORD:
             return f(*args, **kwargs)
        
        try:
            # Verify Firebase ID Token
            decoded_token = auth.verify_id_token(token)
            request.user = decoded_token # Attach user info to request
            return f(*args, **kwargs)
        except:
             return jsonify({'error': 'Token inválido'}), 401
    return decorated

@app.route('/api/auth/google', methods=['POST'])
def google_auth():
    data = request.json
    id_token = data.get('idToken')
    if not id_token:
        return jsonify({'error': 'Falta idToken'}), 400
    
    try:
        decoded_token = auth.verify_id_token(id_token)
        return jsonify({
            'success': True,
            'token': APP_PASSWORD,
            'workspace': 'default',
            'user': {'uid': decoded_token['uid'], 'email': decoded_token.get('email')}
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 401

@app.route('/api/register', methods=['POST'])
def register_user():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    name = data.get('name')
    
    if not email or not password:
        return jsonify({'error': 'Faltan datos'}), 400
        
    try:
        user = auth.create_user(
            email=email,
            password=password,
            display_name=name,
            email_verified=False
        )
        return jsonify({
            'success': True,
            'token': APP_PASSWORD,
            'workspace': 'default',
            'userId': user.uid
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    password = data.get('password')
    if password == APP_PASSWORD:
        return jsonify({'token': password}) # En un caso real usaría JWT, aquí simple
    return jsonify({'error': 'Credenciales inválidas'}), 401

def get_user_groups(uid, email):
    """
    Consulta Firestore para obtener los grupos del usuario
    """
    if not db: return []
    
    try:
        user_groups = []
        
        # 1. Grupos donde es miembro directo
        member_query = db.collection('groups').where('members', 'array_contains', uid).stream()
        for doc in member_query:
            g = doc.to_dict()
            g['id'] = doc.id
            user_groups.append(g)
            
        # 2. Grupos donde está invitado (opcional, si queremos mostrar invitaciones pendientes)
        if email:
            invite_query = db.collection('groups').where('invitations', 'array_contains', email).stream()
            for doc in invite_query:
                # Evitar duplicados si ya está en la lista (por error de datos)
                if not any(g['id'] == doc.id for g in user_groups):
                    g = doc.to_dict()
                    g['id'] = doc.id
                    g['is_invite'] = True # Flag para frontend si se quiere usar
                    user_groups.append(g)

        return user_groups
    except Exception as e:
        print(f"Error reading groups from Firestore: {e}")
        return []

def resolve_storage_path(display_path, uid, user_groups):
    """
    Convierte rutas de visualización (Frontend) a rutas reales de Storage (Backend)
    Estructura visual esperada:
    - /Mis Archivos/... -> users/{uid}/...
    - /Grupos/{group_name}/... -> groups/{group_id}/...
    """
    parts = display_path.strip('/').split('/')
    root = parts[0]
    
    if root == 'Mis Archivos' or root == 'users': # users compatibility
        return f"users/{uid}/{'/'.join(parts[1:])}"
    
    if root == 'Grupos':
        if len(parts) < 2: return None
        group_name = parts[1]
        
        # Buscar ID del grupo por nombre
        target_group = next((g for g in user_groups if g['name'] == group_name), None)
        if not target_group:
            return None
            
        return f"groups/{target_group['id']}/{'/'.join(parts[2:])}"

    # Fallback para compatibilidad legacy (admin) o rutas directas si se permite
    return display_path

@app.route('/api/files', methods=['GET'])
@check_auth
def list_files():
    try:
        bucket = storage.bucket()
        
        # Determinar UID
        uid = getattr(request, 'user', {}).get('uid')
        email = getattr(request, 'user', {}).get('email')
        
        # Si es legacy password, dar acceso a todo (admin mode) o fallar
        # Por ahora asumimos que si no hay UID es admin viejo o test
        if not uid: 
            blobs = bucket.list_blobs()
            return jsonify([b.name for b in blobs if b.name.endswith('.md')])

        # 1. Obtener Grupos
        groups = get_user_groups(uid, email)
        
        files = []
        
        # 2. Listar Archivos Personales (users/{uid}/)
        prefix_personal = f"users/{uid}/"
        blobs_personal = bucket.list_blobs(prefix=prefix_personal)
        
        for blob in blobs_personal:
            # Convertir a Display Path: Mis Archivos/...
            relative_name = blob.name[len(prefix_personal):]
            if relative_name and not relative_name.endswith('/'): # Ignore folders placeholders
                files.append(f"Mis Archivos/{relative_name}")
        
        # 3. Listar Archivos de Grupos
        for group in groups:
            prefix_group = f"groups/{group['id']}/"
            blobs_group = bucket.list_blobs(prefix=prefix_group)
            
            for blob in blobs_group:
                relative_name = blob.name[len(prefix_group):]
                if relative_name and not relative_name.endswith('/'):
                    files.append(f"Grupos/{group['name']}/{relative_name}")
        
        files.sort()
        return jsonify(files)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/file', methods=['GET'])
@check_auth
def get_file():
    path = request.args.get('path')
    if not path:
        return jsonify({'error': 'Falta path'}), 400
    
    uid = getattr(request, 'user', {}).get('uid')
    email = getattr(request, 'user', {}).get('email')
    
    if uid:
        groups = get_user_groups(uid, email)
        real_path = resolve_storage_path(path, uid, groups)
        if not real_path:
             return jsonify({'error': 'Ruta inválida o sin acceso'}), 403
    else:
        real_path = path # Legacy/Admin access

    try:
        bucket = storage.bucket()
        blob = bucket.blob(real_path)
        if not blob.exists():
            return jsonify({'error': 'No encontrado'}), 404
        
        content = blob.download_as_text()
        return jsonify({'content': content})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/save', methods=['POST'])
@check_auth
def save_file():
    try:
        data = request.json
        path = data.get('path')
        content = data.get('content')
        
        if not path or content is None:
            return jsonify({'error': 'Datos incompletos'}), 400
        
        uid = getattr(request, 'user', {}).get('uid')
        email = getattr(request, 'user', {}).get('email')

        if uid:
            groups = get_user_groups(uid, email)
            real_path = resolve_storage_path(path, uid, groups)
            if not real_path:
                return jsonify({'error': 'No tienes permiso para guardar aquí'}), 403
        else:
            real_path = path

        bucket = storage.bucket()
        blob = bucket.blob(real_path)
        blob.upload_from_string(content)
        
        return jsonify({'success': True})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Error handler for Vercel
@app.errorhandler(500)
def server_error(e):
    return jsonify(error=str(e)), 500

@app.route('/api/debug-storage', methods=['GET'])
def debug_storage():
    try:
        bucket = storage.bucket()
        # Intentar listar 1 archivo para verificar permisos
        blobs = list(bucket.list_blobs(max_results=1))
        return jsonify({'bucket': bucket.name, 'connection': 'ok'})
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500

if __name__ == '__main__':
    app.run(debug=True, port=8888)
