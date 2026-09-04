import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import AppHeader from "../components/layout/AppHeader";
import TreeCanvas from "../components/canvas/TreeCanvas";
import { loadProjects, loadNodes, addChildNode, updateNodeText, setNodeCollapsed, deleteNodeSubtree } from "../lib/storage";
import { computeLayout } from "../lib/layout";
import { exportMapAsPng } from "../lib/exportPng";
import type { Project } from "../types/project";
import type { Node, NodeSide } from "../types/node";
import "./EditorPage.css";

export default function EditorPage() {
    const { projectId } = useParams<{ projectId: string }>();

    const projects = loadProjects();
    const project = projects.find((p) => p.id === projectId);

    if (!projectId || !project) {
        return (
            <>
                <AppHeader variant="editor" projectName="Untitled project" />
                <main className="editor-canvas editor-canvas--center">
                    <div className="editor-placeholder">
                        <h2 style={{ fontSize: "16px", margin: 0 }}>Project not found</h2>
                        <p style={{ color: "var(--muted)", fontSize: "13px", margin: "8px 0 0" }}>
                            No project matches <code>{projectId ?? ""}</code>
                        </p>
                        <Link to="/" style={{ fontSize: "13px", marginTop: "12px", display: "inline-block" }}>
                            Back to projects
                        </Link>
                    </div>
                </main>
            </>
        );
    }

    return <EditorCanvas key={project.id} project={project} />;
}

function EditorCanvas({ project }: { project: Project }) {
    const [nodes, setNodes] = useState<Node[]>(() => loadNodes().filter((n) => n.projectId === project.id));
    const [recenterSignal, setRecenterSignal] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    function refreshNodes() {
        setNodes(loadNodes().filter((n) => n.projectId === project.id));
    }

    function handleAddChild(parentId: string, text: string, side: NodeSide): Node | null {
        try {
            // New children must be visible, so adding to a collapsed
            // parent expands it (the collapse toggle itself is feature 5).
            const parent = nodes.find((n) => n.id === parentId);
            if (parent?.collapsed) setNodeCollapsed(parent.id, false);
            const child = addChildNode(project.id, parentId, text, side);
            refreshNodes();
            setError(null);
            return child;
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not add node.");
            return null;
        }
    }

    function handleUpdateText(nodeId: string, text: string): Node | null {
        try {
            const updated = updateNodeText(nodeId, text);
            refreshNodes();
            setError(null);
            return updated;
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not update node.");
            return null;
        }
    }

    function handleToggleCollapsed(nodeId: string): Node | null {
        try {
            const node = nodes.find((n) => n.id === nodeId);
            if (!node) return null;
            const updated = setNodeCollapsed(nodeId, !node.collapsed);
            refreshNodes();
            setError(null);
            return updated;
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not collapse node.");
            return null;
        }
    }

    function handleDeleteSubtree(nodeId: string): { deletedIds: string[] } | null {
        try {
            const res = deleteNodeSubtree(nodeId);
            refreshNodes();
            setError(null);
            return res;
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not delete node.");
            return null;
        }
    }

    const rootNode = nodes.find((n) => n.id === project.rootNodeId);

    if (nodes.length === 0 || !rootNode) {
        return (
            <>
                <AppHeader variant="editor" projectName={project.name} />
                <main className="editor-canvas editor-canvas--center">
                    <div className="editor-placeholder">
                        <h2 style={{ fontSize: "16px", margin: 0 }}>Empty map</h2>
                        <p style={{ color: "var(--muted)", fontSize: "13px", margin: "8px 0 0" }}>
                            No nodes found for this project.
                        </p>
                    </div>
                </main>
            </>
        );
    }

    const layout = computeLayout(nodes, project.rootNodeId);

    async function handleExport() {
        if (exporting) return;
        setExporting(true);
        try {
            const visibleNodes = nodes.filter((n) => layout.positions.has(n.id));
            await exportMapAsPng({
                projectName: project.name,
                nodes: visibleNodes,
                positions: layout.positions,
                edges: layout.edges,
                bounds: layout.bounds,
            });
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not export PNG.");
        } finally {
            setExporting(false);
        }
    }

    return (
        <>
            <AppHeader
                variant="editor"
                projectName={project.name}
                onRecenter={() => setRecenterSignal((n) => n + 1)}
                onExport={handleExport}
                exporting={exporting}
            />
            <main className="editor-canvas">
                {error && (
                    <div className="editor-error" role="alert">
                        <span>{error}</span>
                        <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">
                            Dismiss
                        </button>
                    </div>
                )}
                <TreeCanvas
                    projectId={project.id}
                    rootNodeId={project.rootNodeId}
                    nodes={nodes}
                    positions={layout.positions}
                    edges={layout.edges}
                    bounds={layout.bounds}
                    recenterSignal={recenterSignal}
                    onAddChild={handleAddChild}
                    onUpdateText={handleUpdateText}
                    onToggleCollapsed={handleToggleCollapsed}
                    onDeleteSubtree={handleDeleteSubtree}
                />
            </main>
        </>
    );
}
