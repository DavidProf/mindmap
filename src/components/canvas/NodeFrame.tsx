import type { MouseEvent, ReactNode, TouchEvent } from "react";
import type { NodeSide } from "../../types/node";
import NodeLinkBadge from "./NodeLinkBadge";
import { PLUS_POSITIONS } from "./useNodeGestures";

function stop(e: MouseEvent | TouchEvent) {
    e.stopPropagation();
}

function stopAndPrevent(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
}

type CanvasButtonProps = {
    className: string;
    title?: string;
    label: string;
    expanded?: boolean;
    onPress: () => void;
    children: ReactNode;
};

export function CanvasButton({ className, title, label, expanded, onPress, children }: CanvasButtonProps) {
    return (
        <button
            type="button"
            className={className}
            title={title}
            aria-label={label}
            aria-expanded={expanded}
            onMouseDown={stop}
            onTouchStart={stop}
            onContextMenu={stopAndPrevent}
            onClick={(e) => {
                e.stopPropagation();
                onPress();
            }}
        >
            {children}
        </button>
    );
}

type NodeFrameProps = {
    id: string;
    text: string;
    url: string | null;
    x: number;
    y: number;
    width: number;
    height: number;
    selected: boolean;
    editing: boolean;
    collapsed: boolean;
    hiddenCount: number;
    onAddChild: (parentId: string, side: NodeSide) => void;
    onToggleCollapsed: (id: string) => void;
    onOpenLink: (id: string) => void;
    children: ReactNode;
};

export default function NodeFrame({
    id,
    text,
    url,
    x,
    y,
    width,
    height,
    selected,
    editing,
    collapsed,
    hiddenCount,
    onAddChild,
    onToggleCollapsed,
    onOpenLink,
    children,
}: NodeFrameProps) {
    return (
        <div
            className={`node-wrap${selected ? " node-wrap--selected" : ""}`}
            data-node-id={id}
            data-editing={editing ? "true" : undefined}
            style={{ left: x - width / 2, top: y - height / 2, width, height }}
        >
            {children}
            {url && <NodeLinkBadge text={text} url={url} onOpen={() => onOpenLink(id)} />}
            {collapsed && hiddenCount > 0 && (
                <CanvasButton
                    className="node-badge"
                    label={`Expand, ${hiddenCount} hidden node${hiddenCount === 1 ? "" : "s"}`}
                    expanded={false}
                    onPress={() => onToggleCollapsed(id)}
                >
                    +{hiddenCount}
                </CanvasButton>
            )}
            {PLUS_POSITIONS.map((pos) => (
                <CanvasButton
                    key={pos}
                    className={`node-plus node-plus--${pos}`}
                    label={`Add child to ${text}`}
                    onPress={() => onAddChild(id, pos)}
                >
                    <span aria-hidden="true">+</span>
                </CanvasButton>
            ))}
        </div>
    );
}
