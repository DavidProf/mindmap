import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    IconButton,
    Menu,
    MenuItem,
    Snackbar,
    TextField,
} from "@mui/material";
import AppHeader from "../components/layout/AppHeader";
import {
    consumeCorruptionFlag,
    createProject,
    deleteProject,
    getNodeCountForProject,
    getProjectsSortedByUpdatedAt,
    isStorageAvailable,
    renameProject,
    validateProjectNamePure,
} from "../lib/storage";
import type { Project } from "../types/project";
import "./HomePage.css";

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    } catch {
        return iso;
    }
}

export default function HomePage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>(() => getProjectsSortedByUpdatedAt());
    const [storageWarning] = useState(() => !isStorageAvailable());
    const [corruptionWarning] = useState(() => consumeCorruptionFlag());
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [menuProject, setMenuProject] = useState<Project | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [draftName, setDraftName] = useState("");
    const [renameOpen, setRenameOpen] = useState(false);
    const [renameTarget, setRenameTarget] = useState<Project | null>(null);
    const [renameDraft, setRenameDraft] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
    const [deleteNodeCount, setDeleteNodeCount] = useState(0);
    const [quotaError, setQuotaError] = useState<string | null>(null);

    const validationError = validateProjectNamePure(draftName, projects);
    const showError = validationError !== null && draftName.length > 0;
    const helperText = showError ? validationError : `${draftName.length}/40`;
    const isCreateDisabled = validationError !== null;

    const renameError = renameTarget ? validateProjectNamePure(renameDraft, projects, renameTarget.id) : null;
    const showRenameError = renameError !== null && renameDraft.length > 0;
    const renameHelper = showRenameError ? renameError : `${renameDraft.length}/40`;
    const isRenameDisabled = renameError !== null;

    function openCreate() {
        setDraftName("");
        setCreateOpen(true);
    }

    function closeCreate() {
        setCreateOpen(false);
        setDraftName("");
    }

    function handleCreate() {
        const trimmed = draftName.trim();
        const err = validateProjectNamePure(trimmed, projects);
        if (err) return;
        try {
            createProject(trimmed);
            setProjects(getProjectsSortedByUpdatedAt());
            closeCreate();
        } catch (e) {
            const errObj = e as DOMException;
            if (errObj.name === "QuotaExceededError" || errObj.name === "NS_ERROR_DOM_QUOTA_REACHED") {
                setQuotaError("Storage full — delete a project or clear data.");
            } else if (e instanceof Error) {
                setQuotaError(e.message);
            } else {
                setQuotaError("Failed to create project.");
            }
        }
    }

    function openRename(p: Project) {
        setRenameTarget(p);
        setRenameDraft(p.name);
        setRenameOpen(true);
    }

    function closeRename() {
        setRenameOpen(false);
        setRenameTarget(null);
        setRenameDraft("");
    }

    function handleRename() {
        if (!renameTarget) return;
        const trimmed = renameDraft.trim();
        const err = validateProjectNamePure(trimmed, projects, renameTarget.id);
        if (err) return;
        try {
            renameProject(renameTarget.id, trimmed);
            setProjects(getProjectsSortedByUpdatedAt());
            closeRename();
        } catch (e) {
            if (e instanceof Error) setQuotaError(e.message);
            else setQuotaError("Failed to rename project.");
        }
    }

    function handleDelete() {
        if (!deleteTarget) return;
        try {
            deleteProject(deleteTarget.id);
            setProjects(getProjectsSortedByUpdatedAt());
            setDeleteTarget(null);
        } catch (e) {
            if (e instanceof Error) setQuotaError(e.message);
            else setQuotaError("Failed to delete project.");
        }
    }

    function openMenu(e: React.MouseEvent<HTMLElement>, p: Project) {
        e.stopPropagation();
        setMenuAnchor(e.currentTarget);
        setMenuProject(p);
    }

    function closeMenu() {
        setMenuAnchor(null);
        setMenuProject(null);
    }

    function openDelete(p: Project) {
        setDeleteNodeCount(getNodeCountForProject(p.id));
        setDeleteTarget(p);
    }

    function navigateToProject(id: string) {
        navigate(`/project/${id}`);
    }

    const isEmpty = projects.length === 0;

    return (
        <>
            <AppHeader variant="home" />
            <main className="home-wrap">
                <div className="home-title-row">
                    <div>
                        <h1>Your projects</h1>
                        <p>Local to this browser · sorted newest first</p>
                    </div>
                    {!isEmpty && (
                        <Button
                            variant="contained"
                            size="small"
                            onClick={openCreate}
                            aria-label="New project"
                            sx={{ borderRadius: "999px", textTransform: "none" }}
                        >
                            + New project
                        </Button>
                    )}
                </div>

                {storageWarning && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        Storage unavailable — changes won&apos;t persist after reload.
                    </Alert>
                )}

                {corruptionWarning && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        Stored data was corrupted and was reset.
                    </Alert>
                )}

                {isEmpty ? (
                    <div className="home-empty">
                        <div className="home-empty__icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                                <circle cx="12" cy="12" r="3.5" />
                                <circle cx="6" cy="7" r="2" />
                                <circle cx="18" cy="7" r="2" />
                                <circle cx="6" cy="17" r="2" />
                                <circle cx="18" cy="17" r="2" />
                                <path d="M9 10.2L12 12M12 12l2.9-1.8M12 12l-3 3.2M12 12l3 3.2" />
                            </svg>
                        </div>
                        <h2>No projects yet</h2>
                        <p>Create your first mind map to get started.</p>
                        <Button
                            variant="contained"
                            onClick={openCreate}
                            aria-label="Create your first project"
                            sx={{ borderRadius: "999px", textTransform: "none", mt: 1 }}
                        >
                            + New project
                        </Button>
                    </div>
                ) : (
                    <div className="home-grid">
                        {projects.map((p) => (
                            <div
                                key={p.id}
                                className="home-card"
                                tabIndex={0}
                                role="button"
                                aria-label={`Open project ${p.name}`}
                                onClick={() => navigateToProject(p.id)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        navigateToProject(p.id);
                                    }
                                }}
                            >
                                <div className="home-card__top">
                                    <div className="home-card__name" title={p.name}>
                                        {p.name}
                                    </div>
                                    <IconButton
                                        size="small"
                                        aria-label={`Actions for ${p.name}`}
                                        aria-haspopup="menu"
                                        aria-expanded={Boolean(menuAnchor && menuProject?.id === p.id)}
                                        onClick={(e) => openMenu(e, p)}
                                        sx={{ minWidth: 44, minHeight: 44 }}
                                    >
                                        ⋯
                                    </IconButton>
                                </div>
                                <div className="home-card__meta">Edited {formatDate(p.updatedAt)}</div>
                            </div>
                        ))}
                    </div>
                )}

                <Menu
                    anchorEl={menuAnchor}
                    open={Boolean(menuAnchor)}
                    onClose={closeMenu}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                >
                    <MenuItem
                        onClick={() => {
                            const p = menuProject;
                            closeMenu();
                            if (p) navigateToProject(p.id);
                        }}
                    >
                        Open
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            const p = menuProject;
                            closeMenu();
                            if (p) openRename(p);
                        }}
                    >
                        Rename
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            const p = menuProject;
                            closeMenu();
                            if (p) openDelete(p);
                        }}
                        sx={{ color: "var(--danger)" }}
                    >
                        Delete
                    </MenuItem>
                </Menu>

                <Dialog open={createOpen} onClose={closeCreate} maxWidth="xs" fullWidth>
                    <DialogTitle>Create project</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            fullWidth
                            margin="dense"
                            label="Project name"
                            placeholder="e.g. Photosynthesis"
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !isCreateDisabled) handleCreate();
                            }}
                            error={showError}
                            helperText={helperText}
                            slotProps={{ htmlInput: { "aria-label": "Project name" } }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={closeCreate} sx={{ borderRadius: "999px", textTransform: "none" }}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleCreate}
                            disabled={isCreateDisabled}
                            aria-label="Create project"
                            sx={{ borderRadius: "999px", textTransform: "none" }}
                        >
                            Create
                        </Button>
                    </DialogActions>
                </Dialog>

                <Dialog open={renameOpen} onClose={closeRename} maxWidth="xs" fullWidth>
                    <DialogTitle>Rename project</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            fullWidth
                            margin="dense"
                            label="Project name"
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !isRenameDisabled) handleRename();
                            }}
                            error={showRenameError}
                            helperText={renameHelper}
                            slotProps={{ htmlInput: { "aria-label": "New project name" } }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={closeRename} sx={{ borderRadius: "999px", textTransform: "none" }}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleRename}
                            disabled={isRenameDisabled}
                            aria-label="Save rename"
                            sx={{ borderRadius: "999px", textTransform: "none" }}
                        >
                            Save
                        </Button>
                    </DialogActions>
                </Dialog>

                <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
                    <DialogTitle>Delete project?</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            {deleteTarget
                                ? `Delete "${deleteTarget.name}"? This will remove ${deleteNodeCount} node(s). This cannot be undone.`
                                : ""}
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleteTarget(null)} sx={{ borderRadius: "999px", textTransform: "none" }}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            color="error"
                            onClick={handleDelete}
                            aria-label="Confirm delete"
                            sx={{ borderRadius: "999px", textTransform: "none" }}
                        >
                            Delete
                        </Button>
                    </DialogActions>
                </Dialog>

                <Snackbar
                    open={Boolean(quotaError)}
                    autoHideDuration={4000}
                    onClose={() => setQuotaError(null)}
                    anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                >
                    <Alert severity="error" onClose={() => setQuotaError(null)} variant="filled">
                        {quotaError}
                    </Alert>
                </Snackbar>
            </main>
        </>
    );
}
