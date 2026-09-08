import { useState } from "react";
import { NOTE_HEIGHT, NOTE_WIDTH } from "../../lib/layout";
import type { NodeMedia, NodeSide } from "../../types/node";
import NodeEditor from "./NodeEditor";
import NodeLinkBadge from "./NodeLinkBadge";
import NodeMediaGlyph from "./NodeMediaGlyph";
import NodeUploadedImage from "./NodeUploadedImage";
import { PLUS_POSITIONS, useNodeGestures } from "./useNodeGestures";
import { MAX_NOTE_TEXT_LENGTH } from "../../storage/localStore";
import "./TreeCanvas.css";

type NodeRectProps = {
    id: string;
    text: string;
    url: string | null;
    media: NodeMedia | null;
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
    onOpenMedia: (id: string) => void;
    loadBlob?: (uploadId: string) => Promise<Blob | null>;
    collapsed: boolean;
    hiddenCount: number;
};

export default function NodeRect({
    id,
    text,
    url,
    media,
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
    onOpenMedia,
    loadBlob,
    collapsed,
    hiddenCount,
}: NodeRectProps) {
    const needsTooltip = text.length > 60;
    const g = useNodeGestures({ id, selected, onSelect, onEditStart, onContextMenu });
    const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
    const uploadId = media?.uploadId ?? null;
    const showImage = media?.kind === "image" && media.src.trim().length > 0 && media.src !== brokenSrc;

    return (
        <div
            className={`node-wrap${selected ? " node-wrap--selected" : ""}`}
            data-node-id={id}
            data-editing={editing ? "true" : undefined}
            style={{
                left: x - NOTE_WIDTH / 2,
                top: y - NOTE_HEIGHT / 2,
                width: NOTE_WIDTH,
                height: NOTE_HEIGHT,
            }}
        >
            <div
                className={`node-rect${media ? " node-rect--media" : ""}`}
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
                        maxLength={MAX_NOTE_TEXT_LENGTH}
                        multiline
                        onCommit={(value) => onCommitText(id, value)}
                        onCancel={() => onCancelEdit(id)}
                    />
                ) : (
                    <>
                        <span className={`node-rect__text${media ? " node-rect__text--media" : ""}`}>{text}</span>
                        {media &&
                            (uploadId && loadBlob ? (
                                <NodeUploadedImage uploadId={uploadId} loadBlob={loadBlob} />
                            ) : (
                                <span className="node-rect__media" aria-hidden="true">
                                    {showImage ? (
                                    <img
                                        className="node-rect__img"
                                        src={media.src}
                                        alt=""
                                        loading="lazy"
                                        draggable={false}
                                        onError={() => setBrokenSrc(media.src)}
                                    />
                                ) : (
                                    <span className="node-rect__placeholder">
                                        {media.kind === "video" ? (
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                                                <path d="M6.5 5.5v5l4-2.5-4-2.5z" fill="currentColor" />
                                            </svg>
                                        ) : (
                                            <NodeMediaGlyph kind="image" size={16} />
                                        )}
                                    </span>
                                )}
                            </span>
                            )
                        )}
                    </>
                )}
            </div>
            {url && <NodeLinkBadge text={text} url={url} onOpen={() => onOpenLink(id)} />}
            {media && (
                <button
                    type="button"
                    className="node-media"
                    title={uploadId ? "Uploaded image" : `${media.kind}: ${media.src}`}
                    aria-label={`Open ${media.kind} for "${text}"`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenMedia(id);
                    }}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                >
                    <NodeMediaGlyph kind={media.kind} />
                </button>
            )}
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
