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
import { TOKENS } from "../../theme/tokens";
import { PILL_SX } from "../pillSx";

export type NodeMediaTarget = { nodeId: string; text: string; media: NodeMedia | null };

export const UPLOAD_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

type NodeMediaDialogProps = {
    target: NodeMediaTarget | null;
    canUpload: boolean;
    onCancel: () => void;
    onSave: (media: NodeMedia | null) => void;
    onUploadFile: (file: File) => Promise<string | null>;
};

export default function NodeMediaDialog({ target, canUpload, onCancel, onSave, onUploadFile }: NodeMediaDialogProps) {
    const [mediaKind, setMediaKind] = useState<NodeMediaKind>(target?.media?.kind ?? "image");
    const [draft, setDraft] = useState(target?.media?.src ?? "");
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const trimmed = draft.trim();
    const error = trimmed.length === 0 ? null : validateNodeMediaPure(mediaKind, draft);
    const hasMedia = (target?.media ?? null) !== null;

    function handleSave() {
        if (error) return;
        if (trimmed.length === 0) {
            onSave(null);
            return;
        }
        onSave({ kind: mediaKind, src: draft, uploadId: null });
    }

    async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0] ?? null;
        e.target.value = "";
        if (!file) return;
        setUploading(true);
        setUploadError(null);
        const message = await onUploadFile(file);
        // On success the parent closes the dialog; on error it stays open.
        setUploading(false);
        if (message !== null) setUploadError(message);
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
                {canUpload ? (
                    <div style={{ marginTop: 8 }}>
                        <Button component="label" disabled={uploading} aria-label="Upload image file" sx={PILL_SX}>
                            {uploading ? "Uploading..." : "Upload image"}
                            <input type="file" hidden accept={UPLOAD_ACCEPT} onChange={(e) => void handlePick(e)} />
                        </Button>
                        {uploadError && (
                            <div role="alert" style={{ color: TOKENS.danger, fontSize: 12, marginTop: 4 }}>
                                {uploadError}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ color: TOKENS.muted, fontSize: 12, marginTop: 8 }}>
                        File uploads need IndexedDB storage, which is unavailable here. URL media still works.
                    </div>
                )}
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
