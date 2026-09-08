type NodeLinkBadgeProps = {
    text: string;
    url: string;
    onOpen: () => void;
};

export default function NodeLinkBadge({ text, url, onOpen }: NodeLinkBadgeProps) {
    return (
        <button
            type="button"
            className="node-link"
            title={url}
            aria-label={`Open link for "${text}"`}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => {
                e.stopPropagation();
                onOpen();
            }}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
        >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                    d="M6.5 9.5a3 3 0 0 0 4.24 0l2-2a3 3 0 0 0-4.24-4.24l-1 1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                />
                <path
                    d="M9.5 6.5a3 3 0 0 0-4.24 0l-2 2a3 3 0 0 0 4.24 4.24l1-1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                />
            </svg>
        </button>
    );
}
