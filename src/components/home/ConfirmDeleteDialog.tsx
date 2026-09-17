import type { Project } from "../../types/project";
import ConfirmDialog from "../dialogs";

type Props = {
    target: Project | null;
    nodeCount: number;
    onClose: () => void;
    onConfirm: () => void;
};

export default function ConfirmDeleteDialog({ target, nodeCount, onClose, onConfirm }: Props) {
    return (
        <ConfirmDialog
            open={Boolean(target)}
            title="Delete project?"
            message={target ? `Delete "${target.name}"? This will remove ${nodeCount} node(s). This cannot be undone.` : ""}
            confirmLabel="Delete"
            danger
            confirmTestId="Confirm delete"
            onCancel={onClose}
            onConfirm={onConfirm}
        />
    );
}
