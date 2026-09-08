import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import type { NodeMedia, NodeMediaKind } from "../../types/node";
import { isNodeMediaKind } from "../../types/node";
import { validateNodeMediaPure } from "../../storage/localStore";
import { PILL_SX } from "../pillSx";

export type NodeMediaTarget = { nodeId: string; text: string; media: NodeMedia | null };

type NodeMediaDialogProps = {
    target: NodeMediaTarget | null;
    onCancel: () => void;
    onSave: (media: NodeMedia | null) => void;
};

export default function NodeMediaDialog({ target, onCancel, onSave }: NodeMediaDialogProps) {
    const [mediaKind, setMediaKind] = useState<NodeMediaKind>(target?.media?.kind ?? "image");
    const [draft, setDraft] = useState(target?.media?.src ?? "");

    const trimmed = draft.trim();
    const error = trimmed.length === 0 ? null : validateNodeMediaPure(mediaKind, draft);
    const hasMedia = (target?.media ?? null) !== null;

    function handleSave() {
        if (error) return;
        if (trimmed.length === 0) {
            onSave(null);
            return;
        }
        onSave({ kind: mediaKind, src: draft });
    }

    return (
        <Dialog open={target !== null} onClose={onCancel} maxWidth="xs" fullWidth>
            <DialogTitle>{hasMedia ? "Edit media" : "Add media"}</DialogTitle>
            <DialogContent>
                <TextField
                    select
                    fullWidth
                    margin="dense"
                    label="Media type"
                    value={mediaKind}
                    onChange={(e) => {
                        const next = e.target.value;
                        if (isNodeMediaKind(next)) setMediaKind(next);
                    }}
                    slotProps={{ htmlInput: { "aria-label": "Media type" } }}
                >
                    <MenuItem value="image">Image</MenuItem>
                    <MenuItem value="video">Video</MenuItem>
                </TextField>
                <TextField
                    autoFocus
                    fullWidth
                    margin="dense"
                    label="Media URL"
                    placeholder="https://example.com/photo.png"
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
                    helperText={error ?? (hasMedia ? "Save empty to remove the media." : "Media opens in a new tab.")}
                    slotProps={{ htmlInput: { "aria-label": "Media URL", inputMode: "url", autoComplete: "url" } }}
                />
            </DialogContent>
            <DialogActions>
                {hasMedia && (
                    <Button onClick={() => onSave(null)} aria-label="Remove media" sx={PILL_SX}>
                        Remove
                    </Button>
                )}
                <Button onClick={onCancel} sx={PILL_SX}>
                    Cancel
                </Button>
                <Button variant="contained" onClick={handleSave} disabled={error !== null} aria-label="Save media" sx={PILL_SX}>
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
}
