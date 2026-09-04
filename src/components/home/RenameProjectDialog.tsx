import { useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import { validateProjectNamePure } from "../../lib/storage";
import type { Project } from "../../types/project";
import { PILL_SX } from "../pillSx";

type Props = {
    open: boolean;
    projects: Project[];
    initialName: string;
    excludeId: string | null;
    onClose: () => void;
    onSubmit: (name: string) => boolean;
};

export default function RenameProjectDialog({ open, projects, initialName, excludeId, onClose, onSubmit }: Props) {
    const [draft, setDraft] = useState(initialName);
    const [wasOpen, setWasOpen] = useState(open);
    if (open && !wasOpen) {
        setWasOpen(true);
        setDraft(initialName);
    } else if (!open && wasOpen) {
        setWasOpen(false);
    }

    const error = validateProjectNamePure(draft, projects, excludeId ?? undefined);
    const showError = error !== null && draft.length > 0;
    const helperText = showError ? error : `${draft.length}/40`;

    function handleSubmit() {
        const trimmed = draft.trim();
        if (validateProjectNamePure(trimmed, projects, excludeId ?? undefined)) return;
        if (onSubmit(trimmed)) {
            onClose();
        }
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Rename project</DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    fullWidth
                    margin="dense"
                    label="Project name"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && error === null) handleSubmit();
                    }}
                    error={showError}
                    helperText={helperText}
                    slotProps={{ htmlInput: { "aria-label": "New project name" } }}
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
                    aria-label="Save rename"
                    sx={PILL_SX}
                >
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
}
