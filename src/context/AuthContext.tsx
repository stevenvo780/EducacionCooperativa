'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
    onAuthStateChanged,
    User,
    signInWithPopup,
    signOut
} from 'firebase/auth';
import { auth as getAuth, googleProvider as getGoogleProvider } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    loginWithEmail: (email: string, pass: string) => Promise<void>;
    registerWithEmail: (email: string, pass: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signInWithGoogle: async () => { },
    loginWithEmail: async () => { },
    registerWithEmail: async () => { },
    logout: async () => { }
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // DEV ONLY: Auto-login mock
        const useMock = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true';
        if (useMock && !localStorage.getItem('agora_user')) {
            const mockUser = {
                uid: '21VuZW4cdXd9jGKOgPa5YQegICw1',
                email: 'dev@test.com',
                displayName: 'Dev Tester',
                getIdToken: async () => 'mock-token'
            } as any;
            setUser(mockUser);
            setLoading(false);
            return;
        }

        // Check localStorage for persisted custom auth session
        const storedUser = localStorage.getItem('agora_user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error('Failed to parse stored user', e);
                localStorage.removeItem('agora_user');
            }
        }

        // Firebase auth listener for Google Sign-In
        const firebaseAuth = getAuth();
        const unsubscribe = onAuthStateChanged(firebaseAuth, (authUser: User | null) => {
            if (authUser) {
                // Firebase auth succeeded (Google Sign-In)
                setUser(authUser);
                localStorage.removeItem('agora_user'); // Clear custom auth if using Firebase
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        // Check if Firebase is properly configured
        const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
        if (!apiKey) {
            throw new Error('Google Sign-In no está configurado. Por favor usa email/contraseña.');
        }

        try {
            const firebaseAuth = getAuth();
            const provider = getGoogleProvider();
            const result = await signInWithPopup(firebaseAuth, provider);
            if (result.user) {
                router.push('/dashboard');
            }
        } catch (error: any) {
            console.error('Google login failed:', error);
            if (error.code === 'auth/configuration-not-found' ||
                error.code === 'auth/invalid-api-key' ||
                error.code === 'auth/api-key-not-valid') {
                throw new Error('Google Sign-In no está configurado correctamente.');
            }
            throw new Error(error.message || 'Error al iniciar sesión con Google');
        }
    };

    const loginWithEmail = async (email: string, pass: string) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Credenciales inválidas');
        }

        const userData = await res.json();

        const userObj = {
            uid: userData.uid,
            email: userData.email,
            displayName: userData.displayName || email.split('@')[0],
            photoURL: userData.photoURL || null,
            getIdToken: async () => userData.uid // Use uid as token for API calls
        } as unknown as User;

        setUser(userObj);
        localStorage.setItem('agora_user', JSON.stringify({
            uid: userData.uid,
            email: userData.email,
            displayName: userObj.displayName,
            photoURL: userObj.photoURL
        }));

        router.push('/dashboard');
    };

    const registerWithEmail = async (email: string, pass: string) => {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Error al registrar usuario');
        }

        const userData = await res.json();

        // Auto login after registration
        const userObj = {
            uid: userData.uid,
            email: userData.email,
            displayName: email.split('@')[0],
            photoURL: null,
            getIdToken: async () => userData.uid
        } as unknown as User;

        setUser(userObj);
        localStorage.setItem('agora_user', JSON.stringify({
            uid: userData.uid,
            email: userData.email,
            displayName: userObj.displayName,
            photoURL: null
        }));

        router.push('/dashboard');
    };

    const logout = async () => {
        try {
            const firebaseAuth = getAuth();
            await signOut(firebaseAuth);
        } catch (error) {
            // Ignore Firebase signout errors if using custom auth
        }
        setUser(null);
        localStorage.removeItem('agora_user');
        router.push('/');
    };

    return (
        <AuthContext.Provider value={{ user, loading, signInWithGoogle, loginWithEmail, registerWithEmail, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
