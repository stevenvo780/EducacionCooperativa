import firebase_admin
from firebase_admin import credentials, storage
import os

# Configuración
UID_STEVEN = "21VuZW4cdXd9jGKOgPa5YQegICw1"
FOLDERS_TO_MOVE = [
    "Clases",
    "Diccionarios",
    "Ejercicios de traducción",
    "Gramáticas",
    "Libros de ejercicios"
]

if os.path.exists("serviceAccountKey.json"):
    cred = credentials.Certificate("serviceAccountKey.json")
    try:
        firebase_admin.get_app()
    except:
        firebase_admin.initialize_app(cred, {
            'storageBucket': 'udea-filosofia.firebasestorage.app'
        })

bucket = storage.bucket()

def move_resources():
    print(f"--- Moviendo recursos a users/{UID_STEVEN}/ ---")
    blobs = list(bucket.list_blobs())

    count = 0
    for blob in blobs:
        # Verificar si el archivo comienza con alguna de las carpetas objetivo
        for folder in FOLDERS_TO_MOVE:
            if blob.name.startswith(folder + "/"):
                new_name = f"users/{UID_STEVEN}/{blob.name}"
                print(f"Moviendo {blob.name} -> {new_name}")
                
                try:
                    bucket.copy_blob(blob, bucket, new_name)
                    blob.delete()
                    count += 1
                except Exception as e:
                    print(f"Error moviendo {blob.name}: {e}")
                break

    print(f"✅ Se movieron {count} recursos a tu carpeta personal.")

if __name__ == "__main__":
    move_resources()