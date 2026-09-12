import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Alert } from "@mui/material";
import AppHeader from "../components/layout/AppHeader";
import TreeCanvas from "../components/canvas/TreeCanvas";
import ExportPreviewDialog from "../components/canvas/ExportPreviewDialog";
import { initStorage, type StorageFallback } from "../storage/init";
import {
    addChildNodeAsync,
    deleteNodeSubtreeAsync,
    getViewportAsync,
    isQuotaError,
    setNodeCollapsedAsync,
    setNodeMediaFillAsync,
    setNodeKindAsync,
    setNodeMediaAsync,
    setNodeUrlAsync,
    updateNodeTextAsync,
} from "../storage/operations";
import type { StorageBackend } from "../storage/backend";
import { createIdbMediaBlobStore } from "../storage/mediaBlobs";
import { genId, nowIso, validateImageFilePure } from "../storage/localStore";
import { downscaleImageFile } from "../lib/images";
import { computeLayout } from "../lib/layout";
import { exportMapAsPng, paddedExportBounds, renderMapToCanvas, resolveExportScale } from "../lib/exportPng";
import { loadExportMediaImages, mediaLoadWarningPure, revokeExportObjectUrls } from "../lib/media";
import type { Project, Viewport } from "../types/project";
import type { Node, NodeKind, NodeMedia, NodeSide } from "../types/node";
import "./EditorPage.css";

export default function EditorPage() {
    const { projectId } = useParams<{ projectId: string }>();
    const [backend, setBackend] = useState<StorageBackend | null>(null);
    const [fallback, setFallback] = useState<StorageFallback | null>(null);
    const [project, setProject] = useState<Project | null | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        initStorage()
            .then((res) => {
                if (cancelled) return;
                setBackend(res.backend);
                setFallback(res.fallback);
                return res.backend.loadProjects().then((projects) => {
                    if (!cancelled) setProject(projects.find((p) => p.id === projectId) ?? null);
                });
            })
            .catch(() => {
                if (!cancelled) setProject(null);
            });
        return () => {
            cancelled = true;
        };
    }, [projectId]);

    if (project === undefined || backend === null) {
        return (
            <>
                <AppHeader variant="editor" projectName="Untitled project" />
                <main className="editor-canvas editor-canvas--center">
                    <div className="editor-placeholder">
                        <h2>Loading map…</h2>
                    </div>
                </main>
            </>
        );
    }

    if (!projectId || !project) {
        return (
            <>
                <AppHeader variant="editor" projectName="Untitled project" />
                <main className="editor-canvas editor-canvas--center">
                    <div className="editor-placeholder">
                        <h2>Project not found</h2>
                        <p>
                            No project matches <code>{projectId ?? ""}</code>
                        </p>
                        <Link to="/" className="editor-placeholder__link">
                            Back to projects
                        </Link>
                    </div>
                </main>
            </>
        );
    }

    return <EditorCanvas key={project.id} project={project} backend={backend} fallback={fallback ?? "indexeddb"} />;
}

function toEditorError(e: unknown, fallbackMsg: string): string {
    if (isQuotaError(e)) return "Storage full — delete a project or clear data.";
    return e instanceof Error ? e.message : fallbackMsg;
}

function EditorCanvas({ project, backend, fallback }: { project: Project; backend: StorageBackend; fallback: StorageFallback }) {
    const [nodes, setNodes] = useState<Node[] | null>(null);
    const [initialViewport, setInitialViewport] = useState<Viewport | undefined>(undefined);
    const [recenterSignal, setRecenterSignal] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const [mediaWarning, setMediaWarning] = useState<string | null>(null);
    const exportTokenRef = useRef(0);
    const [blobStore] = useState(() => createIdbMediaBlobStore());
    const canUpload = fallback === "indexeddb";

    const loadBlob = useCallback(
        (uploadId: string): Promise<Blob | null> =>
            blobStore
                .loadBlob(uploadId)
                .then((record) => record?.blob ?? null)
                .catch(() => null),
        [blobStore],
    );

    const resolveUploadUrl = useCallback(
        (uploadId: string): Promise<string> =>
            blobStore.loadBlob(uploadId).then((record) => {
                if (!record) throw new Error(`Missing upload ${uploadId}`);
                return URL.createObjectURL(record.blob);
            }),
        [blobStore],
    );

    useEffect(() => {
        let cancelled = false;
        backend
            .loadNodes()
            .then((all) => {
                if (!cancelled) setNodes(all.filter((n) => n.projectId === project.id));
            })
            .catch((e: unknown) => {
                if (!cancelled) setError(e instanceof Error ? e.message : "Could not load nodes.");
            });
        // Load the viewport up front so the canvas first paints at the saved
        // view instead of flashing the default and jumping (F-06).
        getViewportAsync(backend, project.id)
            .then((saved) => {
                if (!cancelled) setInitialViewport(saved ?? { x: 0, y: 0, zoom: 1 });
            })
            .catch(() => {
                if (!cancelled) setInitialViewport({ x: 0, y: 0, zoom: 1 });
            });
        return () => {
            cancelled = true;
        };
    }, [backend, project.id]);

    async function refreshNodes() {
        const all = await backend.loadNodes();
        setNodes(all.filter((n) => n.projectId === project.id));
    }

    async function handleAddChild(parentId: string, text: string, side: NodeSide): Promise<Node | null> {
        if (nodes === null) return null;
        try {
            // New children must be visible, so adding to a collapsed
            // parent expands it (the collapse toggle itself is feature 5).
            const parent = nodes.find((n) => n.id === parentId);
            if (parent?.collapsed) await setNodeCollapsedAsync(backend, parent.id, false);
            const child = await addChildNodeAsync(backend, project.id, parentId, text, side);
            await refreshNodes();
            setError(null);
            return child;
        } catch (e) {
            setError(toEditorError(e, "Could not add node."));
            return null;
        }
    }

    async function handleUpdateText(nodeId: string, text: string): Promise<Node | null> {
        try {
            const updated = await updateNodeTextAsync(backend, nodeId, text);
            await refreshNodes();
            setError(null);
            return updated;
        } catch (e) {
            setError(toEditorError(e, "Could not update node."));
            return null;
        }
    }

    async function handleSetKind(nodeId: string, kind: NodeKind, opts?: { allowTruncate?: boolean }): Promise<Node | null> {
        try {
            const updated = await setNodeKindAsync(backend, nodeId, kind, opts);
            await refreshNodes();
            setError(null);
            return updated;
        } catch (e) {
            setError(toEditorError(e, "Could not convert node."));
            return null;
        }
    }

    async function handleSetUrl(nodeId: string, url: string | null): Promise<Node | null> {
        try {
            const updated = await setNodeUrlAsync(backend, nodeId, url);
            await refreshNodes();
            setError(null);
            return updated;
        } catch (e) {
            setError(toEditorError(e, "Could not save link."));
            return null;
        }
    }

    async function replaceNodeMedia(nodeId: string, media: NodeMedia | null): Promise<Node | null> {
        const previous = nodes?.find((n) => n.id === nodeId)?.media ?? null;
        const updated = await setNodeMediaAsync(backend, nodeId, media);
        const previousUploadId = previous?.uploadId ?? null;
        const nextUploadId = updated.media?.uploadId ?? null;
        if (previousUploadId && previousUploadId !== nextUploadId) {
            await blobStore.deleteBlob(previousUploadId).catch(() => undefined);
        }
        return updated;
    }

    async function handleSetMedia(nodeId: string, media: NodeMedia | null): Promise<Node | null> {
        try {
            const updated = await replaceNodeMedia(nodeId, media);
            await refreshNodes();
            setError(null);
            return updated;
        } catch (e) {
            setError(toEditorError(e, "Could not save media."));
            return null;
        }
    }

    async function handleSetMediaFill(nodeId: string, fill: boolean): Promise<Node | null> {
        try {
            const updated = await setNodeMediaFillAsync(backend, nodeId, fill);
            await refreshNodes();
            setError(null);
            return updated;
        } catch (e) {
            setError(toEditorError(e, "Could not update the node."));
            return null;
        }
    }

    async function handleUploadMedia(nodeId: string, file: File): Promise<string | null> {
        const invalid = validateImageFilePure(file);
        if (invalid) return invalid;
        const node = nodes?.find((n) => n.id === nodeId) ?? null;
        if (!node) return "Node not found.";
        let pixels: Blob;
        try {
            pixels = await downscaleImageFile(file);
        } catch (e) {
            return e instanceof Error ? e.message : "Could not read that image file.";
        }
        const uploadId = genId();
        try {
            await blobStore.saveBlob({ id: uploadId, projectId: node.projectId, nodeId, blob: pixels, createdAt: nowIso() });
            await replaceNodeMedia(nodeId, { kind: "image", src: "", uploadId });
            await refreshNodes();
            setError(null);
            return null;
        } catch (e) {
            await blobStore.deleteBlob(uploadId).catch(() => undefined);
            const message = toEditorError(e, "Could not save the uploaded image.");
            setError(message);
            return message;
        }
    }

    async function handleToggleCollapsed(nodeId: string): Promise<Node | null> {
        if (nodes === null) return null;
        try {
            const node = nodes.find((n) => n.id === nodeId);
            if (!node) return null;
            const updated = await setNodeCollapsedAsync(backend, nodeId, !node.collapsed);
            await refreshNodes();
            setError(null);
            return updated;
        } catch (e) {
            setError(toEditorError(e, "Could not collapse node."));
            return null;
        }
    }

    async function handleDeleteSubtree(nodeId: string): Promise<{ deletedIds: string[] } | null> {
        try {
            const res = await deleteNodeSubtreeAsync(backend, nodeId, blobStore);
            await refreshNodes();
            setError(null);
            return res;
        } catch (e) {
            setError(toEditorError(e, "Could not delete node."));
            return null;
        }
    }

    if (nodes === null || initialViewport === undefined) {
        return (
            <>
                <AppHeader variant="editor" projectName={project.name} />
                <main className="editor-canvas editor-canvas--center">
                    <div className="editor-placeholder">
                        <h2>Loading map…</h2>
                    </div>
                </main>
            </>
        );
    }

    const rootNode = nodes.find((n) => n.id === project.rootNodeId);

    if (nodes.length === 0 || !rootNode) {
        return (
            <>
                <AppHeader variant="editor" projectName={project.name} />
                <main className="editor-canvas editor-canvas--center">
                    <div className="editor-placeholder">
                        <h2>Empty map</h2>
                        <p>No nodes found for this project.</p>
                    </div>
                </main>
            </>
        );
    }

    const layout = computeLayout(nodes, project.rootNodeId);
    const visibleNodes = nodes.filter((n) => layout.positions.has(n.id));

    function mediaWarningFor(failedIds: string[], lookup: Node[]): string | null {
        const names = failedIds.map((id) => {
            const text = lookup.find((n) => n.id === id)?.text.trim() ?? "";
            return text.length > 24 ? `${text.slice(0, 24)}…` : text || "Untitled node";
        });
        return mediaLoadWarningPure(names);
    }

    async function handleExport() {
        const token = ++exportTokenRef.current;
        setPreviewUrl(null);
        setPreviewError(null);
        setDownloadError(null);
        setMediaWarning(null);
        setPreviewOpen(true);
        let objectUrls: string[] = [];
        try {
            const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
            const scale = resolveExportScale(paddedExportBounds(layout.bounds), dpr);
            const loaded = await loadExportMediaImages(visibleNodes, { resolveUpload: resolveUploadUrl });
            objectUrls = loaded.objectUrls;
            if (token !== exportTokenRef.current) return;
            const canvas = renderMapToCanvas({
                nodes: visibleNodes,
                positions: layout.positions,
                edges: layout.edges,
                bounds: layout.bounds,
                scale,
                images: loaded.images,
            });
            setPreviewUrl(canvas.toDataURL("image/png"));
            setMediaWarning(mediaWarningFor(loaded.failedIds, visibleNodes));
        } catch (e) {
            if (token !== exportTokenRef.current) return;
            const message = e instanceof Error ? e.message : "Could not render preview.";
            setPreviewError(message);
            setError(message);
        } finally {
            revokeExportObjectUrls(objectUrls);
        }
    }

    function handleClosePreview() {
        if (exporting) return;
        exportTokenRef.current++;
        setPreviewOpen(false);
        setPreviewUrl(null);
        setMediaWarning(null);
    }

    async function handleConfirmDownload() {
        if (exporting) return;
        setExporting(true);
        setDownloadError(null);
        let objectUrls: string[] = [];
        try {
            const loaded = await loadExportMediaImages(visibleNodes, { resolveUpload: resolveUploadUrl });
            objectUrls = loaded.objectUrls;
            await exportMapAsPng({
                projectName: project.name,
                nodes: visibleNodes,
                positions: layout.positions,
                edges: layout.edges,
                bounds: layout.bounds,
                images: loaded.images,
            });
            setError(null);
            const warning = mediaWarningFor(loaded.failedIds, visibleNodes);
            setMediaWarning(warning);
            // Keep the dialog open when images failed so the warning is seen.
            if (warning === null) setPreviewOpen(false);
        } catch (e) {
            const message = e instanceof Error ? e.message : "Could not export PNG.";
            setDownloadError(message);
            setError(message);
        } finally {
            revokeExportObjectUrls(objectUrls);
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
                {fallback !== "indexeddb" && (
                    <Alert
                        severity="warning"
                        sx={{
                            position: "absolute",
                            top: 12,
                            left: "50%",
                            transform: "translateX(-50%)",
                            zIndex: 6,
                            maxWidth: "min(480px, calc(100% - 32px))",
                        }}
                    >
                        {fallback === "memory"
                            ? "Storage unavailable — changes won't persist after reload."
                            : "Using local fallback storage — changes are saved in this browser only."}
                    </Alert>
                )}
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
                    backend={backend}
                    initialViewport={initialViewport}
                    rootNodeId={project.rootNodeId}
                    nodes={nodes}
                    positions={layout.positions}
                    edges={layout.edges}
                    bounds={layout.bounds}
                    recenterSignal={recenterSignal}
                    onAddChild={handleAddChild}
                    onUpdateText={handleUpdateText}
                    onSetKind={handleSetKind}
                    onSetUrl={handleSetUrl}
                    onSetMedia={handleSetMedia}
                    onSetMediaFill={handleSetMediaFill}
                    onUploadMedia={(nodeId, file) => handleUploadMedia(nodeId, file)}
                    loadBlob={loadBlob}
                    canUpload={canUpload}
                    onToggleCollapsed={handleToggleCollapsed}
                    onDeleteSubtree={handleDeleteSubtree}
                />
                <ExportPreviewDialog
                    open={previewOpen}
                    downloading={exporting}
                    previewUrl={previewUrl}
                    previewError={previewError}
                    downloadError={downloadError}
                    mediaWarning={mediaWarning}
                    onClose={handleClosePreview}
                    onDownload={() => void handleConfirmDownload()}
                />
            </main>
        </>
    );
}
