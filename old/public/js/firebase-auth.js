async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    
    try {
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;
        const idToken = await user.getIdToken();
        
        // Send token to backend
        const response = await fetch('/api/auth/google', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ idToken })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('workspace', data.workspace);
            
            // Redirect to main app
            window.location.href = '/index.html';
        } else {
            alert('Error de autenticación con el servidor: ' + (data.error || 'Desconocido'));
        }
        
    } catch (error) {
        console.error("Error Google Auth:", error);
        alert('Error al iniciar sesión con Google: ' + error.message);
    }
}

// Escuchar cambios de estado para depuración (opcional)
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log("Usuario Firebase conectado:", user.email);
    }
});
