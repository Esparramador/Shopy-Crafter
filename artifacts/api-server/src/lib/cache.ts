const store = new Map<string, { data: unknown; expires: number }>();

export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = store.get(key);
  if (entry && entry.expires > now) return Promise.resolve(entry.data as T);

  return fn().then(data => {
    store.set(key, { data, expires: now + ttlMs });
    return data;
  });
}

export function invalidateCache(keyPrefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(keyPrefix)) store.delete(key);
  }
}

export function clearAllCache(): void {
  store.clear();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expires < now) store.delete(key);
  }
}, 300_000);
