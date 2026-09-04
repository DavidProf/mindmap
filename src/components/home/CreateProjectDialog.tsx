import { useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import { validateProjectNamePure } from "../../lib/storage";
import type { Project } from "../../types/project";
import { PILL_SX } from "./pillSx";

type Props = {
    open: boolean;
    projects: Project[];
    onClose: () => void;
    onSubmit: (name: string) => boolean;
};

export default function CreateProjectDialog({ open, projects, onClose, onSubmit }: Props) {
    const [draft, setDraft] = useState("");
    const [wasOpen, setWasOpen] = useState(open);
    if (open && !wasOpen) {
        setWasOpen(true);
        setDraft("");
    } else if (!open && wasOpen) {
        setWasOpen(false);
    }

    const error = validateProjectNamePure(draft, projects);
    const showError = error !== null && draft.length > 0;
    const helperText = showError ? error : `${draft.length}/40`;

    function handleSubmit() {
        const trimmed = draft.trim();
        if (validateProjectNamePure(trimmed, projects)) return;
        if (onSubmit(trimmed)) {
            setDraft("");
            onClose();
        }
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Create project</DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    fullWidth
                    margin="dense"
                    label="Project name"
                    placeholder="e.g. Photosynthesis"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && error === null) handleSubmit();
                    }}
                    error={showError}
                    helperText={helperText}
                    slotProps={{ htmlInput: { "aria-label": "Project name" } }}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} sx={PILL_SX}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={error !== null}
                    aria-label="Create project"
                    sx={PILL_SX}
                >
                    Create
                </Button>
            </DialogActions>
        </Dialog>
    );
}
