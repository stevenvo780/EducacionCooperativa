'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
    onAuthStateChanged, 
    User, 
    signInWithPopup, 
    signOut,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
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
    signInWithGoogle: async () => {},
    loginWithEmail: async () => {},
    registerWithEmail: async () => {},
    logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
            router.push('/dashboard');
        } catch (error) {
            console.error("Login failed", error);
            throw error;
        }
    };

    const loginWithEmail = async (email: string, pass: string) => {
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            router.push('/dashboard');
        } catch (error) {
            console.error("Email login failed", error);
            throw error;
        }
    }

    const registerWithEmail = async (email: string, pass: string) => {
        try {
            await createUserWithEmailAndPassword(auth, email, pass);
            router.push('/dashboard');
        } catch (error) {
            console.error("Registration failed", error);
            throw error;
        }
    }

    const logout = async () => {
        try {
            await signOut(auth);
            router.push('/');
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, signInWithGoogle, loginWithEmail, registerWithEmail, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
