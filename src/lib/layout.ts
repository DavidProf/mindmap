// Tidy layered tree layout — stateless, pure, no DOM.
// Constants chosen for fixed 88px circles and readable spacing.

import type { Node } from "../types/node";

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

export function computeLayout(
    nodes: Node[],
    rootId: string,
    opts?: { gapX?: number; gapY?: number; nodeDiameter?: number },
): LayoutResult {
    const gapX = opts?.gapX ?? GAP_X;
    const gapY = opts?.gapY ?? GAP_Y;
    const diameter = opts?.nodeDiameter ?? NODE_DIAMETER;
    const stepX = diameter + gapX;
    const stepY = diameter + gapY;
    const radius = diameter / 2;

    const positions = new Map<string, Position>();
    const hiddenIds = new Set<string>();
    const edges: { from: string; to: string }[] = [];

    if (nodes.length === 0) {
        return { positions, edges, bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 }, hiddenIds };
    }

    const nodeById = new Map<string, Node>();
    for (const n of nodes) nodeById.set(n.id, n);

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

    // Recursive tidy placement
    let nextX = 0;
    const placementVisited = new Set<string>();

    function place(id: string, depth: number): void {
        if (placementVisited.has(id)) {
            console.warn(`[layout] cycle detected at ${id}, skipping`);
            return;
        }
        placementVisited.add(id);
        const children = (childrenMap.get(id) ?? []).filter((c) => visibleIds.has(c.id));
        if (children.length === 0) {
            const x = nextX;
            nextX += stepX;
            positions.set(id, { x, y: depth * stepY });
        } else {
            for (const child of children) place(child.id, depth + 1);
            // Average of children's x; if a child was cycle-skipped and has no position, filter it
            const childXs = children
                .map((c) => positions.get(c.id))
                .filter((p): p is Position => p !== undefined)
                .map((p) => p.x);
            if (childXs.length === 0) {
                const x = nextX;
                nextX += stepX;
                positions.set(id, { x, y: depth * stepY });
            } else {
                const avg = childXs.reduce((a, b) => a + b, 0) / childXs.length;
                positions.set(id, { x: avg, y: depth * stepY });
            }
        }
    }

    place(rootId, 0);

    // Center root at (0,0)
    const rootPos = positions.get(rootId);
    if (rootPos) {
        const offX = rootPos.x;
        const offY = rootPos.y;
        for (const [k, v] of positions) {
            positions.set(k, { x: v.x - offX, y: v.y - offY });
        }
    }

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
