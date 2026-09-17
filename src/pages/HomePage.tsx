import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Snackbar } from "@mui/material";
import AppHeader from "../components/layout/AppHeader";
import ConfirmDeleteDialog from "../components/home/ConfirmDeleteDialog";
import CreateProjectDialog from "../components/home/CreateProjectDialog";
import HomeEmptyState from "../components/home/HomeEmptyState";
import ProjectGrid from "../components/home/ProjectGrid";
import ProjectMenu from "../components/home/ProjectMenu";
import { consumeCorruptionFlag, validateProjectNamePure } from "../storage/localStore";
import { initStorage, type StorageFallback } from "../storage/init";
import {
    createProjectAsync,
    deleteProjectAsync,
    getNodeCountForProjectAsync,
    getProjectsSortedByUpdatedAtAsync,
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
    const [blobStore] = useState(() => createIdbMediaBlobStore());

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
                        <Button variant="contained" size="small" onClick={openCreate} aria-label="New project">
                            + New project
                        </Button>
                    )}
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
                    <ProjectGrid
                        projects={projects}
                        openMenuId={menuAnchor ? (menuProject?.id ?? null) : null}
                        renamingId={renamingId}
                        onOpen={navigateToProject}
                        onMenu={openMenu}
                        onRenameCommit={handleRenameCommit}
                        onRenameCancel={() => setRenamingId(null)}
                    />
                )}

                <ProjectMenu
                    anchor={menuAnchor}
                    project={menuProject}
                    onClose={closeMenu}
                    onOpen={navigateToProject}
                    onRename={openRename}
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
            </main>
        </>
    );
}
