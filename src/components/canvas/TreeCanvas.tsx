import { useEffect, useRef, useState } from "react";
import type { Node, NodeSide } from "../../types/node";
import type { Position } from "../../lib/layout";
import type { Viewport } from "../../types/project";
import { clampZoom, countSubtreeNodesPure, DEFAULT_VIEWPORT, getSubtreeCountsPure, getViewport, MIN_ZOOM, setViewport } from "../../lib/storage";
import NodeCircle from "./NodeCircle";
import NodeContextMenu from "./NodeContextMenu";
import type { NodeMenuState } from "./NodeContextMenu";
import NodeDeleteDialog from "./NodeDeleteDialog";
import type { NodeDeleteTarget } from "./NodeDeleteDialog";
import "./TreeCanvas.css";

type Bounds = { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number };

type TreeCanvasProps = {
    projectId: string;
    rootNodeId: string;
    nodes: Node[];
    positions: Map<string, Position>;
    edges: { from: string; to: string }[];
    bounds: Bounds;
    recenterSignal?: number;
    onAddChild?: (parentId: string, text: string, side: NodeSide) => Node | null;
    onUpdateText?: (nodeId: string, text: string) => Node | null;
    onToggleCollapsed?: (nodeId: string) => Node | null;
    onDeleteSubtree?: (nodeId: string) => { deletedIds: string[] } | null;
};

export default function TreeCanvas({ projectId, rootNodeId, nodes, positions, edges, bounds, recenterSignal, onAddChild, onUpdateText, onToggleCollapsed, onDeleteSubtree }: TreeCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [viewport, setViewportState] = useState<Viewport>(() => getViewport(projectId) ?? { ...DEFAULT_VIEWPORT });
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [menu, setMenu] = useState<NodeMenuState | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<NodeDeleteTarget | null>(null);
    const [animate, setAnimate] = useState(false);
    const [dragging, setDragging] = useState(false);
    const dragRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
    const pinchRef = useRef<{ dist: number; zoom: number; midX: number; midY: number; vx: number; vy: number } | null>(null);
    const wheelTimer = useRef<number | null>(null);
    const animateTimer = useRef<number | null>(null);
    const visibleNodes = nodes.filter((n) => positions.has(n.id));

    useEffect(() => {
        return () => {
            if (wheelTimer.current) window.clearTimeout(wheelTimer.current);
            if (animateTimer.current) window.clearTimeout(animateTimer.current);
        };
    }, []);

    function commitViewport(next: Viewport) {
        try {
            const persisted = setViewport(projectId, next);
            setViewportState(persisted);
        } catch {
            setViewportState(next);
        }
    }

    function handleRecenter(e?: React.MouseEvent) {
        e?.stopPropagation();
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const viewW = rect.width;
        const viewH = rect.height;
        if (bounds.width === 0 || bounds.height === 0) {
            const next = { x: 0, y: 0, zoom: 1 };
            setAnimate(true);
            commitViewport(next);
            if (animateTimer.current) window.clearTimeout(animateTimer.current);
            animateTimer.current = window.setTimeout(() => setAnimate(false), 260);
            return;
        }
        const scaleX = viewW / bounds.width;
        const scaleY = viewH / bounds.height;
        let scale = Math.min(scaleX, scaleY) * 0.85;
        scale = Math.min(1, Math.max(MIN_ZOOM, Math.min(1.5, scale)));
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        const next = { x: -centerX * scale, y: -centerY * scale, zoom: scale };
        setAnimate(true);
        commitViewport(next);
        if (animateTimer.current) window.clearTimeout(animateTimer.current);
        animateTimer.current = window.setTimeout(() => setAnimate(false), 260);
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

    function getDistance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }): number {
        return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }

    function isOverlayEvent(e: React.SyntheticEvent): boolean {
        // MUI Menu/Dialog render into body portals, but React events from a
        // portal still bubble through this component's handlers. A press
        // inside an open overlay must not dismiss it or start a canvas drag,
        // or the menu item unmounts before its click fires.
        const el = e.target as Element | null;
        if (!el || typeof el.closest !== "function") return false;
        return el.closest('[role="menu"], [role="dialog"]') !== null;
    }

    function handleWheel(e: React.WheelEvent) {
        if (isOverlayEvent(e)) return;
        closeMenu();
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const delta = e.deltaY;
        const factor = Math.exp(-delta * 0.002);
        const newZoom = clampZoom(viewport.zoom * factor);
        if (newZoom === viewport.zoom) return;
        const worldX = (cx - centerX - viewport.x) / viewport.zoom;
        const worldY = (cy - centerY - viewport.y) / viewport.zoom;
        const next = {
            x: cx - centerX - worldX * newZoom,
            y: cy - centerY - worldY * newZoom,
            zoom: newZoom,
        };
        setViewportState(next);
        if (wheelTimer.current) window.clearTimeout(wheelTimer.current);
        wheelTimer.current = window.setTimeout(() => commitViewport(next), 300);
    }

    function handleMouseDown(e: React.MouseEvent) {
        if (isOverlayEvent(e)) return;
        closeMenu();
        if (e.button !== 0) return;
        if (e.target === e.currentTarget) setSelectedId(null);
        e.preventDefault();
        dragRef.current = { sx: e.clientX, sy: e.clientY, vx: viewport.x, vy: viewport.y };
        setDragging(true);
    }

    function handleMouseMove(e: React.MouseEvent) {
        if (!dragRef.current) return;
        const dx = e.clientX - dragRef.current.sx;
        const dy = e.clientY - dragRef.current.sy;
        setViewportState({ x: dragRef.current.vx + dx, y: dragRef.current.vy + dy, zoom: viewport.zoom });
    }

    function handleMouseUp() {
        if (!dragRef.current) return;
        const final: Viewport = {
            x: viewport.x,
            y: viewport.y,
            zoom: viewport.zoom,
        };
        dragRef.current = null;
        setDragging(false);
        commitViewport(final);
    }

    function handleTouchStart(e: React.TouchEvent) {
        if (isOverlayEvent(e)) return;
        closeMenu();
        if (e.target === e.currentTarget) setSelectedId(null);
        if (e.touches.length === 1) {
            const t = e.touches[0];
            dragRef.current = { sx: t.clientX, sy: t.clientY, vx: viewport.x, vy: viewport.y };
            setDragging(true);
        } else if (e.touches.length === 2) {
            const a = e.touches[0];
            const b = e.touches[1];
            const dist = getDistance(a, b);
            const midX = (a.clientX + b.clientX) / 2;
            const midY = (a.clientY + b.clientY) / 2;
            const rect = containerRef.current?.getBoundingClientRect();
            const cx = rect ? midX - rect.left : midX;
            const cy = rect ? midY - rect.top : midY;
            // store canvas-relative mid for centered math
            pinchRef.current = { dist, zoom: viewport.zoom, midX: cx, midY: cy, vx: viewport.x, vy: viewport.y };
            dragRef.current = null;
            setDragging(false);
        }
    }

    function handleTouchMove(e: React.TouchEvent) {
        if (e.touches.length === 2 && pinchRef.current) {
            const a = e.touches[0];
            const b = e.touches[1];
            const newDist = getDistance(a, b);
            if (newDist === 0) return;
            const scale = newDist / pinchRef.current.dist;
            const newZoom = clampZoom(pinchRef.current.zoom * scale);
            // pinch mid is in canvas coordinates; convert to centered world
            const rect = containerRef.current?.getBoundingClientRect();
            const centerX = rect ? rect.width / 2 : 0;
            const centerY = rect ? rect.height / 2 : 0;
            const worldX = (pinchRef.current.midX - centerX - pinchRef.current.vx) / pinchRef.current.zoom;
            const worldY = (pinchRef.current.midY - centerY - pinchRef.current.vy) / pinchRef.current.zoom;
            const next = {
                x: pinchRef.current.midX - centerX - worldX * newZoom,
                y: pinchRef.current.midY - centerY - worldY * newZoom,
                zoom: newZoom,
            };
            setViewportState(next);
        } else if (e.touches.length === 1 && dragRef.current) {
            const t = e.touches[0];
            const dx = t.clientX - dragRef.current.sx;
            const dy = t.clientY - dragRef.current.sy;
            setViewportState({ x: dragRef.current.vx + dx, y: dragRef.current.vy + dy, zoom: viewport.zoom });
        }
    }

    function handleTouchEnd(e: React.TouchEvent) {
        if (e.touches.length === 0) {
            if (pinchRef.current) {
                const final = { x: viewport.x, y: viewport.y, zoom: viewport.zoom };
                pinchRef.current = null;
                commitViewport(final);
            } else if (dragRef.current) {
                const final = { x: viewport.x, y: viewport.y, zoom: viewport.zoom };
                dragRef.current = null;
                setDragging(false);
                commitViewport(final);
            }
        } else if (e.touches.length === 1) {
            pinchRef.current = null;
            const t = e.touches[0];
            dragRef.current = { sx: t.clientX, sy: t.clientY, vx: viewport.x, vy: viewport.y };
            setDragging(true);
        }
    }

    function handleSelect(id: string) {
        commitPendingEdit(id);
        setSelectedId(id);
        focusCircle(id);
    }

    function handlePlus(parentId: string, side: NodeSide) {
        if (!onAddChild) return;
        const child = onAddChild(parentId, "New idea", side);
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

    function closeMenu(focusNodeId?: string) {
        setMenu((open) => (open === null ? open : null));
        if (focusNodeId) focusCircle(focusNodeId);
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

    function handleMenuToggleCollapse() {
        const target = menu?.nodeId;
        closeMenu(target);
        if (target) onToggleCollapsed?.(target);
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

    function handleCancelDelete() {
        const target = deleteTarget;
        setDeleteTarget(null);
        if (target) focusCircle(target.nodeId);
    }

    function handleConfirmDelete() {
        const target = deleteTarget;
        if (!target) return;
        const parentId = nodes.find((n) => n.id === target.nodeId)?.parentId ?? null;
        const res = onDeleteSubtree?.(target.nodeId);
        setDeleteTarget(null);
        if (res) {
            // The selection and editor must not point into a removed subtree.
            if (selectedId !== null && res.deletedIds.includes(selectedId)) setSelectedId(null);
            if (editingId !== null && res.deletedIds.includes(editingId)) setEditingId(null);
            // Move focus out of the removed subtree: parent circle, else canvas.
            requestAnimationFrame(() => {
                if (parentId && document.querySelector(`[data-node-id="${parentId}"] .node-circle`)) {
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

    function handleCommitText(nodeId: string, text: string) {
        const node = nodes.find((n) => n.id === nodeId);
        const trimmed = text.trim();
        // Empty or unchanged text reverts: the prior text stays, no write.
        if (!node || trimmed.length === 0 || trimmed === node.text) {
            setEditingId(null);
            focusCircle(nodeId);
            return;
        }
        const updated = onUpdateText?.(nodeId, text) ?? null;
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

    function focusCircle(nodeId: string) {
        // The circle div survives the editor/text swap, so focusing it keeps
        // keyboard users in the canvas flow instead of dropping to body.
        const el = document.querySelector(`[data-node-id="${nodeId}"] .node-circle`);
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
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
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
                    return (
                        <NodeCircle
                            key={n.id}
                            id={n.id}
                            text={n.text}
                            x={pos.x}
                            y={pos.y}
                            selected={selectedId === n.id}
                            editing={editingId === n.id}
                            onSelect={handleSelect}
                            onAddChild={handlePlus}
                            onEditStart={handleEditStart}
                            onCommitText={handleCommitText}
                            onCancelEdit={handleCancelEdit}
                            onContextMenu={handleNodeContextMenu}
                            collapsed={n.collapsed}
                            hiddenCount={n.collapsed ? (subtreeCounts.get(n.id) ?? 1) - 1 : 0}
                        />
                    );
                })}
            </div>
            {menuTarget && (
                <NodeContextMenu
                    menu={menu}
                    text={menuTarget.text}
                    collapsed={menuTarget.collapsed}
                    hasChildren={menuHasChildren}
                    isRoot={menuTarget.id === rootNodeId}
                    onClose={() => closeMenu(menu?.nodeId)}
                    onEdit={handleMenuEdit}
                    onToggleCollapse={handleMenuToggleCollapse}
                    onDelete={handleMenuDelete}
                />
            )}
            <NodeDeleteDialog target={deleteTarget} onCancel={handleCancelDelete} onConfirm={handleConfirmDelete} />
        </div>
    );
}
