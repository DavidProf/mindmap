import {
    IDB_MEDIA_BY_NODE_INDEX,
    IDB_MEDIA_BY_PROJECT_INDEX,
    IDB_MEDIA_STORE,
    openMindmapDb,
} from "./indexedDb";

export type MediaBlob = {
    id: string;
    projectId: string;
    nodeId: string;
    blob: Blob;
    createdAt: string;
};

export type MediaBlobStore = {
    saveBlob(record: MediaBlob): Promise<void>;
    loadBlob(id: string): Promise<MediaBlob | null>;
    deleteBlob(id: string): Promise<void>;
    deleteBlobsForNodeIds(nodeIds: string[]): Promise<void>;
    deleteBlobsForProject(projectId: string): Promise<void>;
    countBlobs(): Promise<number>;
};

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

export function createMemoryMediaBlobStore(): MediaBlobStore {
    const blobs = new Map<string, MediaBlob>();
    async function idsFor(index: "node" | "project", key: string): Promise<string[]> {
        const out: string[] = [];
        for (const [id, record] of blobs) {
            if (index === "node" ? record.nodeId === key : record.projectId === key) out.push(id);
        }
        return out;
    }
    return {
        saveBlob: (record) => {
            blobs.set(record.id, record);
            return Promise.resolve();
        },
        loadBlob: (id) => Promise.resolve(blobs.get(id) ?? null),
        deleteBlob: (id) => {
            blobs.delete(id);
            return Promise.resolve();
        },
        deleteBlobsForNodeIds: async (nodeIds) => {
            const targets = new Set(nodeIds);
            for (const [id, record] of blobs) {
                if (targets.has(record.nodeId)) blobs.delete(id);
            }
        },
        deleteBlobsForProject: async (projectId) => {
            for (const id of await idsFor("project", projectId)) blobs.delete(id);
        },
        countBlobs: () => Promise.resolve(blobs.size),
    };
}

export function createIdbMediaBlobStore(open: () => Promise<IDBDatabase> = openMindmapDb): MediaBlobStore {
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
    async function deleteByIndex(indexName: string, key: string): Promise<void> {
        const database = await getDb();
        const tx = database.transaction(IDB_MEDIA_STORE, "readwrite");
        const index = tx.objectStore(IDB_MEDIA_STORE).index(indexName);
        const keys = (await requestToPromise(index.getAllKeys(key) as IDBRequest<IDBValidKey[]>)) ?? [];
        const store = tx.objectStore(IDB_MEDIA_STORE);
        for (const k of keys) store.delete(k);
        await transactionDone(tx);
    }
    return {
        saveBlob: async (record) => {
            const database = await getDb();
            const tx = database.transaction(IDB_MEDIA_STORE, "readwrite");
            tx.objectStore(IDB_MEDIA_STORE).put(record);
            await transactionDone(tx);
        },
        loadBlob: async (id) => {
            const database = await getDb();
            const tx = database.transaction(IDB_MEDIA_STORE, "readonly");
            const record = await requestToPromise(
                tx.objectStore(IDB_MEDIA_STORE).get(id) as IDBRequest<MediaBlob | undefined>,
            );
            await transactionDone(tx).catch(() => undefined);
            return record ?? null;
        },
        deleteBlob: async (id) => {
            const database = await getDb();
            const tx = database.transaction(IDB_MEDIA_STORE, "readwrite");
            tx.objectStore(IDB_MEDIA_STORE).delete(id);
            await transactionDone(tx);
        },
        deleteBlobsForNodeIds: async (nodeIds) => {
            for (const nodeId of nodeIds) await deleteByIndex(IDB_MEDIA_BY_NODE_INDEX, nodeId);
        },
        deleteBlobsForProject: async (projectId) => {
            await deleteByIndex(IDB_MEDIA_BY_PROJECT_INDEX, projectId);
        },
        countBlobs: async () => {
            const database = await getDb();
            const tx = database.transaction(IDB_MEDIA_STORE, "readonly");
            const count = await requestToPromise(tx.objectStore(IDB_MEDIA_STORE).count());
            await transactionDone(tx).catch(() => undefined);
            return count ?? 0;
        },
    };
}
