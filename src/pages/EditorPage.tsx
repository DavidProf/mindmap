import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import AppHeader from "../components/layout/AppHeader";
import TreeCanvas from "../components/canvas/TreeCanvas";
import { loadProjects, loadNodes } from "../lib/storage";
import { computeLayout } from "../lib/layout";
import "./EditorPage.css";

export default function EditorPage() {
    const { projectId } = useParams<{ projectId: string }>();

    const projects = loadProjects();
    const project = projects.find((p) => p.id === projectId);
    const [recenterSignal, setRecenterSignal] = useState(0);

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

    const allNodes = loadNodes().filter((n) => n.projectId === project.id);
    const rootNode = allNodes.find((n) => n.id === project.rootNodeId);

    if (allNodes.length === 0 || !rootNode) {
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

    const layout = computeLayout(allNodes, project.rootNodeId);

    return (
        <>
            <AppHeader variant="editor" projectName={project.name} onRecenter={() => setRecenterSignal((n) => n + 1)} />
            <main className="editor-canvas">
                <TreeCanvas
                    key={project.id}
                    projectId={project.id}
                    nodes={allNodes}
                    positions={layout.positions}
                    edges={layout.edges}
                    bounds={layout.bounds}
                    recenterSignal={recenterSignal}
                />
            </main>
        </>
    );
}
