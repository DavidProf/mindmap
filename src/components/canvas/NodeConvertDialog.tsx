import type { NodeKind } from "../../types/node";
import ConfirmDialog from "../dialogs";

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
        <ConfirmDialog
            open={target !== null}
            title={`Convert to ${target?.to ?? ""}?`}
            message={message}
            confirmLabel="Convert"
            confirmTestId="Confirm convert"
            onCancel={onCancel}
            onConfirm={onConfirm}
        />
    );
}
