import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { PILL_SX } from "../pillSx";
import { EXPORT_BACKGROUND } from "../../lib/exportPng";
import { TOKENS } from "../../theme/tokens";

type ExportPreviewDialogProps = {
    open: boolean;
    downloading: boolean;
    previewUrl: string | null;
    previewError: string | null;
    downloadError: string | null;
    onClose: () => void;
    onDownload: () => void;
};

export default function ExportPreviewDialog({
    open,
    downloading,
    previewUrl,
    previewError,
    downloadError,
    onClose,
    onDownload,
}: ExportPreviewDialogProps) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="export-preview-title">
            <DialogTitle id="export-preview-title">Export preview</DialogTitle>
            <DialogContent>
                {previewError ? (
                    <div data-testid="export-preview-error" role="alert">
                        Could not render preview: {previewError}
                    </div>
                ) : previewUrl ? (
                    <img
                        data-testid="export-preview-image"
                        src={previewUrl}
                        alt="Preview of the exported mind map PNG"
                        style={{ width: "100%", height: "auto", background: EXPORT_BACKGROUND, borderRadius: 8 }}
                    />
                ) : (
                    <div
                        data-testid="export-preview-placeholder"
                        style={{
                            background: EXPORT_BACKGROUND,
                            border: `1px solid ${TOKENS.border}`,
                            borderRadius: 8,
                            minHeight: 240,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: TOKENS.muted,
                        }}
                    >
                        Rendering preview...
                    </div>
                )}
            </DialogContent>
            {downloadError && (
                <div data-testid="export-download-error" role="alert" style={{ padding: "0 24px", color: TOKENS.danger }}>
                    Download failed: {downloadError} Please try again.
                </div>
            )}
            <DialogActions>
                <Button onClick={onClose} disabled={downloading} sx={PILL_SX}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={onDownload}
                    disabled={downloading || previewError !== null}
                    aria-label="Download PNG"
                    sx={PILL_SX}
                >
                    {downloading ? "Exporting..." : "Download"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
