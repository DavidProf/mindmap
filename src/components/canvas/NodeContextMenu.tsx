import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

export type NodeMenuState = { x: number; y: number; nodeId: string };

type NodeContextMenuProps = {
    menu: NodeMenuState | null;
    text: string;
    collapsed: boolean;
    hasChildren: boolean;
    isRoot: boolean;
    onClose: () => void;
    onEdit: () => void;
    onToggleCollapse: () => void;
    onDelete: () => void;
};

export default function NodeContextMenu({
    menu,
    text,
    collapsed,
    hasChildren,
    isRoot,
    onClose,
    onEdit,
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
