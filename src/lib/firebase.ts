import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth, signInWithCustomToken, setPersistence, browserLocalPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore, Firestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';
import { env } from '@/lib/env';

// Firebase Storage NO se usa en Agora — los blobs viven en MinIO (NAS).
// Mantenemos sólo Auth + Firestore + RTDB de Firebase.
const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID();
const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY(),
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN(),
  projectId,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID(),
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID(),
  databaseURL: projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : undefined
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let rtdb: Database | null = null;
let googleProvider: GoogleAuthProvider | null = null;

function getFirebaseApp(): FirebaseApp {
  if (typeof window === 'undefined') {
    return {} as FirebaseApp;
  }

  if (!app) {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  }
  return app;
}

function getFirebaseAuth(): Auth {
  if (typeof window === 'undefined') {
    return {} as Auth;
  }
  if (!auth) {
    auth = getAuth(getFirebaseApp());
    setPersistence(auth, indexedDBLocalPersistence).catch(() => {
      setPersistence(auth!, browserLocalPersistence).catch(() => undefined);
    });
  }
  return auth;
}

function getFirebaseDb(): Firestore {
  if (typeof window === 'undefined') {
    return {} as Firestore;
  }
  if (!db) {
    db = getFirestore(getFirebaseApp());
    enableMultiTabIndexedDbPersistence(db).catch((err) => {
      console.warn('Firebase persistence failed:', err);
    });
  }
  return db;
}

function getFirebaseRTDB(): Database {
  if (typeof window === 'undefined') {
    return {} as Database;
  }
  if (!rtdb) {
    rtdb = getDatabase(getFirebaseApp());
  }
  return rtdb;
}

function getGoogleProvider(): GoogleAuthProvider {
  if (typeof window === 'undefined') {
    return {} as GoogleAuthProvider;
  }
  if (!googleProvider) {
    googleProvider = new GoogleAuthProvider();
  }
  return googleProvider;
}

async function signInWithCustomTokenWrapper(customToken: string) {
  const firebaseAuth = getFirebaseAuth();
  return signInWithCustomToken(firebaseAuth, customToken);
}

export {
  getFirebaseAuth as auth,
  getFirebaseDb as db,
  getFirebaseRTDB as rtdb,
  getGoogleProvider as googleProvider,
  signInWithCustomTokenWrapper as signInWithCustomToken
};
