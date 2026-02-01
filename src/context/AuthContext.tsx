'use client';
import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import {
    onAuthStateChanged,
    User,
    signInWithPopup,
    signOut,
    sendPasswordResetEmail
} from 'firebase/auth';
import { auth as getAuth, googleProvider as getGoogleProvider } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    loginWithEmail: (email: string, pass: string) => Promise<void>;
    registerWithEmail: (email: string, pass: string) => Promise<void>;
    changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signInWithGoogle: async () => { },
    loginWithEmail: async () => { },
    registerWithEmail: async () => { },
    changePassword: async () => { },
    resetPassword: async () => { },
    logout: async () => { }
});

export const useAuth = () => useContext(AuthContext);

const MOCK_USER = {
    uid: '21VuZW4cdXd9jGKOgPa5YQegICw1',
    email: 'dev@test.com',
    displayName: 'Dev Tester',
    getIdToken: async () => 'mock-token'
} as unknown as User;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        const useMock = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true';
        if (useMock && !localStorage.getItem('agora_user')) {
            setUser(MOCK_USER);
            setLoading(false);
            return;
        }

        const storedUser = localStorage.getItem('agora_user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
                setLoading(false);
                return;
            } catch (e) {
                localStorage.removeItem('agora_user');
            }
        }

        try {
            const firebaseAuth = getAuth();
            const unsubscribe = onAuthStateChanged(firebaseAuth, (authUser: User | null) => {
                if (authUser) {
                    setUser(authUser);
                    localStorage.removeItem('agora_user');
                }
                setLoading(false);
            });
            return () => unsubscribe();
        } catch (e) {
            setLoading(false);
        }
    }, []);

    const signInWithGoogle = async () => {
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
            getIdToken: async () => userData.uid
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

    const changePassword = async (currentPassword: string, newPassword: string) => {
        if (!user?.uid) {
            throw new Error('No hay usuario autenticado');
        }

        const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uid: user.uid,
                currentPassword,
                newPassword
            })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Error al cambiar la contraseña');
        }

        return res.json();
    };

    const resetPassword = async (email: string) => {
        try {
            const firebaseAuth = getAuth();
            await sendPasswordResetEmail(firebaseAuth, email);
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                throw new Error('No existe una cuenta con este correo electrónico');
            }
            if (error.code === 'auth/invalid-email') {
                throw new Error('El correo electrónico no es válido');
            }
            throw new Error(error.message || 'Error al enviar el correo de recuperación');
        }
    };

    const logout = async () => {
        try {
            const firebaseAuth = getAuth();
            await signOut(firebaseAuth);
        } catch (error) {
        }
        setUser(null);
        localStorage.removeItem('agora_user');
        router.push('/');
    };

    return (
        <AuthContext.Provider value={{ user, loading, signInWithGoogle, loginWithEmail, registerWithEmail, changePassword, resetPassword, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
