import admin from 'firebase-admin';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : null;

if (!admin.apps.length) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'udea-filosofia.firebasestorage.app'
    });
  } else {
    // Local dev with serviceAccountKey.json
    const fs = await import('fs');
    if (fs.existsSync('./serviceAccountKey.json')) {
      const localCred = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf-8'));
      admin.initializeApp({
        credential: admin.credential.cert(localCred),
        storageBucket: 'udea-filosofia.firebasestorage.app'
      });
    }
  }
}

export const auth = admin.auth();
export const storage = admin.storage();
export const db = admin.firestore();
export const bucket = storage.bucket();
