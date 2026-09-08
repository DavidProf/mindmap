import type { NodeMediaKind } from "../../types/node";

type NodeMediaGlyphProps = {
    kind: NodeMediaKind;
    size?: number;
};

export default function NodeMediaGlyph({ kind, size = 12 }: NodeMediaGlyphProps) {
    if (kind === "video") {
        return (
            <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4.5 3.5v9l7-4.5-7-4.5z" fill="currentColor" />
            </svg>
        );
    }
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="1.5" y="3" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="5.5" cy="6.5" r="1.2" fill="currentColor" />
            <path
                d="M3 11.5l3.5-3.5 2.5 2.5 2-2 2 2.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
            />
        </svg>
    );
}
