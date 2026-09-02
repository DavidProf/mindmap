import { useParams } from "react-router-dom";
import AppHeader from "../components/layout/AppHeader";
import "./EditorPage.css";

export default function EditorPage() {
    const { projectId } = useParams<{ projectId: string }>();

    return (
        <>
            <AppHeader variant="editor" projectName={projectId ?? "Untitled project"} />
            <main className="editor-canvas">
                <div className="editor-placeholder">
                    <h2 style={{ fontSize: "16px", margin: 0 }}>Editor</h2>
                    <p style={{ color: "var(--muted)", fontSize: "13px", margin: "6px 0 0" }}>
                        Project: {projectId}
                    </p>
                    <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "8px" }}>
                        Editor placeholder — canvas lands in feature 3.
                    </p>
                </div>
            </main>
        </>
    );
}
