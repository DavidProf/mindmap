import type { Project } from "../../types/project";
import ProjectCard from "./ProjectCard";

type Props = {
    projects: Project[];
    openMenuId: string | null;
    renamingId: string | null;
    onOpen: (id: string) => void;
    onMenu: (e: React.MouseEvent<HTMLElement>, project: Project) => void;
    onRenameCommit: (id: string, name: string) => boolean;
    onRenameCancel: () => void;
};

export default function ProjectGrid({ projects, openMenuId, renamingId, onOpen, onMenu, onRenameCommit, onRenameCancel }: Props) {
    return (
        <div className="home-grid">
            {projects.map((p) => (
                <ProjectCard
                    key={p.id}
                    project={p}
                    projects={projects}
                    menuOpen={openMenuId === p.id}
                    renaming={renamingId === p.id}
                    onOpen={onOpen}
                    onMenu={onMenu}
                    onRenameCommit={onRenameCommit}
                    onRenameCancel={onRenameCancel}
                />
            ))}
        </div>
    );
}
