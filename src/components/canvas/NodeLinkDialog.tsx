import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { PILL_SX } from "../pillSx";
import { validateNodeUrlPure } from "../../storage/localStore";

export type NodeLinkTarget = { nodeId: string; text: string; url: string | null };

type NodeLinkDialogProps = {
    target: NodeLinkTarget | null;
    onCancel: () => void;
    onSave: (url: string | null) => void;
};

export default function NodeLinkDialog({ target, onCancel, onSave }: NodeLinkDialogProps) {
    const [draft, setDraft] = useState(target?.url ?? "");

    const trimmed = draft.trim();
    const error = trimmed.length === 0 ? null : validateNodeUrlPure(draft);
    const hasLink = (target?.url ?? null) !== null;

    function handleSave() {
        if (error) return;
        onSave(trimmed.length === 0 ? null : draft);
    }

    return (
        <Dialog open={target !== null} onClose={onCancel} maxWidth="xs" fullWidth>
            <DialogTitle>{hasLink ? "Edit link" : "Add link"}</DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    fullWidth
                    margin="dense"
                    label="Link URL"
                    placeholder="https://example.com"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") {
                            e.preventDefault();
                            handleSave();
                        }
                    }}
                    error={error !== null}
                    helperText={error ?? (hasLink ? "Save empty to remove the link." : "Links open in a new tab.")}
                    slotProps={{ htmlInput: { "aria-label": "Link URL", inputMode: "url", autoComplete: "url" } }}
                />
            </DialogContent>
            <DialogActions>
                {hasLink && (
                    <Button onClick={() => onSave(null)} aria-label="Remove link" sx={PILL_SX}>
                        Remove
                    </Button>
                )}
                <Button onClick={onCancel} sx={PILL_SX}>
                    Cancel
                </Button>
                <Button variant="contained" onClick={handleSave} disabled={error !== null} aria-label="Save link" sx={PILL_SX}>
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
}
