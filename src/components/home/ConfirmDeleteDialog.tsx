import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";
import type { Project } from "../../types/project";
import { PILL_SX } from "./pillSx";

type Props = {
    target: Project | null;
    nodeCount: number;
    onClose: () => void;
    onConfirm: () => void;
};

export default function ConfirmDeleteDialog({ target, nodeCount, onClose, onConfirm }: Props) {
    return (
        <Dialog open={Boolean(target)} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    {target ? `Delete "${target.name}"? This will remove ${nodeCount} node(s). This cannot be undone.` : ""}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} sx={PILL_SX}>
                    Cancel
                </Button>
                <Button variant="contained" color="error" onClick={onConfirm} aria-label="Confirm delete" sx={PILL_SX}>
                    Delete
                </Button>
            </DialogActions>
        </Dialog>
    );
}
