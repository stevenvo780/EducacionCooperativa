/**
 * Recuperación de sesión en boot cuando el idToken persistido venció.
 *
 * El SDK de Firebase, al reabrir la app, valida la sesión persistida con
 * `accounts:lookup` usando el idToken cacheado. Si el reloj del cliente está
 * atrasado respecto al servidor (clock skew) o el token cae justo en el borde
 * del buffer de 30s, el SDK lo considera válido y lo manda sin refrescar; el
 * servidor responde `TOKEN_EXPIRED`, y el SDK hace `signOut()` purgando el
 * registro de IndexedDB — incluido el refreshToken válido que nunca se usó.
 *
 * Esto desloguea a TODOS los usuarios (el login es custom-token, no hay
 * email/pass nativo). La recuperación lee el refreshToken persistido y lo
 * canjea contra Secure Token API antes de aceptar el null:
 *  - éxito  → la sesión es recuperable; reparamos el registro de IndexedDB con
 *             tokens frescos para que el SDK la lea válida tras un reload.
 *  - fallo de credencial (refresh token revocado/expirado) → logout legítimo.
 *  - fallo de red → transitorio, no deslogueamos.
 */

const IDB_NAME = 'firebaseLocalStorageDb';
const IDB_VERSION = 1;
const IDB_STORE = 'firebaseLocalStorage';
const IDB_KEYPATH = 'fbase_key';
const SECURE_TOKEN_HOST = 'securetoken.googleapis.com';

export type SessionRecoveryResult = 'recovered' | 'genuine-logout' | 'transient' | 'no-session';

interface StsTokenManagerJson {
  refreshToken?: string;
  accessToken?: string;
  expirationTime?: number;
}

interface PersistedAuthUser {
  stsTokenManager?: StsTokenManagerJson;
  [key: string]: unknown;
}

interface PersistedRecord {
  [IDB_KEYPATH]: string;
  value: PersistedAuthUser;
}

function cleanApiKey(): string {
  return (process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '').replace(/\\n/g, '').trim();
}

function persistenceKey(): string | null {
  const apiKey = cleanApiKey();
  if (!apiKey) return null;
  // El SDK usa el nombre de app "[DEFAULT]" para la instancia por defecto.
  return `firebase:authUser:${apiKey}:[DEFAULT]`;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(IDB_NAME, IDB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
    // Si la DB no existe aún, el upgrade la crearía vacía; abortamos para no
    // tocar el ciclo de vida que gestiona el SDK.
    request.onupgradeneeded = () => {
      try { request.transaction?.abort(); } catch { /* noop */ }
      resolve(null);
    };
  });
}

function readRecord(db: IDBDatabase, key: string): Promise<PersistedRecord | null> {
  return new Promise((resolve) => {
    let req: IDBRequest<unknown>;
    try {
      req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
    } catch {
      resolve(null);
      return;
    }
    req.onsuccess = () => {
      const result = req.result;
      if (result && typeof result === 'object' && 'value' in result) {
        resolve(result as PersistedRecord);
      } else {
        resolve(null);
      }
    };
    req.onerror = () => resolve(null);
  });
}

function writeRecord(db: IDBDatabase, record: PersistedRecord): Promise<boolean> {
  return new Promise((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(record);
    } catch {
      resolve(false);
      return;
    }
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}

interface StsRefreshSuccess {
  ok: true;
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
}
interface StsRefreshFailure {
  ok: false;
  reason: 'genuine-logout' | 'transient';
}

async function exchangeRefreshToken(refreshToken: string): Promise<StsRefreshSuccess | StsRefreshFailure> {
  const apiKey = cleanApiKey();
  if (!apiKey) return { ok: false, reason: 'transient' };

  const url = `https://${SECURE_TOKEN_HOST}/v1/token?key=${encodeURIComponent(apiKey)}`;
  const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
  } catch {
    // Red caída / offline: no deslogueamos por esto.
    return { ok: false, reason: 'transient' };
  }

  if (!res.ok) {
    // 400 con TOKEN_EXPIRED / INVALID_REFRESH_TOKEN / USER_DISABLED /
    // USER_NOT_FOUND = credencial genuinamente inválida → logout legítimo.
    // 5xx = problema del servidor → transitorio.
    if (res.status >= 500) return { ok: false, reason: 'transient' };
    return { ok: false, reason: 'genuine-logout' };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, reason: 'transient' };
  }

  const obj = json as Record<string, unknown>;
  const accessToken = obj.access_token;
  const newRefreshToken = obj.refresh_token;
  const expiresIn = obj.expires_in;
  if (typeof accessToken !== 'string' || typeof newRefreshToken !== 'string') {
    return { ok: false, reason: 'transient' };
  }
  const expiresInSec = typeof expiresIn === 'string' ? Number(expiresIn) : 3600;

  return {
    ok: true,
    accessToken,
    refreshToken: newRefreshToken,
    expiresInSec: Number.isFinite(expiresInSec) && expiresInSec > 0 ? expiresInSec : 3600
  };
}

/**
 * Intenta recuperar la sesión persistida tras un null en boot. NO hace
 * `setUser`: devuelve un veredicto. El caller decide si recargar (cuando
 * 'recovered', el registro de IndexedDB ya quedó reparado y un reload deja
 * que el SDK levante la sesión con tokens frescos) o aceptar el logout.
 */
export async function recoverPersistedSession(): Promise<SessionRecoveryResult> {
  if (typeof window === 'undefined') return 'no-session';
  const key = persistenceKey();
  if (!key) return 'no-session';

  const db = await openDb();
  if (!db) return 'no-session';

  try {
    const record = await readRecord(db, key);
    const refreshToken = record?.value?.stsTokenManager?.refreshToken;
    if (!record || typeof refreshToken !== 'string' || refreshToken.length === 0) {
      // El SDK ya purgó el registro (o nunca lo hubo): no hay nada que
      // recuperar. El caller acepta el null sin deslogueo extra.
      return 'no-session';
    }

    const exchanged = await exchangeRefreshToken(refreshToken);
    if (!exchanged.ok) {
      return exchanged.reason;
    }

    const repaired: PersistedRecord = {
      ...record,
      value: {
        ...record.value,
        stsTokenManager: {
          ...record.value.stsTokenManager,
          accessToken: exchanged.accessToken,
          refreshToken: exchanged.refreshToken,
          expirationTime: Date.now() + exchanged.expiresInSec * 1000
        }
      }
    };

    const wrote = await writeRecord(db, repaired);
    return wrote ? 'recovered' : 'transient';
  } finally {
    try { db.close(); } catch { /* noop */ }
  }
}

/**
 * Repara proactivamente el registro de IndexedDB ANTES de que el SDK valide
 * la sesión persistida con `accounts:lookup`. Lee el idToken cacheado; si está
 * vencido o a punto de vencer (buffer de 5 min), canjea el refreshToken y
 * reescribe el registro con tokens frescos. Así, cuando el SDK levanta la
 * sesión en boot, encuentra un idToken válido y no dispara el `accounts:lookup`
 * con token stale que provoca TOKEN_EXPIRED → purga → logout fantasma.
 *
 * Idempotente y barato: si el token todavía es válido devuelve 'fresh' sin
 * tocar la red. Debe llamarse lo antes posible, antes de `onIdTokenChanged`.
 */
export type ProactiveRefreshResult = 'refreshed' | 'fresh' | 'no-session' | 'genuine-logout' | 'transient';

const PROACTIVE_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export async function refreshPersistedTokenProactively(): Promise<ProactiveRefreshResult> {
  if (typeof window === 'undefined') return 'no-session';
  const key = persistenceKey();
  if (!key) return 'no-session';

  const db = await openDb();
  if (!db) return 'no-session';

  try {
    const record = await readRecord(db, key);
    const sts = record?.value?.stsTokenManager;
    const refreshToken = sts?.refreshToken;
    if (!record || typeof refreshToken !== 'string' || refreshToken.length === 0) {
      return 'no-session';
    }

    const expirationTime = typeof sts?.expirationTime === 'number' ? sts.expirationTime : 0;
    // Si el idToken vence en >5 min, la validación del SDK lo aceptará sin
    // problemas: no gastamos una llamada de red.
    if (expirationTime - Date.now() > PROACTIVE_EXPIRY_BUFFER_MS) {
      return 'fresh';
    }

    const exchanged = await exchangeRefreshToken(refreshToken);
    if (!exchanged.ok) {
      return exchanged.reason;
    }

    const repaired: PersistedRecord = {
      ...record,
      value: {
        ...record.value,
        stsTokenManager: {
          ...record.value.stsTokenManager,
          accessToken: exchanged.accessToken,
          refreshToken: exchanged.refreshToken,
          expirationTime: Date.now() + exchanged.expiresInSec * 1000
        }
      }
    };

    const wrote = await writeRecord(db, repaired);
    return wrote ? 'refreshed' : 'transient';
  } finally {
    try { db.close(); } catch { /* noop */ }
  }
}
