"use client";

const DB_NAME = "mi-salud-private";
const DB_VERSION = 2;
const CACHE_STORE = "cache";
const OUTBOX_STORE = "outbox";

export type QueuedRequest = {
  id: string;
  namespace: string;
  url: string;
  method: string;
  body: unknown;
  createdAt: string;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CACHE_STORE)) database.createObjectStore(CACHE_STORE);
      if (!database.objectStoreNames.contains(OUTBOX_STORE)) database.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
      if ((event as IDBVersionChangeEvent).oldVersion < 2) {
        request.transaction?.objectStore(CACHE_STORE).clear();
        request.transaction?.objectStore(OUTBOX_STORE).clear();
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function cachePrivateSnapshot(namespace: string, value: unknown) {
  const database = await openDatabase();
  await transactionPromise(database, CACHE_STORE, "readwrite", (store) => store.put(value, `overview:${safeNamespace(namespace)}`));
  database.close();
}

export async function loadPrivateSnapshot<T>(namespace: string): Promise<T | null> {
  const database = await openDatabase();
  const value = await transactionPromise(database, CACHE_STORE, "readonly", (store) => store.get(`overview:${safeNamespace(namespace)}`));
  database.close();
  return (value as T | undefined) ?? null;
}

export async function queuePrivateRequest(namespace: string, url: string, body: unknown) {
  const item: QueuedRequest = { id: crypto.randomUUID(), namespace: safeNamespace(namespace), url, method: "POST", body, createdAt: new Date().toISOString() };
  const database = await openDatabase();
  await transactionPromise(database, OUTBOX_STORE, "readwrite", (store) => store.add(item));
  database.close();
  return item;
}

export async function queuedRequestCount(namespace: string) {
  const database = await openDatabase();
  const items = await transactionPromise(database, OUTBOX_STORE, "readonly", (store) => store.getAll()) as QueuedRequest[];
  database.close();
  return items.filter((item) => item.namespace === safeNamespace(namespace)).length;
}

export async function flushPrivateQueue(namespace: string) {
  const database = await openDatabase();
  const allItems = await transactionPromise(database, OUTBOX_STORE, "readonly", (store) => store.getAll()) as QueuedRequest[];
  const items = allItems.filter((item) => item.namespace === safeNamespace(namespace));
  let completed = 0;
  for (const item of items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const response = await fetch(item.url, {
      method: item.method,
      headers: { "content-type": "application/json", "x-idempotency-key": item.id },
      body: JSON.stringify(item.body),
    });
    if (!response.ok) break;
    await transactionPromise(database, OUTBOX_STORE, "readwrite", (store) => store.delete(item.id));
    completed += 1;
  }
  database.close();
  return { completed, remaining: Math.max(0, items.length - completed) };
}

function safeNamespace(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "anonymous";
}

function transactionPromise(
  database: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
}
