import { auth as getAuth } from '@/lib/firebase';

const getAuthToken = async () => {
  if (typeof window === 'undefined') return null;
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
