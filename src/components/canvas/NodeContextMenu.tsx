import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import type { NodeKind, NodeMedia, NodeSize } from "../../types/node";
import { NODE_SIZES } from "../../types/node";

// Convert targets are the non-media kinds; media arrives by attaching, not converting.
const CONVERT_TARGETS: readonly NodeKind[] = ["circle", "note"];

export type NodeMenuState = { x: number; y: number; nodeId: string };

type NodeContextMenuProps = {
    menu: NodeMenuState | null;
    text: string;
    kind: NodeKind;
    url: string | null;
    media: NodeMedia | null;
    mediaFill: boolean;
    size: NodeSize;
    collapsed: boolean;
    hasChildren: boolean;
    isRoot: boolean;
    onClose: () => void;
    onEdit: () => void;
    onConvert: (kind: NodeKind) => void;
    onEditLink: () => void;
    onOpenLink: () => void;
    onRemoveLink: () => void;
    onEditMedia: () => void;
    onOpenMedia: () => void;
    onRemoveMedia: () => void;
    onToggleMediaFill: () => void;
    onSetSize: (size: NodeSize) => void;
    onToggleCollapse: () => void;
    onDelete: () => void;
};

export default function NodeContextMenu({
    menu,
    text,
    kind,
    url,
    media,
    mediaFill,
    size,
    collapsed,
    hasChildren,
    isRoot,
    onClose,
    onEdit,
    onConvert,
    onEditLink,
    onOpenLink,
    onRemoveLink,
    onEditMedia,
    onOpenMedia,
    onRemoveMedia,
    onToggleMediaFill,
    onSetSize,
    onToggleCollapse,
    onDelete,
}: NodeContextMenuProps) {
    return (
        <Menu
            open={menu !== null}
            onClose={onClose}
            anchorReference="anchorPosition"
            anchorPosition={menu ? { top: menu.y, left: menu.x } : undefined}
        >
            <MenuItem onClick={onEdit} aria-label={`Edit "${text}"`}>
                Edit
            </MenuItem>
            <MenuItem onClick={onEditLink} aria-label={`${url ? "Edit link" : "Add link"} for "${text}"`}>
                {url ? "Edit link" : "Add link"}
            </MenuItem>
            <MenuItem onClick={onOpenLink} disabled={!url} aria-label={`Open link for "${text}"`}>
                Open link
            </MenuItem>
            {url && (
                <MenuItem onClick={onRemoveLink} aria-label={`Remove link for "${text}"`}>
                    Remove link
                </MenuItem>
            )}
            <MenuItem onClick={onEditMedia} aria-label={`${media ? "Edit media" : "Add media"} for "${text}"`}>
                {media ? "Edit media" : "Add media"}
            </MenuItem>
            <MenuItem onClick={onOpenMedia} disabled={!media} aria-label={`Open media for "${text}"`}>
                Open media
            </MenuItem>
            {media && (
                <MenuItem onClick={onRemoveMedia} aria-label={`Remove media for "${text}"`}>
                    Remove media
                </MenuItem>
            )}
            {media && (
                <MenuItem
                    onClick={onToggleMediaFill}
                    role="menuitemcheckbox"
                    aria-checked={mediaFill}
                    aria-label={`Fill node with media for "${text}"`}
                >
                    {mediaFill ? "\u2713 Fill node with media" : "Fill node with media"}
                </MenuItem>
            )}
            {(kind !== "circle") &&
                NODE_SIZES.map((s) => (
                    <MenuItem
                        key={s}
                        onClick={() => onSetSize(s)}
                        role="menuitemcheckbox"
                        aria-checked={size === s}
                        aria-label={`Set node size ${s} for "${text}"`}
                    >
                        {size === s ? "\u2713" : "\u00a0\u00a0"} Node size: {s}
                    </MenuItem>
                ))}
            {CONVERT_TARGETS.filter((t) => t !== kind).map((t) => (
                <MenuItem key={t} onClick={() => onConvert(t)} aria-label={`Convert "${text}" to ${t}`}>
                    Convert to {t}
                </MenuItem>
            ))}
            <MenuItem
                onClick={onToggleCollapse}
                disabled={!hasChildren}
                title={hasChildren ? undefined : "No branches to collapse"}
                aria-label={collapsed ? `Expand "${text}"` : `Collapse "${text}"`}
            >
                {collapsed ? "Expand" : "Collapse"}
            </MenuItem>
            {!isRoot && (
                <MenuItem onClick={onDelete} aria-label={`Delete "${text}"`} sx={{ color: "var(--danger)" }}>
                    Delete
                </MenuItem>
            )}
        </Menu>
    );
}
