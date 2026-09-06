import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Snackbar } from "@mui/material";
import AppHeader from "../components/layout/AppHeader";
import ConfirmDeleteDialog from "../components/home/ConfirmDeleteDialog";
import CreateProjectDialog from "../components/home/CreateProjectDialog";
import HomeEmptyState from "../components/home/HomeEmptyState";
import ProjectGrid from "../components/home/ProjectGrid";
import ProjectMenu from "../components/home/ProjectMenu";
import { PILL_SX } from "../components/pillSx";
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

export default function HomePage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>(() => getProjectsSortedByUpdatedAt());
    const [storageWarning] = useState(() => !isStorageAvailable());
    const [corruptionWarning] = useState(() => consumeCorruptionFlag());
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [menuProject, setMenuProject] = useState<Project | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
    const [deleteNodeCount, setDeleteNodeCount] = useState(0);
    const [quotaError, setQuotaError] = useState<string | null>(null);

    function handleCreate(name: string): boolean {
        const err = validateProjectNamePure(name, projects);
        if (err) return false;
        try {
            createProject(name);
            setProjects(getProjectsSortedByUpdatedAt());
            return true;
        } catch (e) {
            const errObj = e as DOMException;
            if (errObj.name === "QuotaExceededError" || errObj.name === "NS_ERROR_DOM_QUOTA_REACHED") {
                setQuotaError("Storage full — delete a project or clear data.");
            } else if (e instanceof Error) {
                setQuotaError(e.message);
            } else {
                setQuotaError("Failed to create project.");
            }
            return false;
        }
    }

    function openCreate() {
        setCreateOpen(true);
    }

    function openRename(p: Project) {
        setRenamingId(p.id);
    }

    function handleRenameCommit(id: string, name: string): boolean {
        const err = validateProjectNamePure(name, projects, id);
        if (err) return false;
        try {
            renameProject(id, name);
            setProjects(getProjectsSortedByUpdatedAt());
            setRenamingId(null);
            return true;
        } catch (e) {
            if (e instanceof Error) setQuotaError(e.message);
            else setQuotaError("Failed to rename project.");
            return false;
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
                        <Button variant="contained" size="small" onClick={openCreate} aria-label="New project" sx={PILL_SX}>
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
