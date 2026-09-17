import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

type ConfirmDialogProps = {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    confirmTestId?: string;
    onCancel: () => void;
    onConfirm: () => void;
};

export default function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel,
    danger,
    confirmTestId,
    onCancel,
    onConfirm,
}: ConfirmDialogProps) {
    return (
        <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <DialogContentText>{message}</DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>Cancel</Button>
                <Button
                    variant="contained"
                    color={danger ? "error" : "primary"}
                    onClick={onConfirm}
                    aria-label={`Confirm ${confirmLabel.toLowerCase()}`}
                    data-testid={confirmTestId}
                >
                    {confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
