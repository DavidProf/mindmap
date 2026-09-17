export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
    });
}

export function transactionDone(tx: IDBTransaction): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."));
        tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted."));
    });
}

export function lazyDb(open: () => Promise<IDBDatabase>): () => Promise<IDBDatabase> {
    let db: Promise<IDBDatabase> | null = null;
    return () => {
        if (!db) {
            db = open();
            db.catch(() => {
                db = null;
            });
        }
        return db;
    };
}
