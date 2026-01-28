// Firebase Configuration
// Reemplaza con tus credenciales de Firebase Console
const firebaseConfig = {
    apiKey: "API_KEY_AQUI",
    authDomain: "educacion-cooperativa.firebaseapp.com",
    projectId: "educacion-cooperativa",
    storageBucket: "educacion-cooperativa.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
} catch (e) {
    console.error("Error inicializando Firebase:", e);
}
