import type { Node } from "../types/node";

export const MAX_HISTORY_ENTRIES = 50;
export const LARGE_SNAPSHOT_NODE_THRESHOLD = 200;
export const MAX_HISTORY_ENTRIES_LARGE = 10;

export function historyCapForSnapshot(nodeCount: number): number {
    return nodeCount > LARGE_SNAPSHOT_NODE_THRESHOLD ? MAX_HISTORY_ENTRIES_LARGE : MAX_HISTORY_ENTRIES;
}

export type HistoryEntry<T> = {
    label: string;
    before: T;
    after: T;
};

export type HistoryStack<T> = {
    past: HistoryEntry<T>[];
    future: HistoryEntry<T>[];
};

export function createHistory<T>(): HistoryStack<T> {
    return { past: [], future: [] };
}

export function pushEntry<T>(stack: HistoryStack<T>, entry: HistoryEntry<T>, cap: number = MAX_HISTORY_ENTRIES): HistoryStack<T> {
    const past = [...stack.past, entry];
    const trimmed = past.length > cap ? past.slice(past.length - cap) : past;
    return { past: trimmed, future: [] };
}

export function canUndo<T>(stack: HistoryStack<T>): boolean {
    return stack.past.length > 0;
}

export function canRedo<T>(stack: HistoryStack<T>): boolean {
    return stack.future.length > 0;
}

export function undo<T>(stack: HistoryStack<T>): { stack: HistoryStack<T>; entry: HistoryEntry<T> | null } {
    const entry = stack.past[stack.past.length - 1] ?? null;
    if (!entry) return { stack, entry: null };
    return {
        stack: {
            past: stack.past.slice(0, -1),
            future: [...stack.future, entry],
        },
        entry,
    };
}

export function redo<T>(stack: HistoryStack<T>): { stack: HistoryStack<T>; entry: HistoryEntry<T> | null } {
    const entry = stack.future[stack.future.length - 1] ?? null;
    if (!entry) return { stack, entry: null };
    return {
        stack: {
            past: [...stack.past, entry],
            future: stack.future.slice(0, -1),
        },
        entry,
    };
}

export function clearHistory<T>(): HistoryStack<T> {
    return createHistory<T>();
}

export function cloneNodes(list: Node[]): Node[] {
    return list.map((n) => ({ ...n, media: n.media ? { ...n.media } : null }));
}

export function snapshotsEqual(a: Node[], b: Node[]): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}
