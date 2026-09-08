import type { Node } from "../types/node";
import { normalizeNodes } from "../types/node";
import type { Project } from "../types/project";
import { loadNodes, loadProjects, saveNodes, saveProjects } from "./localStore";

export type StorageBackendKind = "indexeddb" | "localstorage" | "memory";

export type StorageBackend = {
    kind: StorageBackendKind;
    loadProjects(): Promise<Project[]>;
    loadNodes(): Promise<Node[]>;
    saveProjects(projects: Project[]): Promise<void>;
    saveNodes(nodes: Node[]): Promise<void>;
};

export function createLocalStorageBackend(): StorageBackend {
    return {
        kind: "localstorage",
        loadProjects: () => Promise.resolve(loadProjects()),
        loadNodes: () => Promise.resolve(loadNodes()),
        saveProjects: (projects) => Promise.resolve(saveProjects(projects)),
        saveNodes: (nodes) => Promise.resolve(saveNodes(nodes)),
    };
}

export function createMemoryBackend(seed?: { projects?: Project[]; nodes?: Node[] }): StorageBackend {
    let projects = [...(seed?.projects ?? [])];
    let nodes = normalizeNodes([...(seed?.nodes ?? [])]);
    return {
        kind: "memory",
        loadProjects: () => Promise.resolve([...projects]),
        loadNodes: () => Promise.resolve([...nodes]),
        saveProjects: (next) => {
            projects = [...next];
            return Promise.resolve();
        },
        saveNodes: (next) => {
            nodes = [...next];
            return Promise.resolve();
        },
    };
}

export function shouldMigrate(
    idbProjects: Project[],
    idbNodes: Node[],
    lsProjects: Project[],
    lsNodes: Node[],
): boolean {
    const idbEmpty = idbProjects.length === 0 && idbNodes.length === 0;
    if (!idbEmpty) return false;
    return lsProjects.length > 0 || lsNodes.length > 0;
}

export function mergeForMigration(
    idbProjects: Project[],
    idbNodes: Node[],
    lsProjects: Project[],
    lsNodes: Node[],
): { projects: Project[]; nodes: Node[] } {
    if (!shouldMigrate(idbProjects, idbNodes, lsProjects, lsNodes)) {
        return { projects: [...idbProjects], nodes: [...idbNodes] };
    }
    return { projects: [...lsProjects], nodes: [...lsNodes] };
}
