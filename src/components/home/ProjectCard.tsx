import { IconButton } from "@mui/material";
import type { Project } from "../../types/project";

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

type Props = {
    project: Project;
    menuOpen: boolean;
    onOpen: (id: string) => void;
    onMenu: (e: React.MouseEvent<HTMLElement>, project: Project) => void;
};

export default function ProjectCard({ project, menuOpen, onOpen, onMenu }: Props) {
    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(project.id);
        }
    }

    return (
        <div
            className="home-card"
            tabIndex={0}
            role="button"
            aria-label={`Open project ${project.name}`}
            onClick={() => onOpen(project.id)}
            onKeyDown={handleKeyDown}
        >
            <div className="home-card__top">
                <div className="home-card__name" title={project.name}>
                    {project.name}
                </div>
                <IconButton
                    size="small"
                    aria-label={`Actions for ${project.name}`}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    onClick={(e) => onMenu(e, project)}
                    sx={{ minWidth: 44, minHeight: 44 }}
                >
                    ⋯
                </IconButton>
            </div>
            <div className="home-card__meta">Edited {formatDate(project.updatedAt)}</div>
        </div>
    );
}
