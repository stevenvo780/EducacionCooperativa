import { auth as getAuth } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { toast } from 'sonner';

const LOCAL_DEV_TOKEN_STORAGE_KEY = 'agora_local_dev_token';

// Shared promise so concurrent calls while auth is loading share the same wait
let authWaiter: Promise<User | null> | null = null;

const waitForAuthUser = (timeoutMs = 3000): Promise<User | null> => {
  const firebaseAuth = getAuth();

  /* v8 ignore next 3 -- getAuthToken already short-circuits this path when currentUser exists */
  if (firebaseAuth.currentUser) {
    return Promise.resolve(firebaseAuth.currentUser);
  }

  if (authWaiter) return authWaiter;

  authWaiter = new Promise<User | null>((resolve) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      resolve(firebaseAuth.currentUser);
    }, timeoutMs);

    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      (user) => {
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(user);
      },
      () => {
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(firebaseAuth.currentUser);
      }
    );
  }).finally(() => {
    authWaiter = null;
  });

  return authWaiter;
};

export const getAuthToken = async (forceRefresh = false) => {
  if (typeof window === 'undefined') return null;

  try {
    const firebaseAuth = getAuth();
    const user = firebaseAuth.currentUser ?? await waitForAuthUser();
    if (user?.getIdToken) {
      return await user.getIdToken(forceRefresh);
    }
  } catch {
  }

  try {
    const localDevToken = localStorage.getItem(LOCAL_DEV_TOKEN_STORAGE_KEY);
    if (localDevToken) {
      return localDevToken;
    }
  } catch {
  }

  // Insecure-mode fallback: use the uid stored by AuthContext as the token
  if (process.env.NEXT_PUBLIC_ALLOW_INSECURE_AUTH === 'true') {
    try {
      const stored = localStorage.getItem('agora_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.uid) return parsed.uid as string;
      }
    } catch { /* ignore parse errors */ }
  }

  return null;
};

const doFetch = async (input: RequestInfo | URL, init: RequestInit, forceRefresh: boolean) => {
  const token = await getAuthToken(forceRefresh);
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
};

export const authFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  try {
    let response = await doFetch(input, init, false);
    // Si el server rechaza por auth, reintenta una vez forzando refresh del
    // ID token. Cubre el caso clásico: token expirado a las 1h pero el user
    // sigue siendo válido en Firebase.
    if (response.status === 401) {
      response = await doFetch(input, init, true);
    }
    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      let errorPayload: { error?: string; message?: string; currentPlan?: string; feature?: string } | null = null;
      try {
        errorPayload = await response.clone().json();
        if (errorPayload?.message) errorMessage = errorPayload.message;
      } catch { /* json parse */ }
      // Plan/cuota: dispatch evento global para que el dashboard abra
      // PricingModal en vez de mostrar solo el toast.
      const isPlanGate = response.status === 403 && errorPayload?.error === 'plan-required';
      const isQuotaGate = response.status === 413 && errorPayload?.error === 'storage-quota-exceeded';
      if ((isPlanGate || isQuotaGate) && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agora:plan-required', {
          detail: {
            kind: isQuotaGate ? 'quota' : 'plan',
            currentPlan: errorPayload?.currentPlan,
            feature: errorPayload?.feature,
            message: errorMessage
          }
        }));
        return response;
      }
      toast.error('Error en la petición', { description: errorMessage });
    }
    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'No se pudo contactar al servidor.';
    toast.error('Fallo de Red', { description: msg });
    throw err;
  }
};

// Deprecated or Unused. Removed token-in-url logic to enforce safer header-based auth.
export const withAuthToken = async (url: string) => {
  // If we really need this, implement a short-lived token mechanism. 
  // For now, assume callers use authFetch or headers.
  console.warn('withAuthToken is deprecated and insecure. Use authFetch or headers.');
  return url; 
};
