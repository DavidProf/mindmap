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
    restoreProjectNodesAsync,
    setNodeCollapsedAsync,
    setNodeMediaFillAsync,
    setNodeKindAsync,
    setNodeMediaAsync,
    setNodeSizeAsync,
    setNodeUrlAsync,
    updateNodeTextAsync,
} from "../storage/operations";
import type { StorageBackend } from "../storage/backend";
import { createIdbMediaBlobStore } from "../storage/mediaBlobs";
import { genId, nowIso, validateImageFilePure } from "../storage/localStore";
import { canRedo, canUndo, cloneNodes, createHistory, historyCapForSnapshot, pushEntry, redo, snapshotsEqual, undo, type HistoryStack } from "../lib/history";
import { downscaleImageFile } from "../lib/images";
import { toUserError } from "../lib/errors";
import { computeLayout } from "../lib/layout";
import { exportMapAsPng, paddedExportBounds, renderMapToCanvas, resolveExportScale } from "../lib/exportPng";
import { loadExportMediaImages, mediaLoadWarningPure, revokeExportObjectUrls } from "../lib/media";
import type { Project, Viewport } from "../types/project";
import type { Node, NodeKind, NodeMedia, NodeSide, NodeSize } from "../types/node";
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
    const [nodeHistory, setNodeHistory] = useState<HistoryStack<Node[]>>(() => createHistory<Node[]>());
    const [historyTick, setHistoryTick] = useState(0);
    const [busy, setBusy] = useState(false);
    const pendingAddIdRef = useRef<string | null>(null);
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

    async function refreshNodes(): Promise<Node[]> {
        const all = await backend.loadNodes();
        const scoped = all.filter((n) => n.projectId === project.id);
        setNodes(scoped);
        return scoped;
    }

    function pushHistory(label: string, before: Node[], after: Node[]) {
        if (snapshotsEqual(before, after)) return;
        const cap = historyCapForSnapshot(Math.max(before.length, after.length));
        const entry = { label, before: cloneNodes(before), after: cloneNodes(after) };
        setNodeHistory((h) => pushEntry(h, entry, cap));
    }

    async function runMutation<T>(fallbackMsg: string, fn: () => Promise<T>): Promise<T | null> {
        setBusy(true);
        try {
            const result = await fn();
            setError(null);
            return result;
        } catch (e) {
            setError(toUserError(e, fallbackMsg));
            return null;
        } finally {
            setBusy(false);
        }
    }

    async function runHistoryMutation<T>(
        label: string | null,
        fallbackMsg: string,
        op: () => Promise<T>,
    ): Promise<{ result: T; before: Node[]; after: Node[] } | null> {
        if (nodes === null) return null;
        const before = cloneNodes(nodes);
        return runMutation(fallbackMsg, async () => {
            const result = await op();
            const after = await refreshNodes();
            if (label) pushHistory(label, before, after);
            return { result, before, after };
        });
    }

    async function handleAddChild(parentId: string, text: string, side: NodeSide): Promise<Node | null> {
        if (nodes === null) return null;
        const outcome = await runHistoryMutation("Add node", "Could not add node.", async () => {
            // New children must be visible, so adding to a collapsed
            // parent expands it (the collapse toggle itself is feature 5).
            const parent = nodes.find((n) => n.id === parentId);
            if (parent?.collapsed) await setNodeCollapsedAsync(backend, parent.id, false);
            return addChildNodeAsync(backend, project.id, parentId, text, side);
        });
        if (!outcome) return null;
        pendingAddIdRef.current = outcome.result.id;
        return outcome.result;
    }

    async function handleUpdateText(nodeId: string, text: string): Promise<Node | null> {
        if (nodes === null) return null;
        const before = cloneNodes(nodes);
        return runMutation("Could not update node.", async () => {
            const updated = await updateNodeTextAsync(backend, nodeId, text);
            const after = await refreshNodes();
            if (pendingAddIdRef.current === nodeId) {
                pendingAddIdRef.current = null;
                const mergedAfter = cloneNodes(after);
                const mergeCap = historyCapForSnapshot(Math.max(before.length, mergedAfter.length));
                setNodeHistory((h) => {
                    const top = h.past[h.past.length - 1];
                    if (top && top.label === "Add node") {
                        return { past: [...h.past.slice(0, -1), { ...top, after: mergedAfter }], future: [] };
                    }
                    return pushEntry(h, { label: "Rename node", before: cloneNodes(before), after: mergedAfter }, mergeCap);
                });
            } else {
                pushHistory("Rename node", before, after);
            }
            return updated;
        });
    }

    async function handleSetKind(nodeId: string, kind: NodeKind, opts?: { allowTruncate?: boolean }): Promise<Node | null> {
        if (nodes === null) return null;
        // Converting away from media drops it; clean up the orphaned blob.
        const previousUploadId = nodes?.find((n) => n.id === nodeId)?.media?.uploadId ?? null;
        const outcome = await runHistoryMutation("Convert node", "Could not convert node.", async () => {
            const updated = await setNodeKindAsync(backend, nodeId, kind, opts);
            if (previousUploadId && updated.media === null) {
                await blobStore.deleteBlob(previousUploadId).catch(() => undefined);
            }
            return updated;
        });
        return outcome?.result ?? null;
    }

    async function handleSetUrl(nodeId: string, url: string | null): Promise<Node | null> {
        const outcome = await runHistoryMutation("Edit link", "Could not save link.", () =>
            setNodeUrlAsync(backend, nodeId, url),
        );
        return outcome?.result ?? null;
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
        const outcome = await runHistoryMutation("Edit media", "Could not save media.", () =>
            replaceNodeMedia(nodeId, media),
        );
        return outcome?.result ?? null;
    }

    async function handleSetMediaFill(nodeId: string, fill: boolean): Promise<Node | null> {
        const outcome = await runHistoryMutation("Toggle media fill", "Could not update the node.", () =>
            setNodeMediaFillAsync(backend, nodeId, fill),
        );
        return outcome?.result ?? null;
    }

    async function handleSetSize(nodeId: string, size: NodeSize): Promise<Node | null> {
        const outcome = await runHistoryMutation("Resize node", "Could not update the node.", () =>
            setNodeSizeAsync(backend, nodeId, size),
        );
        return outcome?.result ?? null;
    }

    async function handleUploadMedia(nodeId: string, file: File): Promise<{ message: string | null; media: NodeMedia | null }> {
        const invalid = validateImageFilePure(file);
        if (invalid) return { message: invalid, media: null };
        const node = nodes?.find((n) => n.id === nodeId) ?? null;
        if (!node) return { message: "Node not found.", media: null };
        const before = cloneNodes(nodes ?? []);
        let pixels: Blob;
        try {
            pixels = await downscaleImageFile(file);
        } catch (e) {
            return { message: e instanceof Error ? e.message : "Could not read that image file.", media: null };
        }
        const uploadId = genId();
        setBusy(true);
        try {
            await blobStore.saveBlob({ id: uploadId, projectId: node.projectId, nodeId, blob: pixels, createdAt: nowIso() });
            const media: NodeMedia = { kind: "image", src: "", uploadId };
            await replaceNodeMedia(nodeId, media);
            const after = await refreshNodes();
            pushHistory("Upload image", before, after);
            setError(null);
            return { message: null, media };
        } catch (e) {
            await blobStore.deleteBlob(uploadId).catch(() => undefined);
            const message = toUserError(e, "Could not save the uploaded image.");
            setError(message);
            return { message, media: null };
        } finally {
            setBusy(false);
        }
    }

    async function handleToggleCollapsed(nodeId: string): Promise<Node | null> {
        if (nodes === null) return null;
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return null;
        const label = node.collapsed ? "Expand branch" : "Collapse branch";
        const outcome = await runHistoryMutation(label, "Could not collapse node.", () =>
            setNodeCollapsedAsync(backend, nodeId, !node.collapsed),
        );
        return outcome?.result ?? null;
    }

    async function handleDeleteSubtree(nodeId: string): Promise<{ deletedIds: string[] } | null> {
        const outcome = await runHistoryMutation("Delete branch", "Could not delete node.", () =>
            deleteNodeSubtreeAsync(backend, nodeId, blobStore),
        );
        return outcome?.result ?? null;
    }

    async function handleUndo(): Promise<void> {
        if (busy) return;
        const res = undo(nodeHistory);
        if (!res.entry) return;
        pendingAddIdRef.current = null;
        const entry = res.entry;
        const stack = res.stack;
        await runMutation("Could not undo.", async () => {
            const restored = await restoreProjectNodesAsync(backend, project.id, entry.before);
            setNodeHistory(stack);
            setNodes(restored);
            setHistoryTick((n) => n + 1);
        });
    }

    async function handleRedo(): Promise<void> {
        if (busy) return;
        const res = redo(nodeHistory);
        if (!res.entry) return;
        pendingAddIdRef.current = null;
        const entry = res.entry;
        const stack = res.stack;
        await runMutation("Could not redo.", async () => {
            const restored = await restoreProjectNodesAsync(backend, project.id, entry.after);
            setNodeHistory(stack);
            setNodes(restored);
            setHistoryTick((n) => n + 1);
        });
    }

    const canUndoNow = canUndo(nodeHistory);
    const canRedoNow = canRedo(nodeHistory);

    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            const mod = e.ctrlKey || e.metaKey;
            if (!mod) return;
            const key = e.key.toLowerCase();
            const isUndo = key === "z" && !e.shiftKey;
            const isRedo = (key === "z" && e.shiftKey) || key === "y";
            if (!isUndo && !isRedo) return;
            const target = e.target as HTMLElement | null;
            if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
            if (document.querySelector('[role="dialog"]')) return;
            if (busy) return;
            e.preventDefault();
            if (isUndo) void handleUndo();
            else void handleRedo();
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    });

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
                onUndo={() => void handleUndo()}
                onRedo={() => void handleRedo()}
                canUndo={canUndoNow && !busy}
                canRedo={canRedoNow && !busy}
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
                    onSetSize={handleSetSize}
                    onUploadMedia={(nodeId, file) => handleUploadMedia(nodeId, file)}
                    loadBlob={loadBlob}
                    canUpload={canUpload}
                    onToggleCollapsed={handleToggleCollapsed}
                    onDeleteSubtree={handleDeleteSubtree}
                    historyTick={historyTick}
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
