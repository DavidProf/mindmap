import { describe, expect, it, vi } from "vitest";
import { computeLayout, GAP_X, GAP_Y, NODE_DIAMETER } from "./layout";
import type { Node, NodeSide } from "../types/node";

const STAMP = "2026-01-01T00:00:00.000Z";

function node(id: string, parentId: string | null, side: NodeSide | null = "south"): Node {
    return { id, projectId: "p", parentId, text: id, side, collapsed: false, createdAt: STAMP, updatedAt: STAMP };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function segmentsIntersect(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    p4: { x: number; y: number },
): boolean {
    const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (Math.abs(d) < 1e-9) return false;
    const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
    const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
    return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9;
}

function pointToSegmentDistance(
    p: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number },
): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return dist(p, a);
    const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
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

    it("keeps an opposite-side grandchild nearer its parent than root (case a)", () => {
        const nodes = [
            node("root", null),
            node("A", "root", "east"),
            node("B", "root", "east"),
            node("D", "root", "east"),
            node("C", "B", "west"),
        ];
        const result = computeLayout(nodes, "root");
        const c = result.positions.get("C")!;
        const b = result.positions.get("B")!;
        const root = result.positions.get("root")!;
        const a = result.positions.get("A")!;
        expect(dist(c, b)).toBeLessThan(dist(c, root));
        expect(dist(c, b)).toBeLessThan(dist(c, a));
        expect(Math.abs(dist(c, b) - (NODE_DIAMETER + GAP_Y)) / (NODE_DIAMETER + GAP_Y)).toBeLessThan(0.01);
    });

    it("separates nested same-direction subtrees without edge crossings (case b)", () => {
        const nodes = [
            node("root", null),
            node("A", "root", "east"),
            node("B", "root", "east"),
            node("C", "B", "east"),
            node("D", "A", "south"),
        ];
        const result = computeLayout(nodes, "root");
        const pos = result.positions;
        const sharesEndpoint = (e1: { from: string; to: string }, e2: { from: string; to: string }) =>
            e1.from === e2.from || e1.from === e2.to || e1.to === e2.from || e1.to === e2.to;
        for (let i = 0; i < result.edges.length; i++) {
            for (let j = i + 1; j < result.edges.length; j++) {
                const e1 = result.edges[i];
                const e2 = result.edges[j];
                if (sharesEndpoint(e1, e2)) continue;
                const p1 = pos.get(e1.from)!;
                const p2 = pos.get(e1.to)!;
                const p3 = pos.get(e2.from)!;
                const p4 = pos.get(e2.to)!;
                expect(segmentsIntersect(p1, p2, p3, p4)).toBe(false);
            }
        }
        for (const n of nodes) {
            const p = pos.get(n.id);
            if (!p) continue;
            for (const e of result.edges) {
                if (e.from === n.id || e.to === n.id) continue;
                const a = pos.get(e.from)!;
                const b = pos.get(e.to)!;
                expect(pointToSegmentDistance(p, a, b)).toBeGreaterThanOrEqual(NODE_DIAMETER / 2 - 1e-6);
            }
        }
    });

    it("keeps a deep grandchild nearer its parent than its grandparent when an unrelated branch is added", () => {
        const tree = (withF: boolean) => {
            const nodes = [
                node("R", null),
                node("A", "R", "west"),
                node("B", "A", "north"),
                node("C", "B", "east"),
                node("D", "C", "south"),
                node("E", "C", "south"),
            ];
            if (withF) nodes.push(node("F", "R", "east"));
            return nodes;
        };
        for (const withF of [false, true]) {
            const result = computeLayout(tree(withF), "R");
            const e = result.positions.get("E")!;
            const c = result.positions.get("C")!;
            const b = result.positions.get("B")!;
            expect(dist(e, c)).toBeLessThan(dist(e, b));
        }
    });
});
