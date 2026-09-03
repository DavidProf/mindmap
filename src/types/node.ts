export const NODE_SIDES = ["north", "east", "south", "west"] as const;

export type NodeSide = (typeof NODE_SIDES)[number];

export function isNodeSide(value: unknown): value is NodeSide {
    return typeof value === "string" && (NODE_SIDES as readonly string[]).includes(value);
}

export type Node = {
    id: string;
    projectId: string;
    parentId: string | null;
    text: string;
    side: NodeSide | null;
    collapsed: boolean;
    createdAt: string;
    updatedAt: string;
};
