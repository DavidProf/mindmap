import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

export type NodeDeleteTarget = { nodeId: string; text: string; count: number };

type NodeDeleteDialogProps = {
    target: NodeDeleteTarget | null;
    onCancel: () => void;
    onConfirm: () => void;
};

export default function NodeDeleteDialog({ target, onCancel, onConfirm }: NodeDeleteDialogProps) {
    return (
        <Dialog open={target !== null} onClose={onCancel} maxWidth="xs" fullWidth>
            <DialogTitle>Delete branch?</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    {target
                        ? `Delete "${target.text}"? This will remove ${target.count} node(s). This cannot be undone.`
                        : ""}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel} sx={{ borderRadius: "999px", textTransform: "none" }}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    color="error"
                    onClick={onConfirm}
                    aria-label="Confirm delete"
                    sx={{ borderRadius: "999px", textTransform: "none" }}
                >
                    Delete
                </Button>
            </DialogActions>
        </Dialog>
    );
}
