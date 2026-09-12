import { useEffect, useRef, useState } from "react";
import type { Node, NodeKind, NodeMedia, NodeSide } from "../../types/node";
import type { Viewport } from "../../types/project";
import type { Position } from "../../lib/layout";
import { countSubtreeNodesPure, getSubtreeCountsPure, MAX_NODE_TEXT_LENGTH } from "../../storage/localStore";
import { formatZoomPct } from "../../lib/zoom";
import useViewport from "./useViewport";
import type { CanvasBounds } from "./useViewport";
import type { StorageBackend } from "../../storage/backend";
import NodeCircle from "./NodeCircle";
import NodeRect from "./NodeRect";
import NodeContextMenu from "./NodeContextMenu";
import type { NodeMenuState } from "./NodeContextMenu";
import NodeConvertDialog from "./NodeConvertDialog";
import type { NodeConvertTarget } from "./NodeConvertDialog";
import NodeDeleteDialog from "./NodeDeleteDialog";
import type { NodeDeleteTarget } from "./NodeDeleteDialog";
import NodeLinkDialog from "./NodeLinkDialog";
import type { NodeLinkTarget } from "./NodeLinkDialog";
import NodeMediaDialog, { UPLOAD_ACCEPT } from "./NodeMediaDialog";
import type { NodeMediaTarget } from "./NodeMediaDialog";
import { openNodeUrl } from "../../lib/link";
import "./TreeCanvas.css";

type TreeCanvasProps = {
    projectId: string;
    backend: StorageBackend;
    initialViewport: Viewport;
    rootNodeId: string;
    nodes: Node[];
    positions: Map<string, Position>;
    edges: { from: string; to: string }[];
    bounds: CanvasBounds;
    recenterSignal?: number;
    onAddChild?: (parentId: string, text: string, side: NodeSide) => Promise<Node | null>;
    onUpdateText?: (nodeId: string, text: string) => Promise<Node | null>;
    onSetKind?: (nodeId: string, kind: NodeKind, opts?: { allowTruncate?: boolean }) => Promise<Node | null>;
    onSetUrl?: (nodeId: string, url: string | null) => Promise<Node | null>;
    onSetMedia?: (nodeId: string, media: NodeMedia | null) => Promise<Node | null>;
    onSetMediaFill?: (nodeId: string, fill: boolean) => Promise<Node | null>;
    onUploadMedia?: (nodeId: string, file: File) => Promise<string | null>;
    loadBlob?: (uploadId: string) => Promise<Blob | null>;
    canUpload?: boolean;
    onToggleCollapsed?: (nodeId: string) => Promise<Node | null>;
    onDeleteSubtree?: (nodeId: string) => Promise<{ deletedIds: string[] } | null>;
};

export default function TreeCanvas({ projectId, backend, initialViewport, rootNodeId, nodes, positions, edges, bounds, recenterSignal, onAddChild, onUpdateText, onSetKind, onSetUrl, onSetMedia, onSetMediaFill, onUploadMedia, loadBlob, canUpload, onToggleCollapsed, onDeleteSubtree }: TreeCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const uploadInputRef = useRef<HTMLInputElement | null>(null);
    const [uploadNodeId, setUploadNodeId] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [menu, setMenu] = useState<NodeMenuState | null>(null);
    const [convertTarget, setConvertTarget] = useState<NodeConvertTarget | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<NodeDeleteTarget | null>(null);
    const [linkTarget, setLinkTarget] = useState<NodeLinkTarget | null>(null);
    const [mediaTarget, setMediaTarget] = useState<NodeMediaTarget | null>(null);
    const visibleNodes = nodes.filter((n) => positions.has(n.id));

    function closeMenu(focusNodeId?: string) {
        setMenu((open) => (open === null ? open : null));
        if (focusNodeId) focusCircle(focusNodeId);
    }

    const {
        viewport,
        animate,
        dragging,
        handleRecenter,
        handleWheel,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
    } = useViewport({ projectId, backend, initialViewport, bounds, containerRef, onInteract: () => closeMenu() });

    function clearSelection() {
        // Canvas mousedown is preventDefaulted for panning, so a pending
        // editor never blurs on its own. Blur it so the onBlur commit path
        // runs before the selection clears.
        if (editingId !== null) {
            (document.activeElement as HTMLElement | null)?.blur?.();
        }
        setSelectedId(null);
    }

    const recenterTickRef = useRef(0);
    // header Re-center triggers this via recenterSignal tick
    useEffect(() => {
        if (recenterSignal === undefined) return;
        if (recenterSignal === 0) return;
        if (recenterTickRef.current === recenterSignal) return;
        recenterTickRef.current = recenterSignal;
        handleRecenter();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recenterSignal]);

    function handleSelect(id: string) {
        commitPendingEdit(id);
        setSelectedId(id);
        focusCircle(id);
    }

    async function handlePlus(parentId: string, side: NodeSide) {
        if (!onAddChild) return;
        const child = await onAddChild(parentId, "New idea", side);
        if (child) {
            setSelectedId(child.id);
            setEditingId(child.id);
        }
    }

    function handleEditStart(id: string) {
        commitPendingEdit(id);
        setSelectedId(id);
        setEditingId(id);
    }

    function handleNodeContextMenu(id: string, x: number, y: number) {
        commitPendingEdit(id);
        setSelectedId(id);
        setMenu({ x, y, nodeId: id });
    }

    function handleMenuEdit() {
        const target = menu?.nodeId;
        closeMenu();
        if (target) handleEditStart(target);
    }

    async function handleMenuConvert(kind: NodeKind) {
        const target = menu ? (nodes.find((n) => n.id === menu.nodeId) ?? null) : null;
        closeMenu(target?.id);
        if (!target || target.kind === kind) return;
        // Long notes overflow circles: confirm truncation before converting.
        if (kind === "circle" && target.text.trim().length > MAX_NODE_TEXT_LENGTH) {
            setConvertTarget({ nodeId: target.id, text: target.text, from: "note", to: "circle" });
            return;
        }
        await onSetKind?.(target.id, kind);
    }

    function handleCancelConvert() {
        const target = convertTarget;
        setConvertTarget(null);
        if (target) focusCircle(target.nodeId);
    }

    async function handleConfirmConvert() {
        const target = convertTarget;
        if (!target) return;
        setConvertTarget(null);
        await onSetKind?.(target.nodeId, target.to, { allowTruncate: true });
        focusCircle(target.nodeId);
    }

    async function handleMenuToggleCollapse() {
        const target = menu?.nodeId;
        closeMenu(target);
        if (target) await onToggleCollapsed?.(target);
    }

    function handleMenuDelete() {
        const target = menu ? (nodes.find((n) => n.id === menu.nodeId) ?? null) : null;
        closeMenu();
        if (!target || target.id === rootNodeId) return;
        setDeleteTarget({
            nodeId: target.id,
            text: target.text,
            count: countSubtreeNodesPure(nodes, target.id),
        });
    }

    function handleMenuLink() {
        const target = menu ? (nodes.find((n) => n.id === menu.nodeId) ?? null) : null;
        closeMenu(target?.id);
        if (!target) return;
        setLinkTarget({ nodeId: target.id, text: target.text, url: target.url ?? null });
    }

    function handleCancelLink() {
        const target = linkTarget;
        setLinkTarget(null);
        if (target) focusCircle(target.nodeId);
    }

    async function handleSaveLink(url: string | null) {
        const target = linkTarget;
        if (!target) return;
        setLinkTarget(null);
        await onSetUrl?.(target.nodeId, url);
        focusCircle(target.nodeId);
    }

    function handleOpenLink() {
        const target = menu ? (nodes.find((n) => n.id === menu.nodeId) ?? null) : null;
        const url = target?.url ?? null;
        closeMenu(target?.id);
        if (url) openNodeUrl(url);
    }

    async function handleRemoveLink() {
        const target = menu ? (nodes.find((n) => n.id === menu.nodeId) ?? null) : null;
        closeMenu(target?.id);
        if (!target || !target.url) return;
        await onSetUrl?.(target.id, null);
    }

    function handleMenuMedia() {
        const target = menu ? (nodes.find((n) => n.id === menu.nodeId) ?? null) : null;
        closeMenu(target?.id);
        if (!target) return;
        setMediaTarget({ nodeId: target.id, text: target.text, media: target.media ?? null });
    }

    function handleCancelMedia() {
        const target = mediaTarget;
        setMediaTarget(null);
        if (target) focusCircle(target.nodeId);
    }

    async function handleSaveMedia(media: NodeMedia | null) {
        const target = mediaTarget;
        if (!target) return;
        setMediaTarget(null);
        await onSetMedia?.(target.nodeId, media);
        focusCircle(target.nodeId);
    }

    function handleOpenMedia() {
        const target = menu ? (nodes.find((n) => n.id === menu.nodeId) ?? null) : null;
        const media = target?.media ?? null;
        closeMenu(target?.id);
        if (media && media.src.trim().length > 0) openNodeUrl(media.src);
    }

    function handleMenuUploadImage() {
        const target = menu ? (nodes.find((n) => n.id === menu.nodeId) ?? null) : null;
        closeMenu(target?.id);
        if (!target || !canUpload) return;
        setUploadNodeId(target.id);
        uploadInputRef.current?.click();
    }

    async function handlePickedUpload(nodeId: string, file: File | null): Promise<string | null> {
        if (!file) return null;
        const message = (await onUploadMedia?.(nodeId, file)) ?? null;
        if (message === null) focusCircle(nodeId);
        return message;
    }

    async function handleDialogUploadFile(file: File): Promise<string | null> {
        const target = mediaTarget;
        if (!target) return "Nothing to attach to.";
        const message = await handlePickedUpload(target.nodeId, file);
        // On success the dialog closes like a save; on error it stays open.
        if (message === null) setMediaTarget(null);
        return message;
    }

    async function handleRemoveMedia() {
        const target = menu ? (nodes.find((n) => n.id === menu.nodeId) ?? null) : null;
        closeMenu(target?.id);
        if (!target || !target.media) return;
        await onSetMedia?.(target.id, null);
    }

    async function handleMenuToggleMediaFill() {
        const target = menu ? (nodes.find((n) => n.id === menu.nodeId) ?? null) : null;
        closeMenu(target?.id);
        if (!target || !target.media) return;
        await onSetMediaFill?.(target.id, !target.mediaFill);
    }

    function handleCancelDelete() {
        const target = deleteTarget;
        setDeleteTarget(null);
        if (target) focusCircle(target.nodeId);
    }

    async function handleConfirmDelete() {
        const target = deleteTarget;
        if (!target) return;
        const parentId = nodes.find((n) => n.id === target.nodeId)?.parentId ?? null;
        const res = await onDeleteSubtree?.(target.nodeId);
        setDeleteTarget(null);
        if (res) {
            // The selection and editor must not point into a removed subtree.
            if (selectedId !== null && res.deletedIds.includes(selectedId)) setSelectedId(null);
            if (editingId !== null && res.deletedIds.includes(editingId)) setEditingId(null);
            // Move focus out of the removed subtree: parent shape, else canvas.
            requestAnimationFrame(() => {
                if (
                    parentId &&
                    document.querySelector(
                        `[data-node-id="${parentId}"] .node-circle, [data-node-id="${parentId}"] .node-rect`,
                    )
                ) {
                    focusCircle(parentId);
                } else {
                    containerRef.current?.focus?.();
                }
            });
        }
    }

    function commitPendingEdit(exceptId: string) {
        // Canvas mousedown prevents default, so clicking another node never
        // moves focus and the open editor would stay uncommitted. Blur it
        // first so the existing onBlur commit path runs before switching.
        if (editingId !== null && editingId !== exceptId) {
            (document.activeElement as HTMLElement | null)?.blur?.();
        }
    }

    async function handleCommitText(nodeId: string, text: string) {
        const node = nodes.find((n) => n.id === nodeId);
        const trimmed = text.trim();
        // Empty or unchanged text reverts: the prior text stays, no write.
        if (!node || trimmed.length === 0 || trimmed === node.text) {
            setEditingId(null);
            focusCircle(nodeId);
            return;
        }
        const updated = (await onUpdateText?.(nodeId, text)) ?? null;
        // On storage failure the banner shows the error and the editor stays open.
        if (updated) {
            setEditingId(null);
            focusCircle(nodeId);
        }
    }

    function handleCancelEdit(nodeId: string) {
        setEditingId(null);
        focusCircle(nodeId);
    }

    function handleOpenBadge(nodeId: string) {
        const node = nodes.find((n) => n.id === nodeId) ?? null;
        const url = node?.url ?? null;
        if (url) openNodeUrl(url);
    }

    async function handleOpenMediaBadge(nodeId: string) {
        const node = nodes.find((n) => n.id === nodeId) ?? null;
        const media = node?.media ?? null;
        if (!media) return;
        if (media.uploadId && loadBlob) {
            const blob = await loadBlob(media.uploadId).catch(() => null);
            if (blob) window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
            return;
        }
        if (media.src.trim().length > 0) openNodeUrl(media.src);
    }

    function focusCircle(nodeId: string) {
        // The shape div survives the editor/text swap, so focusing it keeps
        // keyboard users in the canvas flow instead of dropping to body.
        const el = document.querySelector(
            `[data-node-id="${nodeId}"] .node-circle, [data-node-id="${nodeId}"] .node-rect`,
        );
        (el as HTMLElement | null)?.focus?.();
    }

    const menuTarget = menu ? (nodes.find((n) => n.id === menu.nodeId) ?? null) : null;
    const menuHasChildren = menuTarget ? nodes.some((n) => n.parentId === menuTarget.id) : false;
    // Single traversal for all badge counts instead of one per collapsed node.
    const subtreeCounts = getSubtreeCountsPure(nodes);

    return (
        <div
            ref={containerRef}
            className={`tree-canvas${dragging ? " tree-canvas--dragging" : ""}`}
            data-testid="tree-canvas"
            tabIndex={-1}
            onWheel={handleWheel}
            onMouseDown={(e) => handleMouseDown(e, clearSelection)}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={(e) => handleTouchStart(e, clearSelection)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div
                className="tree-world"
                data-testid="tree-world"
                style={{
                    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                    transformOrigin: "0 0",
                    transition: animate ? "transform 220ms ease" : undefined,
                }}
            >
                <svg className="tree-edges" aria-hidden="true">
                    {edges.map((e) => {
                        const from = positions.get(e.from);
                        const to = positions.get(e.to);
                        if (!from || !to) return null;
                        return (
                            <line
                                key={`${e.from}-${e.to}`}
                                x1={from.x}
                                y1={from.y}
                                x2={to.x}
                                y2={to.y}
                                stroke="var(--line)"
                                strokeWidth={1.5}
                            />
                        );
                    })}
                </svg>
                {visibleNodes.map((n) => {
                    const pos = positions.get(n.id);
                    if (!pos) return null;
                    const nodeProps = {
                        id: n.id,
                        text: n.text,
                        url: n.url ?? null,
                        x: pos.x,
                        y: pos.y,
                        selected: selectedId === n.id,
                        editing: editingId === n.id,
                        onSelect: handleSelect,
                        onAddChild: handlePlus,
                        onEditStart: handleEditStart,
                        onCommitText: handleCommitText,
                        onCancelEdit: handleCancelEdit,
                        onContextMenu: handleNodeContextMenu,
                        onToggleCollapsed: (id: string) => void onToggleCollapsed?.(id),
                        onOpenLink: handleOpenBadge,
                        collapsed: n.collapsed,
                        hiddenCount: n.collapsed ? (subtreeCounts.get(n.id) ?? 1) - 1 : 0,
                    };
                    if (n.kind === "note" || n.media) {
                        return (
                            <NodeRect
                                key={n.id}
                                {...nodeProps}
                                media={n.media ?? null}
                                mediaFill={n.mediaFill}
                                onOpenMedia={handleOpenMediaBadge}
                                loadBlob={loadBlob}
                            />
                        );
                    }
                    return <NodeCircle key={n.id} {...nodeProps} />;
                })}
            </div>
            <input
                ref={uploadInputRef}
                type="file"
                hidden
                accept={UPLOAD_ACCEPT}
                aria-label="Upload image file"
                onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    const nodeId = uploadNodeId;
                    setUploadNodeId(null);
                    if (file && nodeId) void handlePickedUpload(nodeId, file);
                }}
            />
            {menuTarget && (
                <NodeContextMenu
                    menu={menu}
                    text={menuTarget.text}
                    kind={menuTarget.kind}
                    url={menuTarget.url ?? null}
                    media={menuTarget.media ?? null}
                    mediaFill={menuTarget.mediaFill}
                    collapsed={menuTarget.collapsed}
                    hasChildren={menuHasChildren}
                    isRoot={menuTarget.id === rootNodeId}
                    onClose={() => closeMenu(menu?.nodeId)}
                    onEdit={handleMenuEdit}
                    onConvert={(kind) => void handleMenuConvert(kind)}
                    onEditLink={handleMenuLink}
                    onOpenLink={handleOpenLink}
                    onRemoveLink={() => void handleRemoveLink()}
                    onEditMedia={handleMenuMedia}
                    onOpenMedia={handleOpenMedia}
                    onRemoveMedia={() => void handleRemoveMedia()}
                    onToggleMediaFill={() => void handleMenuToggleMediaFill()}
                    onUploadImage={handleMenuUploadImage}
                    canUpload={canUpload ?? false}
                    onToggleCollapse={handleMenuToggleCollapse}
                    onDelete={handleMenuDelete}
                />
            )}
            <NodeConvertDialog target={convertTarget} onCancel={handleCancelConvert} onConfirm={() => void handleConfirmConvert()} />
            <NodeDeleteDialog target={deleteTarget} onCancel={handleCancelDelete} onConfirm={handleConfirmDelete} />
            <NodeLinkDialog
                key={linkTarget ? `${linkTarget.nodeId}:${linkTarget.url ?? ""}` : "link-closed"}
                target={linkTarget}
                onCancel={handleCancelLink}
                onSave={(url) => void handleSaveLink(url)}
            />
            <NodeMediaDialog
                key={mediaTarget ? `${mediaTarget.nodeId}:${mediaTarget.media?.kind ?? ""}:${mediaTarget.media?.src ?? ""}` : "media-closed"}
                target={mediaTarget}
                canUpload={canUpload ?? false}
                onCancel={handleCancelMedia}
                onSave={(media) => void handleSaveMedia(media)}
                onUploadFile={(file) => handleDialogUploadFile(file)}
            />
            <div
                className="tree-zoom-badge"
                data-testid="zoom-badge"
                role="status"
                aria-label={`Zoom ${formatZoomPct(viewport.zoom)}`}
            >
                {formatZoomPct(viewport.zoom)}
            </div>
        </div>
    );
}
