import ConfirmDialog from "../dialogs";

export type NodeDeleteTarget = { nodeId: string; text: string; count: number };

type NodeDeleteDialogProps = {
    target: NodeDeleteTarget | null;
    onCancel: () => void;
    onConfirm: () => void;
};

export default function NodeDeleteDialog({ target, onCancel, onConfirm }: NodeDeleteDialogProps) {
    return (
        <ConfirmDialog
            open={target !== null}
            title="Delete branch?"
            message={
                target
                    ? `Delete "${target.text}"? This will remove ${target.count} node(s). You can undo this from the editor.`
                    : ""
            }
            confirmLabel="Delete"
            danger
            confirmTestId="Confirm delete"
            onCancel={onCancel}
            onConfirm={onConfirm}
        />
    );
}
