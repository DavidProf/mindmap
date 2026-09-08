import type { Node } from "../types/node";
import { normalizeNodes } from "../types/node";
import type { Project } from "../types/project";
import type { StorageBackend } from "./backend";

export const IDB_NAME = "mindmap";
export const IDB_VERSION = 1;
export const IDB_PROJECTS_STORE = "projects";
export const IDB_NODES_STORE = "nodes";
export const IDB_BY_PROJECT_INDEX = "by-project";

export function isIndexedDbSupported(): boolean {
    return typeof indexedDB !== "undefined";
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
    });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."));
        tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted."));
    });
}

export function openMindmapDb(): Promise<IDBDatabase> {
    if (!isIndexedDbSupported()) {
        const err = new Error("IndexedDB is not supported.");
        err.name = "NotSupportedError";
        return Promise.reject(err);
    }
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(IDB_NAME, IDB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(IDB_PROJECTS_STORE)) {
                db.createObjectStore(IDB_PROJECTS_STORE, { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains(IDB_NODES_STORE)) {
                const store = db.createObjectStore(IDB_NODES_STORE, { keyPath: "id" });
                store.createIndex(IDB_BY_PROJECT_INDEX, "projectId", { unique: false });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB."));
    });
}

async function getAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const result = await requestToPromise(store.getAll() as IDBRequest<T[]>);
    await transactionDone(tx).catch(() => undefined);
    return result ?? [];
}

async function putAll(db: IDBDatabase, storeName: string, records: { id: string }[]): Promise<void> {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.clear();
    for (const record of records) store.put(record);
    await transactionDone(tx);
}

export function createIndexedDbBackend(open: () => Promise<IDBDatabase> = openMindmapDb): StorageBackend {
    // One shared connection per backend instance instead of an open round
    // trip per operation. A failed open clears the cache so the next
    // operation retries rather than reusing a dead promise.
    let db: Promise<IDBDatabase> | null = null;
    const getDb = () => {
        if (!db) {
            db = open();
            db.catch(() => {
                db = null;
            });
        }
        return db;
    };
    return {
        kind: "indexeddb",
        loadProjects: async () => getAll<Project>(await getDb(), IDB_PROJECTS_STORE),
        loadNodes: async () => normalizeNodes(await getAll<Node>(await getDb(), IDB_NODES_STORE)),
        saveProjects: async (projects) => {
            await putAll(await getDb(), IDB_PROJECTS_STORE, projects);
        },
        saveNodes: async (nodes) => {
            await putAll(await getDb(), IDB_NODES_STORE, nodes);
        },
    };
}
