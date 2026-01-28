import firebase_admin
from firebase_admin import credentials, firestore, storage
import os
import json

# Setup env vars for local execution
if os.path.exists("serviceAccountKey.json"):
    cred = credentials.Certificate("serviceAccountKey.json")
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(cred, {
            'storageBucket': 'udea-filosofia.firebasestorage.app'
        })

db = firestore.client()
bucket = storage.bucket()

def migrate_groups_to_firestore():
    print("--- Reading JSON Config from Storage ---")
    blob = bucket.blob('system/groups.json')
    if not blob.exists():
        print("No system/groups.json found. Nothing to migrate.")
        return

    groups_data = json.loads(blob.download_as_text())
    
    print("--- Migrating to Firestore ---")
    batch = db.batch()
    
    for group_id, info in groups_data.items():
        doc_ref = db.collection('groups').document(group_id)
        # Add type field for cleaner querying later
        info['type'] = 'workgroup'
        batch.set(doc_ref, info)
        print(f"Queuing group: {info['name']}")

    try:
        batch.commit()
        print("✅ Successfully migrated groups to Firestore!")
        
        # Rename the json file to indicate it's deprecated/backup
        bucket.rename_blob(blob, 'system/groups.json.bak')
        print("Renamed system/groups.json to .bak")
        
    except Exception as e:
        print(f"❌ Firestore Error: {e}")
        print("Make sure Cloud Firestore API is enabled in Google Cloud Console.")

if __name__ == "__main__":
    migrate_groups_to_firestore()