import { useEffect, useRef, useState } from "react";
import type { Node, NodeSide } from "../../types/node";
import type { Position } from "../../lib/layout";
import { countSubtreeNodesPure, getSubtreeCountsPure } from "../../lib/storage";
import useViewport from "./useViewport";
import type { CanvasBounds } from "./useViewport";
import NodeCircle from "./NodeCircle";
import NodeContextMenu from "./NodeContextMenu";
import type { NodeMenuState } from "./NodeContextMenu";
import NodeDeleteDialog from "./NodeDeleteDialog";
import type { NodeDeleteTarget } from "./NodeDeleteDialog";
import "./TreeCanvas.css";

type TreeCanvasProps = {
    projectId: string;
    rootNodeId: string;
    nodes: Node[];
    positions: Map<string, Position>;
    edges: { from: string; to: string }[];
    bounds: CanvasBounds;
    recenterSignal?: number;
    onAddChild?: (parentId: string, text: string, side: NodeSide) => Node | null;
    onUpdateText?: (nodeId: string, text: string) => Node | null;
    onToggleCollapsed?: (nodeId: string) => Node | null;
    onDeleteSubtree?: (nodeId: string) => { deletedIds: string[] } | null;
};

export default function TreeCanvas({ projectId, rootNodeId, nodes, positions, edges, bounds, recenterSignal, onAddChild, onUpdateText, onToggleCollapsed, onDeleteSubtree }: TreeCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [menu, setMenu] = useState<NodeMenuState | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<NodeDeleteTarget | null>(null);
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
    } = useViewport({ projectId, bounds, containerRef, onInteract: () => closeMenu() });

    function clearSelection() {
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
