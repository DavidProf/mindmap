import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import type { NodeKind, NodeMedia } from "../../types/node";

export type NodeMenuState = { x: number; y: number; nodeId: string };

type NodeContextMenuProps = {
    menu: NodeMenuState | null;
    text: string;
    kind: NodeKind;
    url: string | null;
    media: NodeMedia | null;
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
    onToggleCollapse: () => void;
    onDelete: () => void;
};

export default function NodeContextMenu({
    menu,
    text,
    kind,
    url,
    media,
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
            {kind === "note" ? (
                <MenuItem onClick={() => onConvert("circle")} aria-label={`Convert "${text}" to circle`}>
                    Convert to circle
                </MenuItem>
            ) : (
                <MenuItem onClick={() => onConvert("note")} aria-label={`Convert "${text}" to note`}>
                    Convert to note
                </MenuItem>
            )}
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
