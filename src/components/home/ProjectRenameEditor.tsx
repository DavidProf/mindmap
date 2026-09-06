import { useEffect, useRef, useState } from "react";
import { MAX_PROJECT_NAME_LENGTH, validateProjectNamePure } from "../../lib/storage";
import type { Project } from "../../types/project";

type Props = {
    project: Project;
    projects: Project[];
    onCommit: (name: string) => boolean;
    onCancel: () => void;
};

export default function ProjectRenameEditor({ project, projects, onCommit, onCancel }: Props) {
    const [draft, setDraft] = useState(project.name);
    const inputRef = useRef<HTMLInputElement>(null);
    const doneRef = useRef(false);

    useEffect(() => {
        const input = inputRef.current;
        if (input) {
            input.focus();
            input.select();
        }
    }, []);

    const error = validateProjectNamePure(draft, projects, project.id);
    const unchanged = draft.trim() === project.name;

    function commit() {
        // Enter and blur fire together; only the first one counts.
        if (doneRef.current) return;
        doneRef.current = true;
        if ((!unchanged && error === null && onCommit(draft.trim())) || unchanged) {
            onCancel();
        } else {
            doneRef.current = false;
        }
    }

    return (
        <span className="home-card__rename" onClick={(e) => e.stopPropagation()}>
            <input
                ref={inputRef}
                className="home-card__rename-input"
                aria-label="Rename project"
                aria-invalid={error !== null}
                value={draft}
                maxLength={MAX_PROJECT_NAME_LENGTH}
                onChange={(e) => setDraft(e.target.value.slice(0, MAX_PROJECT_NAME_LENGTH))}
                onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                        e.preventDefault();
                        commit();
                    } else if (e.key === "Escape") {
                        e.preventDefault();
                        onCancel();
                    }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => {
                    if (unchanged || error !== null) onCancel();
                    else commit();
                }}
            />
            <span className={`home-card__rename-meta${error ? " home-card__rename-meta--error" : ""}`} role={error ? "alert" : undefined}>
                {error ?? `${draft.length}/${MAX_PROJECT_NAME_LENGTH}`}
            </span>
        </span>
    );
}
