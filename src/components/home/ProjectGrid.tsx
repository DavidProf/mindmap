import type { Project } from "../../types/project";
import ProjectCard from "./ProjectCard";

type Props = {
    projects: Project[];
    allProjects?: Project[];
    openMenuId: string | null;
    renamingId: string | null;
    onOpen: (id: string) => void;
    onMenu: (e: React.MouseEvent<HTMLElement>, project: Project) => void;
    onRenameCommit: (id: string, name: string) => Promise<boolean>;
    onRenameCancel: () => void;
};

export default function ProjectGrid({ projects, allProjects, openMenuId, renamingId, onOpen, onMenu, onRenameCommit, onRenameCancel }: Props) {
    const validationPool = allProjects ?? projects;
    return (
        <div className="home-grid">
            {projects.map((p) => (
                <ProjectCard
                    key={p.id}
                    project={p}
                    projects={validationPool}
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
