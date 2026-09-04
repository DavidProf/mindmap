import { useRef } from "react";
import { NODE_DIAMETER } from "../../lib/layout";
import { NODE_SIDES } from "../../types/node";
import type { NodeSide } from "../../types/node";
import NodeEditor from "./NodeEditor";
import "./TreeCanvas.css";

// Movement beyond this is a canvas pan, not a tap, so the tap is ignored.
const CLICK_THRESHOLD_PX = 6;
// Two taps within this window count as a double-tap to edit.
// One code path covers mouse double-click and touch double-tap.
const DOUBLE_TAP_MS = 350;
// Holding a finger still this long opens the context menu (feature 5).
const LONG_PRESS_MS = 500;
// Movement beyond this cancels a pending long-press (it became a pan).
const LONG_PRESS_MOVE_PX = 10;

type NodeCircleProps = {
    id: string;
    text: string;
    x: number;
    y: number;
    selected: boolean;
    editing: boolean;
    onSelect: (id: string) => void;
    onAddChild: (parentId: string, side: NodeSide) => void;
    onEditStart: (id: string) => void;
    onCommitText: (id: string, text: string) => void;
    onCancelEdit: (id: string) => void;
    onContextMenu: (id: string, x: number, y: number) => void;
    collapsed: boolean;
    hiddenCount: number;
};

const PLUS_POSITIONS: readonly NodeSide[] = NODE_SIDES;

export default function NodeCircle({
    id,
    text,
    x,
    y,
    selected,
    editing,
    onSelect,
    onAddChild,
    onEditStart,
    onCommitText,
    onCancelEdit,
    onContextMenu,
    collapsed,
    hiddenCount,
}: NodeCircleProps) {
    const radius = NODE_DIAMETER / 2;
    const downRef = useRef<{ x: number; y: number } | null>(null);
    const lastTapRef = useRef(0);
    const pressRef = useRef<{ timer: number; x: number; y: number } | null>(null);
    const pressFiredRef = useRef(false);
    const needsTooltip = text.length > 40;

    function recordDown(clientX: number, clientY: number) {
        downRef.current = { x: clientX, y: clientY };
    }

    function wasDrag(clientX: number, clientY: number): boolean {
        const down = downRef.current;
        downRef.current = null;
        if (!down) return false;
        return Math.hypot(clientX - down.x, clientY - down.y) > CLICK_THRESHOLD_PX;
    }

    function handleCircleClick(e: React.MouseEvent) {
        e.stopPropagation();
        // A long-press is followed by a synthetic click; swallow it so the
        // tap does not select or double-tap-edit after the menu opens.
        if (pressFiredRef.current) {
            pressFiredRef.current = false;
            return;
        }
        if (wasDrag(e.clientX, e.clientY)) return;
        onSelect(id);
        const now = Date.now();
        if (now - lastTapRef.current < DOUBLE_TAP_MS) {
            lastTapRef.current = 0;
            onEditStart(id);
        } else {
            lastTapRef.current = now;
        }
    }

    function handleCircleContextMenu(e: React.MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(id, e.clientX, e.clientY);
    }

    function cancelPress() {
        if (pressRef.current) {
            window.clearTimeout(pressRef.current.timer);
            pressRef.current = null;
        }
    }

    function handleCircleTouchStart(e: React.TouchEvent) {
        const t = e.touches[0];
        if (t) recordDown(t.clientX, t.clientY);
        // A second finger means pinch, never a long-press.
        if (e.touches.length !== 1) {
            cancelPress();
            return;
        }
        const touch = e.touches[0];
        cancelPress();
        pressRef.current = {
            timer: window.setTimeout(() => {
                pressRef.current = null;
                pressFiredRef.current = true;
                onContextMenu(id, touch.clientX, touch.clientY);
            }, LONG_PRESS_MS),
            x: touch.clientX,
            y: touch.clientY,
        };
    }

    function handleCircleTouchMove(e: React.TouchEvent) {
        const p = pressRef.current;
        if (!p) return;
        const t = e.touches[0];
        if (!t || e.touches.length !== 1 || Math.hypot(t.clientX - p.x, t.clientY - p.y) > LONG_PRESS_MOVE_PX) {
            cancelPress();
        }
    }

    function handleCircleTouchEnd() {
        // Keep pressFiredRef until the synthetic click runs and clears it.
        cancelPress();
    }

    function handleCircleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            // Enter on an already-selected node edits; otherwise it selects.
            if (selected && e.key === "Enter") onEditStart(id);
            else onSelect(id);
        }
    }

    return (
        <div
            className={`node-wrap${selected ? " node-wrap--selected" : ""}`}
            data-node-id={id}
            data-editing={editing ? "true" : undefined}
            style={{
                left: x - radius,
                top: y - radius,
                width: NODE_DIAMETER,
                height: NODE_DIAMETER,
            }}
        >
            <div
                className="node-circle"
                title={needsTooltip ? text : undefined}
                aria-label={text}
                tabIndex={0}
                onMouseDown={(e) => recordDown(e.clientX, e.clientY)}
                onTouchStart={handleCircleTouchStart}
                onTouchMove={handleCircleTouchMove}
                onTouchEnd={handleCircleTouchEnd}
                onTouchCancel={handleCircleTouchEnd}
                onClick={handleCircleClick}
                onKeyDown={handleCircleKeyDown}
                onContextMenu={handleCircleContextMenu}
            >
                {editing ? (
                    <NodeEditor
                        nodeId={id}
                        initialText={text}
                        onCommit={(value) => onCommitText(id, value)}
                        onCancel={() => onCancelEdit(id)}
                    />
                ) : (
                    <span className="node-circle__text">{text}</span>
                )}
            </div>
            {collapsed && hiddenCount > 0 && (
                <span
                    className="node-badge"
                    aria-label={`Collapsed, ${hiddenCount} hidden node${hiddenCount === 1 ? "" : "s"}`}
                >
                    +{hiddenCount}
                </span>
            )}
            {PLUS_POSITIONS.map((pos) => (
                <button
                    key={pos}
                    type="button"
                    className={`node-plus node-plus--${pos}`}
                    aria-label={`Add child to ${text}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddChild(id, pos);
                    }}
                >
                    <span aria-hidden="true">+</span>
                </button>
            ))}
        </div>
    );
}
