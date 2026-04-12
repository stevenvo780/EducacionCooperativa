type ClientStoredConfig<T extends object> = { [K in keyof T]: T[K] & string };

interface ClientConfigStorageOptions<T extends object> {
  storageKey: string;
  defaults: ClientStoredConfig<T>;
  sensitiveKeys: readonly (keyof T)[];
}

const getSensitiveStorageKey = (storageKey: string) => `${storageKey}:session`;

const pickConfigSubset = <T extends object>(
  source: ClientStoredConfig<T>,
  keys: readonly (keyof T)[]
) => {
  const subset = {} as Partial<ClientStoredConfig<T>>;
  keys.forEach((key) => {
    subset[key] = source[key];
  });
  return subset;
};

const omitConfigSubset = <T extends object>(
  source: ClientStoredConfig<T>,
  keys: readonly (keyof T)[]
) => {
  const blocked = new Set<keyof T>(keys);
  const subset = {} as Partial<ClientStoredConfig<T>>;

  Object.entries(source).forEach(([rawKey, value]) => {
    const key = rawKey as keyof T;
    if (blocked.has(key)) return;
    subset[key] = value as ClientStoredConfig<T>[keyof T];
  });

  return subset;
};

const readConfig = <T extends object>(storage: Storage, key: string) => {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<ClientStoredConfig<T>>;
  } catch {
    return null;
  }
};

const writeConfig = (storage: Storage, key: string, value: Record<string, unknown>) => {
  try {
    if (Object.keys(value).length === 0) {
      storage.removeItem(key);
      return;
    }
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable or full.
  }
};

export const loadClientConfig = <T extends object>({
  storageKey,
  defaults
}: ClientConfigStorageOptions<T>): ClientStoredConfig<T> => {
  if (typeof window === 'undefined') return defaults;

  const persisted = readConfig<T>(window.localStorage, storageKey) ?? {};
  const sensitive = readConfig<T>(window.sessionStorage, getSensitiveStorageKey(storageKey)) ?? {};

  return {
    ...defaults,
    ...persisted,
    ...sensitive
  };
};

export const saveClientConfig = <T extends object>({
  storageKey,
  sensitiveKeys
}: ClientConfigStorageOptions<T>, value: ClientStoredConfig<T>) => {
  if (typeof window === 'undefined') return;

  writeConfig(window.localStorage, storageKey, omitConfigSubset(value, sensitiveKeys));
  writeConfig(window.sessionStorage, getSensitiveStorageKey(storageKey), pickConfigSubset(value, sensitiveKeys));
};

export const clearClientConfig = <T extends object>({
  storageKey
}: Pick<ClientConfigStorageOptions<T>, 'storageKey'>) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(storageKey);
    window.sessionStorage.removeItem(getSensitiveStorageKey(storageKey));
  } catch {
    // Storage may be unavailable.
  }
};
