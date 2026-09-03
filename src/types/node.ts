export type Node = {
    id: string;
    projectId: string;
    parentId: string | null;
    text: string;
    collapsed: boolean;
    createdAt: string;
    updatedAt: string;
};
