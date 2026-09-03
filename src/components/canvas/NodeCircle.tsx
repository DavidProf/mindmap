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
}: NodeCircleProps) {
    const radius = NODE_DIAMETER / 2;
    const downRef = useRef<{ x: number; y: number } | null>(null);
    const lastTapRef = useRef(0);
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
                onTouchStart={(e) => {
                    const t = e.touches[0];
                    if (t) recordDown(t.clientX, t.clientY);
                }}
                onClick={handleCircleClick}
                onKeyDown={handleCircleKeyDown}
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
            {PLUS_POSITIONS.map((pos) => (
                <button
                    key={pos}
                    type="button"
                    className={`node-plus node-plus--${pos}`}
                    aria-label={`Add child to ${text}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
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
