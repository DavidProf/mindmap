import { describe, expect, it } from "vitest";
import { canRedo, canUndo, clearHistory, cloneNodes, createHistory, historyCapForSnapshot, pushEntry, redo, snapshotsEqual, undo } from "./history";
import type { Node } from "../types/node";

function node(id: string, text: string): Node {
    const now = "2026-01-01T00:00:00.000Z";
    return {
        id,
        projectId: "p1",
        parentId: "root",
        text,
        kind: "circle",
        url: null,
        media: null,
        mediaFill: true,
        size: "small",
        side: "east",
        collapsed: false,
        createdAt: now,
        updatedAt: now,
    };
}

describe("history stack", () => {
    it("starts empty with no undo or redo", () => {
        const stack = createHistory<string[]>();
        expect(canUndo(stack)).toBe(false);
        expect(canRedo(stack)).toBe(false);
    });

    it("pushes entries and undoes in reverse order", () => {
        let stack = createHistory<string>();
        stack = pushEntry(stack, { label: "first", before: "a", after: "b" });
        stack = pushEntry(stack, { label: "second", before: "b", after: "c" });
        expect(canUndo(stack)).toBe(true);

        const first = undo(stack);
        expect(first.entry?.label).toBe("second");
        expect(first.entry?.before).toBe("b");
        expect(canRedo(first.stack)).toBe(true);

        const second = undo(first.stack);
        expect(second.entry?.label).toBe("first");
        expect(canUndo(second.stack)).toBe(false);
    });

    it("redoes after undo", () => {
        let stack = createHistory<number>();
        stack = pushEntry(stack, { label: "edit", before: 1, after: 2 });
        const undone = undo(stack);
        const redone = redo(undone.stack);
        expect(redone.entry?.after).toBe(2);
        expect(canRedo(redone.stack)).toBe(false);
        expect(canUndo(redone.stack)).toBe(true);
    });

    it("clears redo on a new push", () => {
        let stack = createHistory<number>();
        stack = pushEntry(stack, { label: "one", before: 1, after: 2 });
        stack = undo(stack).stack;
        expect(canRedo(stack)).toBe(true);
        stack = pushEntry(stack, { label: "two", before: 2, after: 3 });
        expect(canRedo(stack)).toBe(false);
    });

    it("caps the past at the limit and drops the oldest", () => {
        let stack = createHistory<number>();
        for (let i = 0; i < 55; i++) {
            stack = pushEntry(stack, { label: `e${i}`, before: i, after: i + 1 });
        }
        expect(stack.past).toHaveLength(50);
        expect(stack.past[0].label).toBe("e5");
    });

    it("shrinks the cap for large snapshots", () => {
        expect(historyCapForSnapshot(15)).toBe(50);
        expect(historyCapForSnapshot(200)).toBe(50);
        expect(historyCapForSnapshot(201)).toBe(10);
    });

    it("trims to a custom cap on push", () => {
        let stack = createHistory<number>();
        for (let i = 0; i < 15; i++) {
            stack = pushEntry(stack, { label: `e${i}`, before: i, after: i + 1 }, 10);
        }
        expect(stack.past).toHaveLength(10);
        expect(stack.past[0].label).toBe("e5");
    });

    it("is a no-op on empty undo and redo", () => {
        const stack = createHistory<number>();
        expect(undo(stack).entry).toBeNull();
        expect(redo(stack).entry).toBeNull();
    });

    it("clears to an empty stack", () => {
        const filled = pushEntry(createHistory<number>(), { label: "one", before: 1, after: 2 });
        expect(canUndo(filled)).toBe(true);
        const stack = clearHistory<number>();
        expect(canUndo(stack)).toBe(false);
        expect(canRedo(stack)).toBe(false);
    });

    it("clones nodes so later edits do not alias the snapshot", () => {
        const original = [node("a", "Alpha")];
        const cloned = cloneNodes(original);
        cloned[0].text = "Changed";
        expect(original[0].text).toBe("Alpha");
    });

    it("compares snapshots by value", () => {
        expect(snapshotsEqual([node("a", "Alpha")], [node("a", "Alpha")])).toBe(true);
        expect(snapshotsEqual([node("a", "Alpha")], [node("a", "Beta")])).toBe(false);
        expect(snapshotsEqual([node("a", "Alpha")], [])).toBe(false);
    });
});
