import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { PILL_SX } from "../pillSx";

export type NodeConvertTarget = { nodeId: string; text: string; from: "note"; to: "circle" };

type NodeConvertDialogProps = {
    target: NodeConvertTarget | null;
    onCancel: () => void;
    onConfirm: () => void;
};

export default function NodeConvertDialog({ target, onCancel, onConfirm }: NodeConvertDialogProps) {
    return (
        <Dialog open={target !== null} onClose={onCancel} maxWidth="xs" fullWidth>
            <DialogTitle>Convert to circle?</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    {target
                        ? `This note has ${target.text.trim().length} characters, but circles hold 30. Converting truncates the text to 30 characters. This cannot be undone.`
                        : ""}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel} sx={PILL_SX}>
                    Cancel
                </Button>
                <Button variant="contained" onClick={onConfirm} aria-label="Confirm convert" sx={PILL_SX}>
                    Convert
                </Button>
            </DialogActions>
        </Dialog>
    );
}
