// Radial tidy-tree layout - stateless, pure, no DOM.
// Root centers at (0,0); branches grow toward N/E/S/W by Node.side.
// Same-side siblings fan out across their side quadrant, weighted by
// visible leaf count. Constants tuned for fixed 88px circles.

import type { Node, NodeSide } from "../types/node";
import { isNodeSide } from "../types/node";

export const NODE_DIAMETER = 88;
export const GAP_X = 32;
export const GAP_Y = 72;

export type Position = { x: number; y: number };

export type LayoutResult = {
    positions: Map<string, Position>;
    edges: { from: string; to: string }[];
    bounds: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number };
    hiddenIds: Set<string>;
};

const SIDE_ORDER: readonly NodeSide[] = ["east", "south", "west", "north"];

// Screen coords (y down): east 0deg, south 90deg, west 180deg, north 270deg.
const SIDE_BASE_DEG: Record<NodeSide, number> = { east: 0, south: 90, west: 180, north: 270 };
const QUADRANT_DEG = 90;

function sideOf(node: Node): NodeSide {
    return isNodeSide(node.side) ? node.side : "south";
}

export function computeLayout(
    nodes: Node[],
    rootId: string,
    opts?: { gapX?: number; gapY?: number; nodeDiameter?: number },
): LayoutResult {
    const gapX = opts?.gapX ?? GAP_X;
    const gapY = opts?.gapY ?? GAP_Y;
    const diameter = opts?.nodeDiameter ?? NODE_DIAMETER;
    const step = diameter + gapY;
    const radius = diameter / 2;
    // Inter-quadrant gap sized to roughly gapX at one radial step, clamped.
    const marginDeg = Math.min(20, Math.max(2, ((gapX / step) * 180) / Math.PI / 2));

    const positions = new Map<string, Position>();
    const hiddenIds = new Set<string>();
    const edges: { from: string; to: string }[] = [];

    if (nodes.length === 0) {
        return { positions, edges, bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 }, hiddenIds };
    }

    const nodeById = new Map<string, Node>();
    for (const n of nodes) nodeById.set(n.id, n);

    const parentById = new Map<string, string | null>();
    for (const n of nodes) parentById.set(n.id, n.parentId);

    const childrenMap = new Map<string, Node[]>();
    for (const n of nodes) {
        if (n.parentId === null) continue;
        const arr = childrenMap.get(n.parentId);
        if (arr) arr.push(n);
        else childrenMap.set(n.parentId, [n]);
    }

    const rootNode = nodeById.get(rootId);
    if (!rootNode) {
        return { positions, edges, bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 }, hiddenIds };
    }

    // Determine visible vs hidden (collapsed subtree)
    const visibleIds = new Set<string>();
    const visitedForVisibility = new Set<string>();

    // Stack for BFS/DFS from root, respecting collapsed
    const stack: string[] = [rootId];
    while (stack.length > 0) {
        const id = stack.pop()!;
        if (visitedForVisibility.has(id)) {
            console.warn(`[layout] cycle or duplicate visit for ${id}, skipping`);
            continue;
        }
        visitedForVisibility.add(id);
        const node = nodeById.get(id);
        if (!node) continue;
        visibleIds.add(id);

        const children = childrenMap.get(id) ?? [];
        if (node.collapsed) {
            // Hide entire subtree under this node
            const queue: Node[] = [...children];
            const seenHidden = new Set<string>();
            while (queue.length > 0) {
                const cur = queue.shift()!;
                if (seenHidden.has(cur.id)) continue;
                seenHidden.add(cur.id);
                hiddenIds.add(cur.id);
                const grand = childrenMap.get(cur.id) ?? [];
                for (const g of grand) queue.push(g);
            }
            // Do not push children to stack — they are hidden
        } else {
            // Push children in reverse so insertion order is preserved when popping
            for (let i = children.length - 1; i >= 0; i--) {
                stack.push(children[i].id);
            }
        }
    }

    function visibleChildren(id: string): Node[] {
        return (childrenMap.get(id) ?? []).filter((c) => visibleIds.has(c.id));
    }

    // Visible leaf count per node weights each sibling's share of its quadrant.
    const leafCount = new Map<string, number>();
    const counting = new Set<string>();
    function countLeaves(id: string): number {
        const cached = leafCount.get(id);
        if (cached !== undefined) return cached;
        if (counting.has(id)) return 0;
        counting.add(id);
        const children = visibleChildren(id);
        let total = 0;
        for (const child of children) total += countLeaves(child.id);
        counting.delete(id);
        const result = children.length === 0 ? 1 : total;
        leafCount.set(id, result);
        return result;
    }
    countLeaves(rootId);

    // Recursive radial placement, one step per depth.
    const placementVisited = new Set<string>();
    const toRad = Math.PI / 180;

    function clashes(x: number, y: number): boolean {
        for (const p of positions.values()) {
            if (Math.hypot(p.x - x, p.y - y) < diameter) return true;
        }
        return false;
    }

    // Strict-interior segment intersection. Touches at shared endpoints are
    // normal tree joints, not crossings.
    function edgesCross(p1: Position, p2: Position, p3: Position, p4: Position): boolean {
        const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
        if (Math.abs(d) < 1e-9) return false;
        const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
        const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
        return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9;
    }

    function distToSeg(p: Position, a: Position, b: Position): number {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
        const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
        return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    }

    // Edges placed so far, in DFS order. Every placed node except root has a
    // visible parent, so this ends up equal to the returned edge list.
    const placedEdges: { from: string; to: string }[] = [];

    // True when edge parent→q crosses no placed edge and keeps half-diameter
    // clearance between q and placed edges and between placed nodes and itself.
    function edgeClean(parentId: string, px: number, py: number, q: Position): boolean {
        const p = { x: px, y: py };
        for (const e of placedEdges) {
            if (e.from === parentId || e.to === parentId) continue;
            const a = positions.get(e.from);
            const b = positions.get(e.to);
            if (!a || !b) continue;
            if (edgesCross(p, q, a, b)) return false;
            if (distToSeg(q, a, b) < diameter / 2 - 1e-6) return false;
        }
        for (const [id, n] of positions) {
            if (id === parentId) continue;
            if (distToSeg(n, p, q) < diameter / 2 - 1e-6) return false;
        }
        return true;
    }

    function resolveOverlap(px: number, py: number, x: number, y: number): Position {
        // A branch can fold back onto placed nodes (e.g. a west child of an
        // east node lands on the root). Push outward along the same ray until
        // clear so every pair stays at least one diameter apart.
        for (let i = 0; i < 50; i++) {
            if (!clashes(x, y)) return { x, y };
            const dx = x - px;
            const dy = y - py;
            const len = Math.hypot(dx, dy) || 1;
            const next = len + step * 0.5;
            x = px + (dx / len) * next;
            y = py + (dy / len) * next;
        }
        return { x, y };
    }

    // Candidate deflection schedule for repairs: smallest change first so a
    // node keeps its requested bearing unless readability forces it away.
    const FINE_DEGS = [10, -10, 20, -20, 30, -30, 45, -45, 60, -60, 90, -90, 120, -120, 150, -150, 180];

    // Rotation search for fold-back children. Pushing further out along the
    // same ray can never make the child nearer its parent than its
    // grandparent, so rotate around the parent instead and take the finest
    // bearing that is clash-free with the parent still nearest.
    function placeReadable(parentId: string, px: number, py: number, baseAngle: number): Position {
        for (const deg of FINE_DEGS) {
            const a = baseAngle + deg * toRad;
            const x = px + step * Math.cos(a);
            const y = py + step * Math.sin(a);
            if (clashes(x, y)) continue;
            let nearest = true;
            for (const p of positions.values()) {
                if (p.x === px && p.y === py) continue;
                if (Math.hypot(p.x - x, p.y - y) < step - 1e-6) {
                    nearest = false;
                    break;
                }
            }
            if (!nearest) continue;
            if (!edgeClean(parentId, px, py, { x, y })) continue;
            return { x, y };
        }
        const raw = { x: px + step * Math.cos(baseAngle), y: py + step * Math.sin(baseAngle) };
        return resolveOverlap(px, py, raw.x, raw.y);
    }

    // Repair for placements whose straight edge would cross a placed edge or
    // crowd a corridor. For each bearing, finest first, push out along that
    // ray to the smallest clash-free radius before accepting it, so direction
    // bends as little as readability allows.
    function placeSeparated(parentId: string, px: number, py: number, baseAngle: number): Position {
        const gpId = parentById.get(parentId) ?? null;
        const gp = gpId ? positions.get(gpId) : undefined;
        for (const deg of FINE_DEGS) {
            const a = baseAngle + deg * toRad;
            const raw = { x: px + step * Math.cos(a), y: py + step * Math.sin(a) };
            const q = resolveOverlap(px, py, raw.x, raw.y);
            if (gp && Math.hypot(q.x - gp.x, q.y - gp.y) < Math.hypot(q.x - px, q.y - py) - 1e-6) continue;
            if (!edgeClean(parentId, px, py, q)) continue;
            return q;
        }
        const raw = { x: px + step * Math.cos(baseAngle), y: py + step * Math.sin(baseAngle) };
        return resolveOverlap(px, py, raw.x, raw.y);
    }

    function placeChildren(parentId: string, px: number, py: number): void {
        const children = visibleChildren(parentId);
        if (children.length === 0) return;
        const groups = new Map<NodeSide, Node[]>();
        for (const child of children) {
            const s = sideOf(child);
            const arr = groups.get(s);
            if (arr) arr.push(child);
            else groups.set(s, [child]);
        }
        for (const side of SIDE_ORDER) {
            const group = groups.get(side);
            if (!group || group.length === 0) continue;
            const base = SIDE_BASE_DEG[side] * toRad;
            const half = ((QUADRANT_DEG - marginDeg * 2) / 2) * toRad;
            const total = group.reduce((a, c) => a + (leafCount.get(c.id) ?? 1), 0);
            let acc = 0;
            for (const child of group) {
                if (placementVisited.has(child.id)) {
                    console.warn(`[layout] cycle detected at ${child.id}, skipping`);
                    continue;
                }
                placementVisited.add(child.id);
                const w = leafCount.get(child.id) ?? 1;
                const frac = total > 0 ? (acc + w / 2) / total : 0.5;
                const angle = base - half + frac * half * 2;
                const gpId = parentById.get(parentId) ?? null;
                const gp = gpId ? positions.get(gpId) : undefined;
                const raw = { x: px + step * Math.cos(angle), y: py + step * Math.sin(angle) };
                let pos =
                    gp && Math.hypot(raw.x - gp.x, raw.y - gp.y) < step + 1e-9
                        ? placeReadable(parentId, px, py, angle)
                        : resolveOverlap(px, py, raw.x, raw.y);
                if (!edgeClean(parentId, px, py, pos)) pos = placeSeparated(parentId, px, py, angle);
                positions.set(child.id, pos);
                placedEdges.push({ from: parentId, to: child.id });
                acc += w;
                placeChildren(child.id, pos.x, pos.y);
            }
        }
    }

    placementVisited.add(rootId);
    positions.set(rootId, { x: 0, y: 0 });
    placeChildren(rootId, 0, 0);

    // Edges only for visible parent→child
    for (const id of visibleIds) {
        if (id === rootId) continue;
        const node = nodeById.get(id);
        if (!node || node.parentId === null) continue;
        if (visibleIds.has(node.parentId)) {
            edges.push({ from: node.parentId, to: id });
        }
    }

    // Bounds with radius padding
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    if (positions.size === 0) {
        minX = 0;
        maxX = 0;
        minY = 0;
        maxY = 0;
    } else {
        for (const p of positions.values()) {
            minX = Math.min(minX, p.x - radius);
            maxX = Math.max(maxX, p.x + radius);
            minY = Math.min(minY, p.y - radius);
            maxY = Math.max(maxY, p.y + radius);
        }
    }

    const bounds = {
        minX,
        maxX,
        minY,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
    };

    return { positions, edges, bounds, hiddenIds };
}
