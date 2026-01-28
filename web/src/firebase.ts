import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "***SECRETO-RETIRADO-2026-09-24***",
    authDomain: "udea-filosofia.firebaseapp.com",
    projectId: "udea-filosofia",
    storageBucket: "udea-filosofia.firebasestorage.app",
    messagingSenderId: "578238159459",
    appId: "1:578238159459:web:ac6bc631e907cb594ab656",
    measurementId: "G-11X68SESP9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
