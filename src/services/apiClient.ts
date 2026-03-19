import { auth as getAuth } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';

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

export const getAuthToken = async () => {
  if (typeof window === 'undefined') return null;

  try {
    const firebaseAuth = getAuth();
    const user = firebaseAuth.currentUser ?? await waitForAuthUser();
    /* v8 ignore next -- user objects without getIdToken are treated as unauthenticated */
    if (user?.getIdToken) {
      return await user.getIdToken();
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

export const authFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const token = await getAuthToken();
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
};

// Deprecated or Unused. Removed token-in-url logic to enforce safer header-based auth.
export const withAuthToken = async (url: string) => {
  // If we really need this, implement a short-lived token mechanism. 
  // For now, assume callers use authFetch or headers.
  console.warn('withAuthToken is deprecated and insecure. Use authFetch or headers.');
  return url; 
};
