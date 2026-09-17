import { Button } from "@mui/material";
import BrandMark from "../BrandMark";

type Props = {
    onCreate: () => void;
};

export default function HomeEmptyState({ onCreate }: Props) {
    return (
        <div className="home-empty">
            <div className="home-empty__icon" aria-hidden="true">
                <BrandMark />
            </div>
            <h2>No projects yet</h2>
            <p>Create your first mind map to get started.</p>
            <Button variant="contained" onClick={onCreate} aria-label="Create your first project" sx={{ mt: 1 }}>
                + New project
            </Button>
        </div>
    );
}
