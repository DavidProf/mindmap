import { NODE_DIAMETER } from "../../lib/layout";
import type { NodeSide } from "../../types/node";
import NodeEditor from "./NodeEditor";
import NodeLinkBadge from "./NodeLinkBadge";
import { PLUS_POSITIONS, useNodeGestures } from "./useNodeGestures";
import "./TreeCanvas.css";

type NodeCircleProps = {
    id: string;
    text: string;
    url: string | null;
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
    onToggleCollapsed: (id: string) => void;
    onOpenLink: (id: string) => void;
    collapsed: boolean;
    hiddenCount: number;
};

export default function NodeCircle({
    id,
    text,
    url,
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
    onToggleCollapsed,
    onOpenLink,
    collapsed,
    hiddenCount,
}: NodeCircleProps) {
    const radius = NODE_DIAMETER / 2;
    const needsTooltip = text.length > 40;
    const g = useNodeGestures({ id, selected, onSelect, onEditStart, onContextMenu });

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
                onMouseDown={g.recordMouseDown}
                onTouchStart={g.handleTouchStart}
                onTouchMove={g.handleTouchMove}
                onTouchEnd={g.handleTouchEnd}
                onTouchCancel={g.handleTouchEnd}
                onClick={g.handleShapeClick}
                onKeyDown={g.handleShapeKeyDown}
                onContextMenu={g.handleShapeContextMenu}
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
            {url && <NodeLinkBadge text={text} url={url} onOpen={() => onOpenLink(id)} />}
            {collapsed && hiddenCount > 0 && (
                <button
                    type="button"
                    className="node-badge"
                    aria-expanded="false"
                    aria-label={`Expand, ${hiddenCount} hidden node${hiddenCount === 1 ? "" : "s"}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleCollapsed(id);
                    }}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                >
                    +{hiddenCount}
                </button>
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
