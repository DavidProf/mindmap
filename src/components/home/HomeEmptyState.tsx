import { Button } from "@mui/material";
import { PILL_SX } from "./pillSx";

type Props = {
    onCreate: () => void;
};

export default function HomeEmptyState({ onCreate }: Props) {
    return (
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
            <Button variant="contained" onClick={onCreate} aria-label="Create your first project" sx={[PILL_SX, { mt: 1 }]}>
                + New project
            </Button>
        </div>
    );
}
