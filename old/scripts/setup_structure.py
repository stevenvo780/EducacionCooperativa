import firebase_admin
from firebase_admin import credentials, auth, storage
import os
import json

# Setup env vars for local execution if needed
if os.path.exists("serviceAccountKey.json"):
    cred = credentials.Certificate("serviceAccountKey.json")
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(cred, {
            'storageBucket': 'udea-filosofia.firebasestorage.app'
        })

bucket = storage.bucket()

def list_users():
    print("--- Buscando Usuarios ---")
    page = auth.list_users()
    found_steven = None
    found_jero = None
    
    for user in page.users:
        print(f"Usuario encontrado: {user.email}")
        if user.email and 'steven' in user.email.lower():
            found_steven = user
        if user.email and 'jeronimocm009@gmail.com' in user.email.lower():
            found_jero = user

    return found_steven, found_jero

def create_group_structure_storage_only(steven_user, jero_user):
    if not steven_user:
        print("ERROR: No encontré al usuario 'Steven'. No puedo migrar.")
        return

    print(f"--- Iniciando Migración para {steven_user.email} ---")

    # 1. Definir la metadata de Grupos (JSON en Storage en vez de DB)
    groups_data = {
        'griego_cooperativo': {
            'name': 'Griego Cooperativo',
            'members': [steven_user.uid],
            'invitations': ['jeronimocm009@gmail.com'],
            'created_at': '2026-01-27'
        }
    }
    
    if jero_user:
        groups_data['griego_cooperativo']['members'].append(jero_user.uid)
        print(f"Añadiendo a Jeronimo ({jero_user.email}) al grupo.")

    # Guardar metadata en system/groups.json
    blob = bucket.blob('system/groups.json')
    blob.upload_from_string(json.dumps(groups_data, indent=2), content_type='application/json')
    print("✅ Archivo de configuración 'system/groups.json' creado.")

    # 2. Migración: Mover archivos raíz a la carpeta personal de Steven
    # users/{uid}/...
    print(f"--- Moviendo archivos raíz a users/{steven_user.uid}/ ---")
    blobs = list(bucket.list_blobs()) # Listar todo
    
    # Filtramos archivos que están en la raíz (no tienen / en su nombre)
    root_files = [b for b in blobs if '/' not in b.name]
    
    count = 0
    for blob in root_files:
        if blob.name == 'serviceAccountKey.json': continue 
        if blob.name.startswith('system/'): continue # No mover la config que acabamos de crear

        new_name = f"users/{steven_user.uid}/{blob.name}"
        print(f"Moviendo {blob.name} -> {new_name}")
        
        try:
            bucket.copy_blob(blob, bucket, new_name)
            blob.delete()
            count += 1
        except Exception as e:
            print(f"Error moviendo {blob.name}: {e}")

    print(f"✅ Se movieron {count} archivos a tu carpeta personal.")

    # 3. Crear Carpeta Compartida Física
    # Creamos un README en la carpeta del grupo para que exista
    shared_readme = f"groups/griego_cooperativo/LEEME.md"
    blob = bucket.blob(shared_readme)
    blob.upload_from_string(f"# Grupo Griego Cooperativo\n\nCarpeta compartida entre {steven_user.email} y jeronimocm009@gmail.com.\nToos los miembros del grupo pueden ver y editar estos archivos.")
    print("✅ Carpeta de grupo creada.")

if __name__ == "__main__":
    steven, jero = list_users()
    if steven:
        create_group_structure_storage_only(steven, jero)
    else:
        print("Steven no encontrado. Asegúrate de registrarte primero en la web.")
