export const NODE_SIDES = ["north", "east", "south", "west"] as const;

export type NodeSide = (typeof NODE_SIDES)[number];

export function isNodeSide(value: unknown): value is NodeSide {
    return typeof value === "string" && (NODE_SIDES as readonly string[]).includes(value);
}

export const NODE_KINDS = ["circle", "note"] as const;

export type NodeKind = (typeof NODE_KINDS)[number];

export function isNodeKind(value: unknown): value is NodeKind {
    return typeof value === "string" && (NODE_KINDS as readonly string[]).includes(value);
}

export function normalizeNodeKind(value: unknown): NodeKind {
    return isNodeKind(value) ? value : "circle";
}

export type Node = {
    id: string;
    projectId: string;
    parentId: string | null;
    text: string;
    kind: NodeKind;
    side: NodeSide | null;
    collapsed: boolean;
    createdAt: string;
    updatedAt: string;
};

export function normalizeNodes(nodes: Node[]): Node[] {
    let changed = false;
    const out = nodes.map((n) => {
        if (isNodeKind(n.kind)) return n;
        changed = true;
        return { ...n, kind: "circle" as NodeKind };
    });
    return changed ? out : nodes;
}
