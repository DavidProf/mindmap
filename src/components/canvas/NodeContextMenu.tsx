import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { NodeKind, NodeSize } from "../../types/node";
import { NODE_SIZES } from "../../types/node";
import { NODE_SIZE_LABELS } from "../../lib/layout";
import NodeMediaGlyph from "./NodeMediaGlyph";

function PencilIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M11.5 2.5a1.4 1.4 0 0 1 2 2L6 12l-2.7.7L4 10l7.5-7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
    );
}

function LinkIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6.5 9.5 9.5 6.5M7 4.5 8.8 2.7a2.4 2.4 0 0 1 3.4 3.4L10.5 8M9 11.5 7.2 13.3a2.4 2.4 0 0 1-3.4-3.4L5.5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
    );
}

// Convert targets are the non-media kinds; the media icon on a non-media node
// starts the attach flow instead, since media is arrived at, not converted to.
const CONVERT_TARGETS: readonly NodeKind[] = ["circle", "note"];

function CircleKindIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
        </svg>
    );
}

function NoteKindIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
            <path d="M4.5 6.5h7M4.5 9.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
    );
}

function MediaKindIcon() {
    return <NodeMediaGlyph kind="image" size={18} />;
}

export type NodeMenuState = { x: number; y: number; nodeId: string };

type NodeContextMenuProps = {
    menu: NodeMenuState | null;
    text: string;
    kind: NodeKind;
    url: string | null;
    size: NodeSize;
    collapsed: boolean;
    hasChildren: boolean;
    isRoot: boolean;
    onClose: () => void;
    onEdit: () => void;
    onConvert: (kind: NodeKind) => void;
    onEditLink: () => void;
    onEditMedia: () => void;
    onSetSize: (size: NodeSize) => void;
    onToggleCollapse: () => void;
    onDelete: () => void;
};

export default function NodeContextMenu({
    menu,
    text,
    kind,
    url,
    size,
    collapsed,
    hasChildren,
    isRoot,
    onClose,
    onEdit,
    onConvert,
    onEditLink,
    onEditMedia,
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
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    px: 2,
                    py: 0.75,
                    borderBottom: "1px solid var(--faint)",
                    mb: 0.5,
                }}
                role="group"
                aria-label={`Edit actions for "${text}"`}
            >
                <Tooltip title="Edit">
                    <Box
                        component="button"
                        type="button"
                        onClick={onEdit}
                        aria-label={`Edit "${text}"`}
                        sx={{
                            minWidth: 40,
                            minHeight: 40,
                            display: "grid",
                            placeItems: "center",
                            borderRadius: "8px",
                            border: "1px solid var(--faint)",
                            background: "transparent",
                            color: "var(--text)",
                            cursor: "pointer",
                        }}
                    >
                        <PencilIcon />
                    </Box>
                </Tooltip>
                <Tooltip title={url ? "Edit link" : "Add link"}>
                    <Box
                        component="button"
                        type="button"
                        onClick={onEditLink}
                        aria-label={`${url ? "Edit link" : "Add link"} for "${text}"`}
                        sx={{
                            minWidth: 40,
                            minHeight: 40,
                            display: "grid",
                            placeItems: "center",
                            borderRadius: "8px",
                            border: "1px solid var(--faint)",
                            background: url ? "var(--accent-soft, var(--surface))" : "transparent",
                            color: url ? "var(--accent)" : "var(--text)",
                            cursor: "pointer",
                        }}
                    >
                        <LinkIcon />
                    </Box>
                </Tooltip>
            </Box>
            {kind !== "circle" && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        px: 2,
                        py: 0.5,
                    }}
                    role="group"
                    aria-label={`Node size for "${text}"`}
                >
                    <Typography variant="body2" sx={{ color: "var(--muted)", mr: 0.5 }}>
                        Size
                    </Typography>
                    {NODE_SIZES.map((s) => (
                        <Box
                            key={s}
                            component="button"
                            type="button"
                            onClick={() => onSetSize(s)}
                            role="menuitemradio"
                            aria-checked={size === s}
                            aria-label={`Set node size ${s} for "${text}"`}
                            sx={{
                                minWidth: 36,
                                minHeight: 36,
                                px: 1,
                                borderRadius: "8px",
                                border: "1px solid var(--faint)",
                                background: size === s ? "var(--accent-soft, var(--surface))" : "transparent",
                                color: size === s ? "var(--accent)" : "var(--text)",
                                fontWeight: size === s ? 700 : 400,
                                fontSize: 13,
                                cursor: "pointer",
                            }}
                        >
                            {NODE_SIZE_LABELS[s]}
                        </Box>
                    ))}
                </Box>
            )}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    px: 2,
                    py: 0.5,
                    borderTop: "1px solid var(--faint)",
                    borderBottom: "1px solid var(--faint)",
                    mt: 0.5,
                    mb: 0.5,
                }}
                role="group"
                aria-label={`Convert "${text}"`}
            >
                <Typography variant="body2" sx={{ color: "var(--muted)", mr: 0.5 }}>
                    Convert
                </Typography>
                {CONVERT_TARGETS.filter((t) => t !== kind).map((t) => (
                    <Tooltip key={t} title={`Convert to ${t}`}>
                        <Box
                            component="button"
                            type="button"
                            onClick={() => onConvert(t)}
                            aria-label={`Convert "${text}" to ${t}`}
                            sx={{
                                minWidth: 40,
                                minHeight: 40,
                                display: "grid",
                                placeItems: "center",
                                borderRadius: "8px",
                                border: "1px solid var(--faint)",
                                background: "transparent",
                                color: "var(--text)",
                                cursor: "pointer",
                            }}
                        >
                            {t === "circle" ? <CircleKindIcon /> : <NoteKindIcon />}
                        </Box>
                    </Tooltip>
                ))}
                {kind !== "media" && (
                    <Tooltip title="Add media">
                        <Box
                            component="button"
                            type="button"
                            onClick={onEditMedia}
                            aria-label={`Add media to "${text}"`}
                            sx={{
                                minWidth: 40,
                                minHeight: 40,
                                display: "grid",
                                placeItems: "center",
                                borderRadius: "8px",
                                border: "1px solid var(--faint)",
                                background: "transparent",
                                color: "var(--text)",
                                cursor: "pointer",
                            }}
                        >
                            <MediaKindIcon />
                        </Box>
                    </Tooltip>
                )}
            </Box>
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
