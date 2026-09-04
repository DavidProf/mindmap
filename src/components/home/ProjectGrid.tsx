import type { Project } from "../../types/project";
import ProjectCard from "./ProjectCard";

type Props = {
    projects: Project[];
    openMenuId: string | null;
    onOpen: (id: string) => void;
    onMenu: (e: React.MouseEvent<HTMLElement>, project: Project) => void;
};

export default function ProjectGrid({ projects, openMenuId, onOpen, onMenu }: Props) {
    return (
        <div className="home-grid">
            {projects.map((p) => (
                <ProjectCard key={p.id} project={p} menuOpen={openMenuId === p.id} onOpen={onOpen} onMenu={onMenu} />
            ))}
        </div>
    );
}
