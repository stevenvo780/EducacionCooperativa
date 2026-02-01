import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.replace(/\\n/g, '').trim(),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.replace(/\\n/g, '').trim(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.replace(/\\n/g, '').trim(),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.replace(/\\n/g, '').trim(),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.replace(/\\n/g, '').trim(),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.replace(/\\n/g, '').trim()
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
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
  }
  return auth;
}

function getFirebaseDb(): Firestore {
  if (typeof window === 'undefined') {
    return {} as Firestore;
  }
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

function getFirebaseStorage(): FirebaseStorage {
  if (typeof window === 'undefined') {
    return {} as FirebaseStorage;
  }
  if (!storage) {
    storage = getStorage(getFirebaseApp());
  }
  return storage;
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
  getFirebaseStorage as storage,
  getGoogleProvider as googleProvider,
  signInWithCustomTokenWrapper as signInWithCustomToken
};
