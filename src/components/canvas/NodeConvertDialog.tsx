import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import type { NodeKind } from "../../types/node";
import { PILL_SX } from "../pillSx";

export type NodeConvertTarget = { nodeId: string; text: string; from: NodeKind; to: NodeKind };

type NodeConvertDialogProps = {
    target: NodeConvertTarget | null;
    onCancel: () => void;
    onConfirm: () => void;
};

export default function NodeConvertDialog({ target, onCancel, onConfirm }: NodeConvertDialogProps) {
    const dropsMedia = target !== null && target.from === "media";
    const truncates = target !== null && target.to === "circle" && target.text.trim().length > 30;
    const message = target
        ? dropsMedia
            ? truncates
                ? `Converting to ${target.to} removes the media on this node and truncates its ${target.text.trim().length} characters of text to 30. This cannot be undone.`
                : "Converting removes the media on this node. This cannot be undone."
            : `This note has ${target.text.trim().length} characters, but circles hold 30. Converting truncates the text to 30 characters. This cannot be undone.`
        : "";
    return (
        <Dialog open={target !== null} onClose={onCancel} maxWidth="xs" fullWidth>
            <DialogTitle>Convert to {target?.to ?? ""}?</DialogTitle>
            <DialogContent>
                <DialogContentText>{message}</DialogContentText>
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
