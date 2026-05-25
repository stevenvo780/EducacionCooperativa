'use client';
import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import {
    onIdTokenChanged,
    User,
    signInWithPopup,
    signOut,
    sendPasswordResetEmail
} from 'firebase/auth';
import { getErrorCode, getErrorMessage } from '@/lib/error-utils';
import { auth as getAuth, googleProvider as getGoogleProvider, signInWithCustomToken } from '@/lib/firebase';
import { apiUrl, parseApiResponse } from '@/services/apiClient';
import { useRouter } from 'next/navigation';
import { STDefinitionsRegistry } from '@/lib/st-definitions-registry';
import { purgeUserScopedStorage } from '@/lib/auth-storage-purge';
import { recoverPersistedSession, refreshPersistedTokenProactively } from '@/lib/auth-session-recovery';

interface AuthContextType {
    user: User | null;
    userEmail: string | null;
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
    userEmail: null,
    loading: true,
    signInWithGoogle: async () => { },
    loginWithEmail: async () => { },
    registerWithEmail: async () => { },
    changePassword: async () => { },
    resetPassword: async () => { },
    logout: async () => { }
});

export const useAuth = () => useContext(AuthContext);

const allowInsecureAuth = process.env.NEXT_PUBLIC_ALLOW_INSECURE_AUTH === 'true';
const LOCAL_DEV_TOKEN_STORAGE_KEY = 'agora_local_dev_token';
const LOCAL_DEV_USER_STORAGE_KEY = 'agora_local_dev_user';

interface StoredLocalUser {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
}

function safeParseStoredUser(raw: string | null): StoredLocalUser | null {
    if (!raw) return null;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        const obj = parsed as Record<string, unknown>;
        if (typeof obj.uid !== 'string' || obj.uid.length === 0) return null;
        return {
            uid: obj.uid,
            email: typeof obj.email === 'string' ? obj.email : null,
            displayName: typeof obj.displayName === 'string' ? obj.displayName : null,
            photoURL: typeof obj.photoURL === 'string' ? obj.photoURL : null
        };
    } catch {
        return null;
    }
}

// Anti-loop por timestamps para la recuperación de sesión en boot. Permite
// recuperar tantas veces como haga falta (reloads consecutivos con token
// stale), pero si recupera+recarga RECOVERY_LOOP_MAX veces dentro de una
// ventana corta es un loop genuino (algo roto, no un token vencido) → cortar.
const RECOVERY_STAMPS_KEY = 'agora_auth_recovery_stamps';
const RECOVERY_LOOP_WINDOW_MS = 10_000;
const RECOVERY_LOOP_MAX = 3;

function readRecoveryStamps(): number[] {
    try {
        const raw = sessionStorage.getItem(RECOVERY_STAMPS_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const now = Date.now();
        return parsed.filter((n): n is number =>
            typeof n === 'number' && now - n < RECOVERY_LOOP_WINDOW_MS);
    } catch {
        return [];
    }
}

function isRecoveryLooping(stamps: number[]): boolean {
    return stamps.length >= RECOVERY_LOOP_MAX;
}

function pushRecoveryStamp(stamps: number[]): void {
    try {
        const next = [...stamps, Date.now()];
        sessionStorage.setItem(RECOVERY_STAMPS_KEY, JSON.stringify(next));
    } catch { /* noop */ }
}

function clearRecoveryStamps(): void {
    try { sessionStorage.removeItem(RECOVERY_STAMPS_KEY); } catch { /* noop */ }
}

const createLocalDevUser = (userData: StoredLocalUser, token: string) => ({
    uid: userData.uid,
    email: userData.email ?? null,
    displayName: userData.displayName ?? null,
    photoURL: userData.photoURL ?? null,
    getIdToken: async () => token
} as unknown as User);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // Restaurar email guardado desde localStorage
        const storedEmail = localStorage.getItem('agora_user_email');
        if (storedEmail) {
            setUserEmail(storedEmail);
        }

        const storedLocalDevToken = localStorage.getItem(LOCAL_DEV_TOKEN_STORAGE_KEY);
        const storedLocalDevUserRaw = localStorage.getItem(LOCAL_DEV_USER_STORAGE_KEY);
        if (storedLocalDevToken && storedLocalDevUserRaw) {
            const parsedUser = safeParseStoredUser(storedLocalDevUserRaw);
            if (parsedUser) {
                setUser(createLocalDevUser(parsedUser, storedLocalDevToken));
                setUserEmail(parsedUser.email || storedEmail);
                setLoading(false);
                return;
            }
            localStorage.removeItem(LOCAL_DEV_TOKEN_STORAGE_KEY);
            localStorage.removeItem(LOCAL_DEV_USER_STORAGE_KEY);
        }

        if (allowInsecureAuth) {
            const storedUserRaw = localStorage.getItem('agora_user');
            const parsedUser = safeParseStoredUser(storedUserRaw);
            if (parsedUser) {
                const restoredUserObj = {
                    ...parsedUser,
                    getIdToken: async () => parsedUser.uid
                } as unknown as User;
                setUser(restoredUserObj);
                setUserEmail(parsedUser.email || storedEmail);
                setLoading(false);
                return;
            }
            if (storedUserRaw) localStorage.removeItem('agora_user');
        }

        let cancelled = false;
        let pendingNullCheck: ReturnType<typeof setTimeout> | null = null;
        let hasObservedUser = false;
        let unsubscribe: (() => void) | null = null;

        try {
            // (1) Prevención proactiva: reparar el registro de IndexedDB con
            // tokens frescos ANTES de inicializar el SDK de Auth. El SDK, al
            // construirse con `getAuth()`, arranca su propia validación de la
            // sesión persistida: si el idToken cacheado venció, hace un refresh
            // contra Secure Token API. Si NUESTRO refresh corre en paralelo,
            // ambos canjean el mismo refreshToken; el primero lo rota y el
            // segundo recibe 400 user-token-expired → el SDK purga IndexedDB →
            // logout fantasma. Por eso esperamos a reparar el registro PRIMERO
            // y solo entonces llamamos a getAuth(): el SDK levanta un idToken ya
            // vigente y no necesita refrescar en boot. Esto previene el logout
            // en hard-reload / crear workspace / goto a otro workspaceId.
            void refreshPersistedTokenProactively().finally(() => {
                if (cancelled) return;
                const firebaseAuth = getAuth();

                unsubscribe = onIdTokenChanged(firebaseAuth, (authUser: User | null) => {
                    if (cancelled) return;
                    if (pendingNullCheck) { clearTimeout(pendingNullCheck); pendingNullCheck = null; }

                    if (authUser) {
                        hasObservedUser = true;
                        clearRecoveryStamps();
                        setUser(authUser);
                        if (authUser.email) {
                            setUserEmail(authUser.email);
                            localStorage.setItem('agora_user_email', authUser.email);
                        }
                        localStorage.removeItem(LOCAL_DEV_TOKEN_STORAGE_KEY);
                        localStorage.removeItem(LOCAL_DEV_USER_STORAGE_KEY);
                        localStorage.removeItem('agora_user');
                        setLoading(false);
                        return;
                    }

                    // null callback: confirmar antes de cerrar sesión. Evita el
                    // "phantom logout" cuando Firebase dispara null brevemente
                    // durante reconnects. Si tras 1.5s `currentUser` sigue null,
                    // intentamos recuperar la sesión como red de seguridad.
                    pendingNullCheck = setTimeout(() => {
                        if (cancelled) return;
                        if (firebaseAuth.currentUser) {
                            setUser(firebaseAuth.currentUser);
                            setLoading(false);
                            return;
                        }

                        // Logout legítimo: ya observamos al user en esta sesión
                        // (el SDK lo emitió y luego null = signOut real).
                        if (hasObservedUser) {
                            setUser(null);
                            setLoading(false);
                            return;
                        }

                        // (2) Recuperación con anti-loop por timestamps. En vez
                        // de permitir 1 sola recuperación por sesión (que rompía
                        // el reload #2), permitimos recuperar SIEMPRE que haya
                        // refreshToken válido, pero detectamos un loop GENUINO:
                        // si recuperamos+recargamos RECOVERY_LOOP_MAX veces en
                        // RECOVERY_LOOP_WINDOW_MS, dejamos de intentar y aceptamos
                        // el null (algo está realmente roto, no un token stale).
                        const stamps = readRecoveryStamps();
                        if (isRecoveryLooping(stamps)) {
                            clearRecoveryStamps();
                            setUser(null);
                            setLoading(false);
                            return;
                        }

                        void recoverPersistedSession().then((result) => {
                            if (cancelled) return;
                            if (result === 'recovered') {
                                pushRecoveryStamp(stamps);
                                window.location.reload();
                                return;
                            }
                            if (result === 'transient') {
                                // Red caída / 5xx: no deslogueamos.
                                setLoading(false);
                                return;
                            }
                            // 'genuine-logout' o 'no-session': sesión cerrada.
                            clearRecoveryStamps();
                            setUser(null);
                            setLoading(false);
                        }).catch(() => {
                            if (cancelled) return;
                            setUser(null);
                            setLoading(false);
                        });
                    }, 1500);
                });
            });

            return () => {
                cancelled = true;
                if (pendingNullCheck) clearTimeout(pendingNullCheck);
                if (unsubscribe) unsubscribe();
            };
        } catch {
            setLoading(false);
        }
    }, []);

    const signInWithGoogle = useCallback(async () => {
        const apiKey = (process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '').replace(/\\n/g, '').trim();
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
        } catch (error: unknown) {
            console.error('Google login failed:', error);
            const errorCode = getErrorCode(error);
            if (errorCode === 'auth/configuration-not-found' ||
                errorCode === 'auth/invalid-api-key' ||
                errorCode === 'auth/api-key-not-valid') {
                throw new Error('Google Sign-In no está configurado correctamente.');
            }
            throw new Error(getErrorMessage(error, 'Error al iniciar sesión con Google'));
        }
    }, [router]);

    const loginWithEmail = useCallback(async (email: string, pass: string) => {
        const normalizedEmail = email.toLowerCase().trim();
        const res = await fetch(apiUrl('/api/auth/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: normalizedEmail, password: pass })
        });

        if (!res.ok) {
            const errorData = await parseApiResponse<{ error?: string }>(res).catch(() => ({} as { error?: string }));
            throw new Error(errorData.error || `Credenciales inválidas (HTTP ${res.status})`);
        }

        const userData = await parseApiResponse<Record<string, unknown> & {
            customToken?: string;
            localDevToken?: string;
            uid: string;
            email?: string;
            displayName?: string;
            photoURL?: string | null;
        }>(res);

        if (userData.customToken) {
            try {
                const credential = await signInWithCustomToken(userData.customToken);
                setUser(credential.user);
                setLoading(false);
                // Guardar el email porque Firebase custom tokens no lo incluyen
                setUserEmail(normalizedEmail);
                localStorage.setItem('agora_user_email', normalizedEmail);
                localStorage.removeItem('agora_user');
                router.push('/dashboard');
                return;
            } catch (tokenError) {
                console.warn('Custom token sign-in failed, using fallback:', tokenError);
            }
        }

        if (typeof userData.localDevToken === 'string' && userData.localDevToken) {
            const userObj = createLocalDevUser({
                uid: userData.uid,
                email: userData.email,
                displayName: userData.displayName || email.split('@')[0],
                photoURL: userData.photoURL || null
            }, userData.localDevToken);

            setUser(userObj);
            setUserEmail(userData.email || normalizedEmail);
            setLoading(false);
            localStorage.setItem(LOCAL_DEV_TOKEN_STORAGE_KEY, userData.localDevToken);
            localStorage.setItem(LOCAL_DEV_USER_STORAGE_KEY, JSON.stringify({
                uid: userData.uid,
                email: userData.email,
                displayName: userObj.displayName,
                photoURL: userObj.photoURL
            }));
            localStorage.setItem('agora_user_email', userData.email || normalizedEmail);
            localStorage.removeItem('agora_user');
            router.push('/dashboard');
            return;
        }

        if (!allowInsecureAuth) {
            throw new Error('No se pudo iniciar sesión con Firebase. Verifica la configuración.');
        }

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
    }, [router]);

    const registerWithEmail = useCallback(async (email: string, pass: string) => {
        const normalizedEmail = email.toLowerCase().trim();
        const res = await fetch(apiUrl('/api/auth/register'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: normalizedEmail, password: pass })
        });

        if (!res.ok) {
            const errorData = await parseApiResponse<{ error?: string }>(res).catch(() => ({} as { error?: string }));
            throw new Error(errorData.error || `Error al registrar usuario (HTTP ${res.status})`);
        }

        const userData = await parseApiResponse<Record<string, unknown> & {
            customToken?: string;
            localDevToken?: string;
            uid: string;
            email?: string;
        }>(res);

        if (userData.customToken) {
            try {
                const credential = await signInWithCustomToken(userData.customToken);
                setUser(credential.user);
                setLoading(false);
                // Guardar el email porque Firebase custom tokens no lo incluyen
                setUserEmail(normalizedEmail);
                localStorage.setItem('agora_user_email', normalizedEmail);
                localStorage.removeItem('agora_user');
                router.push('/dashboard');
                return;
            } catch (tokenError) {
                console.warn('Custom token sign-in failed, using fallback:', tokenError);
            }
        }

        if (typeof userData.localDevToken === 'string' && userData.localDevToken) {
            const userObj = createLocalDevUser({
                uid: userData.uid,
                email: userData.email,
                displayName: email.split('@')[0],
                photoURL: null
            }, userData.localDevToken);

            setUser(userObj);
            setUserEmail(userData.email || normalizedEmail);
            setLoading(false);
            localStorage.setItem(LOCAL_DEV_TOKEN_STORAGE_KEY, userData.localDevToken);
            localStorage.setItem(LOCAL_DEV_USER_STORAGE_KEY, JSON.stringify({
                uid: userData.uid,
                email: userData.email,
                displayName: userObj.displayName,
                photoURL: null
            }));
            localStorage.setItem('agora_user_email', userData.email || normalizedEmail);
            localStorage.removeItem('agora_user');
            router.push('/dashboard');
            return;
        }

        if (!allowInsecureAuth) {
            throw new Error('No se pudo iniciar sesión con Firebase. Verifica la configuración.');
        }

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
    }, [router]);

    const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
        if (!user?.uid) {
            throw new Error('No hay usuario autenticado');
        }
        const token = await user.getIdToken?.();

        const res = await fetch(apiUrl('/api/auth/change-password'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        });

        if (!res.ok) {
            const errorData = await parseApiResponse<{ error?: string }>(res).catch(() => ({} as { error?: string }));
            throw new Error(errorData.error || `Error al cambiar la contraseña (HTTP ${res.status})`);
        }

        await parseApiResponse(res).catch(() => undefined);
    }, [user]);

    const resetPassword = useCallback(async (email: string) => {
        try {
            const normalizedEmail = email.toLowerCase().trim();
            const prepareRes = await fetch(apiUrl('/api/auth/prepare-reset'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: normalizedEmail })
            });

            if (!prepareRes.ok) {
                const errorData = await parseApiResponse<{ error?: string }>(prepareRes).catch(() => ({} as { error?: string }));
                throw new Error(typeof errorData.error === 'string'
                    ? errorData.error
                    : `Error al preparar el correo de recuperación (HTTP ${prepareRes.status})`);
            }

            const firebaseAuth = getAuth();
            await sendPasswordResetEmail(firebaseAuth, normalizedEmail);
        } catch (error: unknown) {
            const errorCode = getErrorCode(error);
            if (errorCode === 'auth/user-not-found') {
                throw new Error('No existe una cuenta con este correo electrónico');
            }
            if (errorCode === 'auth/invalid-email') {
                throw new Error('El correo electrónico no es válido');
            }
            throw new Error(getErrorMessage(error, 'Error al enviar el correo de recuperación'));
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            const firebaseAuth = getAuth();
            await signOut(firebaseAuth);
        } catch (error) {
            console.error('[auth] signOut failed', error);
        }
        setUser(null);
        setUserEmail(null);
        // Purga claves del user previo. Sin esto, el siguiente user que loguea
        // en el mismo browser ve IDs/estado del anterior (favorites, dashboard
        // state, chats IA) y recibe 403 al abrir docs ajenos.
        purgeUserScopedStorage();
        STDefinitionsRegistry.clear();
        router.push('/');
    }, [router]);

    const value = useMemo<AuthContextType>(() => ({
        user,
        userEmail,
        loading,
        signInWithGoogle,
        loginWithEmail,
        registerWithEmail,
        changePassword,
        resetPassword,
        logout
    }), [user, userEmail, loading, signInWithGoogle, loginWithEmail, registerWithEmail, changePassword, resetPassword, logout]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
