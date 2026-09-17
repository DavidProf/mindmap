import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, FormControl, IconButton, InputLabel, MenuItem, Select, Snackbar, TextField } from "@mui/material";
import AppHeader from "../components/layout/AppHeader";
import ConfirmDeleteDialog from "../components/home/ConfirmDeleteDialog";
import CreateProjectDialog from "../components/home/CreateProjectDialog";
import HomeEmptyState from "../components/home/HomeEmptyState";
import ProjectGrid from "../components/home/ProjectGrid";
import ProjectMenu from "../components/home/ProjectMenu";
import { PROJECT_IMPORT_MAX_BYTES, filterProjectsPure, hasUploadMedia, parseProjectImportPure, sanitizeExportFilenamePure, serializeProjectExportPure, sortProjectsPure, type HomeSortDir, type HomeSortKey } from "../lib/projectHome";
import { consumeCorruptionFlag, validateProjectNamePure } from "../storage/localStore";
import { initStorage, type StorageFallback } from "../storage/init";
import {
    createProjectAsync,
    deleteProjectAsync,
    duplicateProjectAsync,
    getNodeCountForProjectAsync,
    getProjectsSortedByUpdatedAtAsync,
    importProjectAsync,
    renameProjectAsync,
} from "../storage/operations";
import type { StorageBackend } from "../storage/backend";
import { createIdbMediaBlobStore } from "../storage/mediaBlobs";
import { toUserError } from "../lib/errors";
import type { Project } from "../types/project";
import "./HomePage.css";

export default function HomePage() {
    const navigate = useNavigate();
    const [backend, setBackend] = useState<StorageBackend | null>(null);
    const [fallback, setFallback] = useState<StorageFallback | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [corruptionWarning, setCorruptionWarning] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [menuProject, setMenuProject] = useState<Project | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
    const [deleteNodeCount, setDeleteNodeCount] = useState(0);
    const [quotaError, setQuotaError] = useState<string | null>(null);
    const [exportNotice, setExportNotice] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [sortKey, setSortKey] = useState<HomeSortKey>("updated");
    const [sortDir, setSortDir] = useState<HomeSortDir>("desc");
    const [blobStore] = useState(() => createIdbMediaBlobStore());
    const importInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        let cancelled = false;
        initStorage()
            .then((res) => {
                if (cancelled) return;
                setBackend(res.backend);
                setFallback(res.fallback);
                setCorruptionWarning(consumeCorruptionFlag());
                return getProjectsSortedByUpdatedAtAsync(res.backend).then((sorted) => {
                    if (!cancelled) setProjects(sorted);
                });
            })
            .catch(() => undefined)
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    async function refresh(b: StorageBackend) {
        setProjects(await getProjectsSortedByUpdatedAtAsync(b));
    }

    async function handleCreate(name: string): Promise<boolean> {
        if (!backend) return false;
        const err = validateProjectNamePure(name, projects);
        if (err) return false;
        try {
            await createProjectAsync(backend, name);
            await refresh(backend);
            return true;
        } catch (e) {
            setQuotaError(toUserError(e, "Failed to create project."));
            return false;
        }
    }

    function openCreate() {
        setCreateOpen(true);
    }

    function openRename(p: Project) {
        setRenamingId(p.id);
    }

    async function handleRenameCommit(id: string, name: string): Promise<boolean> {
        if (!backend) return false;
        const err = validateProjectNamePure(name, projects, id);
        if (err) return false;
        try {
            await renameProjectAsync(backend, id, name);
            await refresh(backend);
            setRenamingId(null);
            return true;
        } catch (e) {
            setQuotaError(toUserError(e, "Failed to rename project."));
            return false;
        }
    }

    async function handleDelete() {
        if (!deleteTarget || !backend) return;
        try {
            await deleteProjectAsync(backend, deleteTarget.id, blobStore);
            await refresh(backend);
            setDeleteTarget(null);
        } catch (e) {
            setQuotaError(toUserError(e, "Failed to delete project."));
        }
    }

    async function handleDuplicate(p: Project) {
        if (!backend) return;
        try {
            await duplicateProjectAsync(backend, p.id, blobStore);
            await refresh(backend);
        } catch (e) {
            setQuotaError(toUserError(e, "Failed to duplicate project."));
        }
    }

    async function handleExport(p: Project) {
        if (!backend) return;
        try {
            const nodes = (await backend.loadNodes()).filter((n) => n.projectId === p.id);
            const file = serializeProjectExportPure(p, nodes);
            const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = sanitizeExportFilenamePure(p.name);
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            if (hasUploadMedia(nodes)) {
                setExportNotice("Uploaded image bytes are not included in JSON export; those nodes import as text.");
            }
        } catch (e) {
            setQuotaError(toUserError(e, "Failed to export project."));
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

    async function openDelete(p: Project) {
        if (!backend) return;
        setDeleteNodeCount(await getNodeCountForProjectAsync(backend, p.id));
        setDeleteTarget(p);
    }

    async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file || !backend) return;
        if (file.size > PROJECT_IMPORT_MAX_BYTES) {
            setQuotaError("Not a valid mindmap file: file is larger than 10MB.");
            return;
        }
        try {
            const text = await file.text();
            const parsed = parseProjectImportPure(text);
            await importProjectAsync(backend, parsed);
            setQuery("");
            await refresh(backend);
        } catch (err) {
            setQuotaError(err instanceof Error ? err.message : "Failed to import project.");
        }
    }

    function navigateToProject(id: string) {
        navigate(`/project/${id}`);
    }

    const isEmpty = projects.length === 0;
    const filtering = query.trim().length > 0;
    const visibleProjects = sortProjectsPure(filterProjectsPure(projects, query), sortKey, sortDir);

    return (
        <>
            <AppHeader variant="home" />
            <main className="home-wrap">
                <div className="home-title-row">
                    <div>
                        <h1>Your projects</h1>
                        <p>Local to this browser</p>
                    </div>
                    <div className="home-title-actions">
                        <Button variant="outlined" size="small" onClick={() => importInputRef.current?.click()} aria-label="Import project from JSON">
                            Import
                        </Button>
                        {!isEmpty && (
                            <Button variant="contained" size="small" onClick={openCreate} aria-label="New project">
                                + New project
                            </Button>
                        )}
                    </div>
                    <input
                        ref={importInputRef}
                        type="file"
                        accept=".json,application/json"
                        hidden
                        aria-hidden="true"
                        tabIndex={-1}
                        onChange={handleImportFile}
                    />
                </div>

                {fallback === "localstorage" && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        Using local fallback storage — changes are saved in this browser only.
                    </Alert>
                )}

                {fallback === "memory" && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        Storage unavailable — changes won&apos;t persist after reload.
                    </Alert>
                )}

                {corruptionWarning && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        Stored data was corrupted and was reset.
                    </Alert>
                )}

                {loading ? (
                    <p>Loading projects…</p>
                ) : isEmpty ? (
                    <HomeEmptyState onCreate={openCreate} />
                ) : (
                    <>
                        <div className="home-controls">
                            <TextField
                                size="small"
                                label="Search projects"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search by name"
                                sx={{ minWidth: 200, flex: 1 }}
                            />
                            <div className="home-sort-group">
                                <FormControl
                                    size="small"
                                    sx={{
                                        minWidth: 140,
                                        "& .MuiOutlinedInput-root": { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
                                        "& .MuiOutlinedInput-notchedOutline": { borderRight: "none" },
                                    }}
                                >
                                    <InputLabel id="home-sort-label">Sort</InputLabel>
                                    <Select
                                        labelId="home-sort-label"
                                        label="Sort"
                                        value={sortKey}
                                        onChange={(e) => setSortKey(e.target.value as HomeSortKey)}
                                    >
                                        <MenuItem value="updated">Last updated</MenuItem>
                                        <MenuItem value="created">Date created</MenuItem>
                                        <MenuItem value="name">Name</MenuItem>
                                    </Select>
                                </FormControl>
                                <IconButton
                                    aria-label="Toggle sort direction"
                                    onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                                    sx={{
                                        minWidth: 76,
                                        alignSelf: "stretch",
                                        height: "auto",
                                        border: 1,
                                        borderLeft: 1,
                                        borderColor: (theme) =>
                                            theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.23)" : "rgba(0, 0, 0, 0.23)",
                                        borderRadius: (theme) => `0 ${theme.shape.borderRadius}px ${theme.shape.borderRadius}px 0`,
                                        color: "text.secondary",
                                        fontSize: 13,
                                        gap: "4px",
                                        "&:hover": {
                                            borderColor: "text.primary",
                                        },
                                    }}
                                >
                                    <span style={{ display: "inline-block", lineHeight: 1, transform: "translateY(-1px)" }}>
                                        {sortDir === "asc" ? "↑" : "↓"}
                                    </span>
                                    {sortDir === "asc" ? "Asc" : "Desc"}
                                </IconButton>
                            </div>
                        </div>
                        {filtering && (
                            <p className="home-count" aria-live="polite">
                                {visibleProjects.length} of {projects.length} projects
                            </p>
                        )}
                        {visibleProjects.length === 0 ? (
                            <div className="home-filtered-empty">
                                <p>No projects match &ldquo;{query.trim()}&rdquo;.</p>
                                <Button variant="outlined" size="small" onClick={() => setQuery("")}>
                                    Clear search
                                </Button>
                            </div>
                        ) : (
                            <ProjectGrid
                                projects={visibleProjects}
                                allProjects={projects}
                                openMenuId={menuAnchor ? (menuProject?.id ?? null) : null}
                                renamingId={renamingId}
                                onOpen={navigateToProject}
                                onMenu={openMenu}
                                onRenameCommit={handleRenameCommit}
                                onRenameCancel={() => setRenamingId(null)}
                            />
                        )}
                    </>
                )}

                <ProjectMenu
                    anchor={menuAnchor}
                    project={menuProject}
                    onClose={closeMenu}
                    onOpen={navigateToProject}
                    onRename={openRename}
                    onDuplicate={handleDuplicate}
                    onExport={handleExport}
                    onDelete={openDelete}
                />

                <CreateProjectDialog
                    open={createOpen}
                    projects={projects}
                    onClose={() => setCreateOpen(false)}
                    onSubmit={handleCreate}
                />

                <ConfirmDeleteDialog
                    target={deleteTarget}
                    nodeCount={deleteNodeCount}
                    onClose={() => setDeleteTarget(null)}
                    onConfirm={handleDelete}
                />

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
                <Snackbar
                    open={Boolean(exportNotice)}
                    autoHideDuration={6000}
                    onClose={() => setExportNotice(null)}
                    anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                >
                    <Alert severity="info" onClose={() => setExportNotice(null)} variant="filled">
                        {exportNotice}
                    </Alert>
                </Snackbar>
            </main>
        </>
    );
}
