/**
 * Purga de localStorage al hacer logout: elimina claves que pertenecen al
 * user previo para que el siguiente user en el mismo browser no vea IDs,
 * favorites, dashboard state, chats IA, etc., del anterior (que además le
 * causan 403 al intentar abrir docs ajenos).
 *
 * NO incluye claves de Firebase SDK (`firebase:authUser:*`,
 * `firebaseLocalStorageDb`) — esas las gestiona el SDK y `signOut()` ya
 * las limpia.
 */
const LOGOUT_PURGE_PREFIXES = [
  'dashboard_',
  'editor-',
  'agora_user_email',
  'agora_user',
  'agora_local_dev_',
  'agora-ai-chats:',
  'agora-ai-chats-',
  'workspace-',
  'workspace_',
  'semantic-',
  'semantic_',
  'linter_personal_dictionary',
  'recent_docs',
  'last_opened_'
] as const;

export function purgeUserScopedStorage(): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key !== null) keys.push(key);
    }
    for (const key of keys) {
      if (LOGOUT_PURGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        window.localStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.warn('[auth] purgeUserScopedStorage failed', err);
  }
}
