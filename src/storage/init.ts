import type { Node } from "../types/node";
import type { Project } from "../types/project";
import { createIndexedDbBackend, isIndexedDbSupported } from "./indexedDb";
import {
    createLocalStorageBackend,
    createMemoryBackend,
    mergeForMigration,
    shouldMigrate,
    type StorageBackend,
    type StorageBackendKind,
} from "./backend";
import { isStorageAvailable, loadNodes, loadProjects } from "./localStore";

export type StorageFallback = StorageBackendKind;

export type InitResult = {
    backend: StorageBackend;
    migrated: boolean;
    fallback: StorageFallback;
};

export type InitDeps = {
    createIdb?: () => StorageBackend | null;
    readLocal?: () => { projects: Project[]; nodes: Node[] };
};

function defaultCreateIdb(): StorageBackend | null {
    if (!isIndexedDbSupported()) return null;
    return createIndexedDbBackend();
}

function defaultReadLocal(): { projects: Project[]; nodes: Node[] } {
    let projects: Project[];
    let nodes: Node[];
    try {
        projects = loadProjects();
    } catch {
        projects = [];
    }
    try {
        nodes = loadNodes();
    } catch {
        nodes = [];
    }
    return { projects, nodes };
}

function localOrMemoryResult(): InitResult {
    try {
        if (isStorageAvailable()) {
            return { backend: createLocalStorageBackend(), migrated: false, fallback: "localstorage" };
        }
    } catch {
        // fall through to memory
    }
    return { backend: createMemoryBackend(), migrated: false, fallback: "memory" };
}

export async function runMigration(
    idb: StorageBackend,
    lsProjects: Project[],
    lsNodes: Node[],
): Promise<boolean> {
    const [idbProjects, idbNodes] = await Promise.all([idb.loadProjects(), idb.loadNodes()]);
    if (!shouldMigrate(idbProjects, idbNodes, lsProjects, lsNodes)) return false;
    const merged = mergeForMigration(idbProjects, idbNodes, lsProjects, lsNodes);
    try {
        await idb.saveProjects(merged.projects);
        await idb.saveNodes(merged.nodes);
        const [checkProjects, checkNodes] = await Promise.all([idb.loadProjects(), idb.loadNodes()]);
        if (checkProjects.length !== merged.projects.length || checkNodes.length !== merged.nodes.length) {
            throw new Error("Migration verification failed.");
        }
    } catch (e) {
        // Never strand a partial migration: IDB must read empty so the next
        // boot retries via shouldMigrate instead of trusting incomplete data.
        await idb.saveProjects([]).catch(() => undefined);
        await idb.saveNodes([]).catch(() => undefined);
        throw e;
    }
    return true;
}

let initPromise: Promise<InitResult> | null = null;

export function __resetStorageInitForTests(): void {
    initPromise = null;
}

export function initStorage(deps: InitDeps = {}): Promise<InitResult> {
    if (initPromise) return initPromise;
    initPromise = doInit(deps);
    return initPromise;
}

async function doInit(deps: InitDeps): Promise<InitResult> {
    const createIdb = deps.createIdb ?? defaultCreateIdb;
    const readLocal = deps.readLocal ?? defaultReadLocal;
    let idb: StorageBackend | null;
    try {
        idb = createIdb();
    } catch {
        idb = null;
    }
    if (idb === null) return localOrMemoryResult();
    let local: { projects: Project[]; nodes: Node[] };
    try {
        local = readLocal();
    } catch {
        local = { projects: [], nodes: [] };
    }
    try {
        const migrated = await runMigration(idb, local.projects, local.nodes);
        return { backend: idb, migrated, fallback: "indexeddb" };
    } catch {
        return localOrMemoryResult();
    }
}
