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
        // Check localStorage for persisted "Custom Auth" session
        const storedUser = localStorage.getItem('agora_user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
                setLoading(false); // Force loading false if we have a stored user
            } catch (e) {
                console.error("Failed to parse stored user", e);
            }
        }

        // Keep Firebase listener if needed for Google Auth (optional)
        const unsubscribe = onAuthStateChanged(auth, (authUser: User | null) => {
             // If firebase auth works (e.g. Google), it overrides our custom auth
             if (authUser) {
                setUser(authUser);
             } 
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
            // Mock fallback if needed, but we try to avoid it.
        }
    };

    const loginWithEmail = async (email: string, pass: string) => {
        try {
            // Use Custom API Login
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: pass }),
            });

            if (!res.ok) {
                 const errorData = await res.json();
                 throw new Error(errorData.error || 'Login failed');
            }

            const userData = await res.json();
            // Transform to Firebase User shape if needed or use as is (cast to User for TS)
            const userObj = {
                uid: userData.uid,
                email: userData.email,
                displayName: userData.displayName,
                photoURL: userData.photoURL,
                // Add dummy methods to satisfy User interface if strictly used
                getIdToken: async () => 'mock-token',
            } as unknown as User;

            setUser(userObj);
            localStorage.setItem('agora_user', JSON.stringify(userObj));
            
            router.push('/dashboard');
        } catch (error) {
            console.error("Email login failed", error);
            throw error;
        }
    }

    const registerWithEmail = async (email: string, pass: string) => {
        try {
            // Use Server-Side Registration via API Route (Custom Firestore Auth)
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: pass }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Registration failed');
            }
            
            // Redirect to login after successful registration
            router.push('/login'); 
        } catch (error) {
            console.error("Registration failed", error);
            throw error;
        }
    }

    const logout = async () => {
        try {
            await signOut(auth);
            setUser(null);
            localStorage.removeItem('agora_user');
            router.push('/');
        } catch (error) {
            console.error("Logout failed", error);
            setUser(null);
            localStorage.removeItem('agora_user');
            router.push('/');
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, signInWithGoogle, loginWithEmail, registerWithEmail, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
