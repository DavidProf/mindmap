import { describe, expect, it, vi } from "vitest";
import { computeLayout, GAP_X, GAP_Y, NODE_DIAMETER } from "./layout";
import type { Node, NodeSide } from "../types/node";

const STAMP = "2026-01-01T00:00:00.000Z";

function node(id: string, parentId: string | null, side: NodeSide | null = "south"): Node {
    return { id, projectId: "p", parentId, text: id, side, collapsed: false, createdAt: STAMP, updatedAt: STAMP };
}

describe("computeLayout", () => {
    it("returns empty results for no nodes", () => {
        const result = computeLayout([], "missing");
        expect(result.positions.size).toBe(0);
        expect(result.edges).toEqual([]);
        expect(result.hiddenIds.size).toBe(0);
    });

    it("returns empty results for an unknown root", () => {
        const result = computeLayout([node("a", null)], "missing");
        expect(result.positions.size).toBe(0);
    });

    it("centers a single root at the origin", () => {
        const result = computeLayout([node("root", null)], "root");
        expect(result.positions.get("root")).toEqual({ x: 0, y: 0 });
        expect(result.edges).toEqual([]);
    });

    it("places one child per side in its quadrant", () => {
        const nodes = [
            node("root", null),
            node("e", "root", "east"),
            node("s", "root", "south"),
            node("w", "root", "west"),
            node("n", "root", "north"),
        ];
        const result = computeLayout(nodes, "root");
        expect(result.positions.get("e")!.x).toBeGreaterThan(0);
        expect(result.positions.get("s")!.y).toBeGreaterThan(0);
        expect(result.positions.get("w")!.x).toBeLessThan(0);
        expect(result.positions.get("n")!.y).toBeLessThan(0);
        expect(result.edges).toHaveLength(4);
    });

    it("defaults a missing side to south", () => {
        const nodes = [node("root", null), node("child", "root", null)];
        const result = computeLayout(nodes, "root");
        expect(result.positions.get("child")!.y).toBeGreaterThan(0);
    });

    it("hides collapsed subtrees", () => {
        const parent = { ...node("child", "root", "east"), collapsed: true };
        const nodes = [node("root", null), parent, node("grand", "child", "east")];
        const result = computeLayout(nodes, "root");
        expect(result.positions.has("child")).toBe(true);
        expect(result.positions.has("grand")).toBe(false);
        expect(result.hiddenIds.has("grand")).toBe(true);
        expect(result.edges.some((e) => e.to === "grand")).toBe(false);
    });

    it("terminates on cyclic parent links", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        try {
            const selfLoop = node("loop", "root", "east");
            const nodes = [node("root", null), selfLoop, node("loop", "loop", "east")];
            const result = computeLayout(nodes, "root");
            expect(result.positions.has("root")).toBe(true);
        } finally {
            warn.mockRestore();
        }
    });

    it("keeps every pair of nodes at least one diameter apart", () => {
        const sides: NodeSide[] = ["east", "south", "west", "north"];
        const nodes: Node[] = [node("root", null)];
        for (let i = 0; i < 20; i++) {
            const parent = i < 4 ? "root" : `n${i - 4}`;
            nodes.push(node(`n${i}`, parent, sides[i % sides.length]));
        }
        const result = computeLayout(nodes, "root");
        const points = [...result.positions.values()];
        expect(points.length).toBeGreaterThan(10);
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                const dx = points[i].x - points[j].x;
                const dy = points[i].y - points[j].y;
                expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(NODE_DIAMETER - 1e-6);
            }
        }
    });

    it("reports bounds padded by node radius", () => {
        const nodes = [node("root", null), node("child", "root", "east")];
        const { bounds } = computeLayout(nodes, "root");
        expect(bounds.width).toBeGreaterThanOrEqual(NODE_DIAMETER);
        expect(bounds.height).toBeGreaterThanOrEqual(NODE_DIAMETER);
        expect(bounds.minX).toBeLessThanOrEqual(-NODE_DIAMETER / 2);
    });

    it("exposes the layout constants used by canvas and export", () => {
        expect(NODE_DIAMETER).toBe(88);
        expect(GAP_X).toBe(32);
        expect(GAP_Y).toBe(72);
    });
});
