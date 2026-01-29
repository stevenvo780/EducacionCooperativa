import time
import os
import sys
import logging
import hashlib
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import firebase_admin
from firebase_admin import credentials, storage

# Configuration
# Env vars provided by the Docker container
WORKER_TOKEN = os.getenv("WORKER_TOKEN", "unknown-worker")
BUCKET_NAME = os.getenv("FIREBASE_BUCKET", "udea-filosofia.firebasestorage.app") # Default or from env
SYNC_DIR = Path("/workspace")
POLL_INTERVAL = 10

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger("SyncAgent")

# Initialize Firebase (Implicit credentials from Google Cloud environment or mounted JSON)
# For the Docker container, we'll likely pass a service account via ENV or file mount
try:
    # Check for mounted credentials
    cred_path = "/app/serviceAccountKey.json"
    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred, {'storageBucket': BUCKET_NAME})
    else:
        # Fallback to default (ADC)
        firebase_admin.initialize_app(None, {'storageBucket': BUCKET_NAME})
    
    bucket = storage.bucket()
    logger.info(f"✅ Connected to Firebase Storage: {BUCKET_NAME}")
except Exception as e:
    logger.error(f"❌ Failed to initialize Firebase: {e}")
    sys.exit(1)

class SyncManager:
    def __init__(self):
        self.ignore_list = ['.git', '.DS_Store', 'node_modules', '.next']
        self._is_updating = False

    def get_remote_path(self, local_path):
        """Maps local /workspace/foo.txt -> user_uid/foo.txt"""
        rel = local_path.relative_to(SYNC_DIR)
        return f"{WORKER_TOKEN}/{rel}" # Using Worker Token as the User Root Folder

    def get_local_path(self, remote_blob_name):
        """Maps user_uid/foo.txt -> /workspace/foo.txt"""
        # Strip the user prefix
        if not remote_blob_name.startswith(f"{WORKER_TOKEN}/"):
            return None
        rel = remote_blob_name[len(WORKER_TOKEN)+1:]
        return SYNC_DIR / rel

    def upload_file(self, local_path):
        if self._is_updating: return
        try:
            blob_path = self.get_remote_path(local_path)
            blob = bucket.blob(blob_path)
            blob.upload_from_filename(str(local_path))
            logger.info(f"⬆️  Uploaded: {local_path.name}")
        except Exception as e:
            logger.error(f"Error uploading {local_path}: {e}")

    def download_file(self, blob):
        self._is_updating = True
        try:
            local_path = self.get_local_path(blob.name)
            if not local_path: return

            local_path.parent.mkdir(parents=True, exist_ok=True)
            blob.download_to_filename(str(local_path))
            logger.info(f"⬇️  Downloaded: {local_path.name}")
        except Exception as e:
            logger.error(f"Error downloading {blob.name}: {e}")
        finally:
            time.sleep(1) # Debounce
            self._is_updating = False

    def sync_cycle(self):
        """Polls for remote changes"""
        try:
            blobs = bucket.list_blobs(prefix=f"{WORKER_TOKEN}/")
            for blob in blobs:
                if blob.name.endswith('/'): continue
                
                local_path = self.get_local_path(blob.name)
                if not local_path: continue

                # Simple check: if local doesn't exist or remote md5 differs
                # Note: Firebase MD5 is base64, need to handle comparison carefully or just rely on existence/size for now
                if not local_path.exists():
                    self.download_file(blob)
                # TODO: Implement robust hash comparison
        except Exception as e:
            logger.error(f"Sync cycle error: {e}")

class LocalHandler(FileSystemEventHandler):
    def __init__(self, manager):
        self.manager = manager

    def on_modified(self, event):
        if event.is_directory: return
        self._process(Path(event.src_path))

    def on_created(self, event):
        if event.is_directory: return
        self._process(Path(event.src_path))

    def _process(self, path):
        if path.name.startswith('.'): return
        try:
            # Ensure path is within SYNC_DIR
            path.relative_to(SYNC_DIR) 
            logger.info(f"📝 Local change: {path.name}")
            self.manager.upload_file(path)
        except ValueError:
            pass

def run():
    if not SYNC_DIR.exists():
        logger.error(f"Sync directory {SYNC_DIR} does not exist!")
        return

    manager = SyncManager()
    observer = Observer()
    observer.schedule(LocalHandler(manager), str(SYNC_DIR), recursive=True)
    observer.start()
    logger.info(f"👀 Watching {SYNC_DIR}")

    try:
        while True:
            manager.sync_cycle()
            time.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

if __name__ == "__main__":
    run()
