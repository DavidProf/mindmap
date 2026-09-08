import { useEffect, useState } from "react";
import NodeMediaGlyph from "./NodeMediaGlyph";

type NodeUploadedImageProps = {
    uploadId: string;
    loadBlob: (uploadId: string) => Promise<Blob | null>;
};

export default function NodeUploadedImage({ uploadId, loadBlob }: NodeUploadedImageProps) {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let url: string | null = null;
        loadBlob(uploadId)
            .then((blob) => {
                if (cancelled || !blob) return;
                url = URL.createObjectURL(blob);
                if (!cancelled) setObjectUrl(url);
                else URL.revokeObjectURL(url);
            })
            .catch(() => {
                if (!cancelled) setObjectUrl(null);
            });
        return () => {
            cancelled = true;
            if (url) URL.revokeObjectURL(url);
        };
    }, [uploadId, loadBlob]);

    return (
        <span className="node-rect__media" aria-hidden="true">
            {objectUrl ? (
                <img
                    className="node-rect__img"
                    src={objectUrl}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    onError={() => setObjectUrl(null)}
                />
            ) : (
                <span className="node-rect__placeholder">
                    <NodeMediaGlyph kind="image" size={16} />
                </span>
            )}
        </span>
    );
}
