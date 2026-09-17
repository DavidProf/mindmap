import { Menu, MenuItem } from "@mui/material";
import type { Project } from "../../types/project";

type Props = {
    anchor: HTMLElement | null;
    project: Project | null;
    onClose: () => void;
    onOpen: (id: string) => void;
    onRename: (project: Project) => void;
    onDuplicate: (project: Project) => void;
    onExport: (project: Project) => void;
    onDelete: (project: Project) => void;
};

export default function ProjectMenu({ anchor, project, onClose, onOpen, onRename, onDuplicate, onExport, onDelete }: Props) {
    return (
        <Menu
            anchorEl={anchor}
            open={Boolean(anchor)}
            onClose={onClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
            <MenuItem
                onClick={() => {
                    const p = project;
                    onClose();
                    if (p) onOpen(p.id);
                }}
            >
                Open
            </MenuItem>
            <MenuItem
                onClick={() => {
                    const p = project;
                    onClose();
                    if (p) onRename(p);
                }}
            >
                Rename
            </MenuItem>
            <MenuItem
                onClick={() => {
                    const p = project;
                    onClose();
                    if (p) onDuplicate(p);
                }}
            >
                Duplicate
            </MenuItem>
            <MenuItem
                onClick={() => {
                    const p = project;
                    onClose();
                    if (p) onExport(p);
                }}
            >
                Export JSON
            </MenuItem>
            <MenuItem
                onClick={() => {
                    const p = project;
                    onClose();
                    if (p) onDelete(p);
                }}
                sx={{ color: "var(--danger)" }}
            >
                Delete
            </MenuItem>
        </Menu>
    );
}
