// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAO4u2_Hlgj2j0I7ZeF8IUEAcK6xK9tq_w",
    authDomain: "udea-filosofia.firebaseapp.com",
    projectId: "udea-filosofia",
    storageBucket: "udea-filosofia.firebasestorage.app",
    messagingSenderId: "578238159459",
    appId: "1:578238159459:web:ac6bc631e907cb594ab656",
    measurementId: "G-11X68SESP9"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
    // Initialize Analytics if needed, though usually not critical for auth
    // firebase.analytics(); 
} catch (e) {
    console.error("Error inicializando Firebase:", e);
}
