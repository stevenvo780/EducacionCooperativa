import { auth as getAuth } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';

const waitForAuthUser = async (timeoutMs = 3000): Promise<User | null> => {
  const firebaseAuth = getAuth();

  if (firebaseAuth.currentUser) {
    return firebaseAuth.currentUser;
  }

  return new Promise((resolve) => {
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
  });
};

export const getAuthToken = async () => {
  if (typeof window === 'undefined') return null;

  try {
    const firebaseAuth = getAuth();
    const user = firebaseAuth.currentUser ?? await waitForAuthUser();
    if (user?.getIdToken) {
      return await user.getIdToken();
    }
  } catch {
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
