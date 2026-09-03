export type Viewport = {
    x: number;
    y: number;
    zoom: number;
};

export type Project = {
    id: string;
    name: string;
    rootNodeId: string;
    createdAt: string;
    updatedAt: string;
    viewport: Viewport;
};
