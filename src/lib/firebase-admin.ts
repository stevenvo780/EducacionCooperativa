import { cert, getApps, initializeApp, App, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT ? process.env.FIREBASE_SERVICE_ACCOUNT.trim() : undefined;
let serviceAccount;

try {
  if (serviceAccountStr) {
    serviceAccount = JSON.parse(serviceAccountStr);
  }
} catch (e) {
  console.error("Error parsing FIREBASE_SERVICE_ACCOUNT", e);
}

// Ensure bucket name is always usable; fall back to the default GCS naming.
const projectId = process.env.FIREBASE_PROJECT_ID ? process.env.FIREBASE_PROJECT_ID.trim() : undefined;
const configuredBucket = process.env.FIREBASE_STORAGE_BUCKET ? process.env.FIREBASE_STORAGE_BUCKET.trim() : undefined;
const fallbackBucket = projectId ? `${projectId}.appspot.com` : undefined;
const storageBucket = configuredBucket || fallbackBucket;

let app: App;

if (!getApps().length) {
  if (serviceAccount) {
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId,
      storageBucket,
    });
  } else {
    console.warn("FIREBASE_SERVICE_ACCOUNT missing; firebase-admin will use application default credentials.");
    app = initializeApp({ projectId, storageBucket });
  }
} else {
  app = getApp();
}

const adminAuth = getAuth(app);
const adminDb = getFirestore(app);
const adminStorage = getStorage(app);

export { adminAuth, adminDb, adminStorage };
