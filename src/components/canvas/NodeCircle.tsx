import { NODE_DIAMETER } from "../../lib/layout";
import type { NodeSide } from "../../types/node";
import NodeEditor from "./NodeEditor";
import NodeFrame from "./NodeFrame";
import { useNodeGestures } from "./useNodeGestures";
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
    const needsTooltip = text.length > 40;
    const g = useNodeGestures({ id, selected, onSelect, onEditStart, onContextMenu });

    return (
        <NodeFrame
            id={id}
            text={text}
            url={url}
            x={x}
            y={y}
            width={NODE_DIAMETER}
            height={NODE_DIAMETER}
            selected={selected}
            editing={editing}
            collapsed={collapsed}
            hiddenCount={hiddenCount}
            onAddChild={onAddChild}
            onToggleCollapsed={onToggleCollapsed}
            onOpenLink={onOpenLink}
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
        </NodeFrame>
    );
}
