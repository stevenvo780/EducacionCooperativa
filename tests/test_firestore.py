import firebase_admin
from firebase_admin import credentials, firestore
import os

if os.path.exists("serviceAccountKey.json"):
    cred = credentials.Certificate("serviceAccountKey.json")
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(cred)

db = firestore.client()

uid = "21VuZW4cdXd9jGKOgPa5YQegICw1" # Steven's UID

print(f"Querying for uid: {uid}")
docs = db.collection('groups').where('members', 'array_contains', uid).stream()

found = False
for doc in docs:
    print(f"Found group: {doc.id} => {doc.to_dict()}")
    found = True

if not found:
    print("No groups found.")
