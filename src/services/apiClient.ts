import { auth as getAuth } from '@/lib/firebase';

const getAuthToken = async () => {
  if (typeof window === 'undefined') return null;

  if (process.env.NEXT_PUBLIC_ALLOW_INSECURE_AUTH === 'true') {
    const stored = localStorage.getItem('agora_user');
    if (stored) {
      try {
        return JSON.parse(stored).uid;
      } catch {}
    }
  }

  try {
    const firebaseAuth = getAuth();
    const user = firebaseAuth.currentUser;
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

export const withAuthToken = async (url: string) => {
  const token = await getAuthToken();
  if (!token) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(token)}`;
};
