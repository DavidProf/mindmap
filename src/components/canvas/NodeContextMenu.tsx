import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import type { NodeKind } from "../../types/node";

export type NodeMenuState = { x: number; y: number; nodeId: string };

type NodeContextMenuProps = {
    menu: NodeMenuState | null;
    text: string;
    kind: NodeKind;
    collapsed: boolean;
    hasChildren: boolean;
    isRoot: boolean;
    onClose: () => void;
    onEdit: () => void;
    onConvert: (kind: NodeKind) => void;
    onToggleCollapse: () => void;
    onDelete: () => void;
};

export default function NodeContextMenu({
    menu,
    text,
    kind,
    collapsed,
    hasChildren,
    isRoot,
    onClose,
    onEdit,
    onConvert,
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
