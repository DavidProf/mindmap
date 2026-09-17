import { useEffect, useRef, useState } from "react";
import { MAX_NODE_TEXT_LENGTH } from "../../storage/localStore";
import "./TreeCanvas.css";

type NodeEditorProps = {
    nodeId: string;
    initialText: string;
    maxLength?: number;
    multiline?: boolean;
    rows?: number;
    width?: number;
    onCommit: (text: string) => void;
    onCancel: () => void;
};

export default function NodeEditor({ nodeId, initialText, maxLength = MAX_NODE_TEXT_LENGTH, multiline = false, rows = 4, width, onCommit, onCancel }: NodeEditorProps) {
    const [draft, setDraft] = useState(initialText);
    const inputRef = useRef<HTMLInputElement>(null);
    const areaRef = useRef<HTMLTextAreaElement>(null);
    const doneRef = useRef(false);

    useEffect(() => {
        const input = inputRef.current ?? areaRef.current;
        if (input) {
            input.focus();
            input.select();
        }
    }, []);

    function finish(commit: boolean) {
        // Enter and blur fire together; Escape and blur fire together.
        // Only the first one counts.
        if (doneRef.current) return;
        doneRef.current = true;
        if (commit) onCommit(draft);
        else onCancel();
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        e.stopPropagation();
        // Notes commit on Ctrl/Cmd+Enter so plain Enter adds a newline.
        if (multiline ? e.key === "Enter" && (e.ctrlKey || e.metaKey) : e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            finish(true);
        } else if (e.key === "Escape") {
            e.preventDefault();
            finish(false);
        }
    }

    const shared = {
        "aria-label": "Edit node text",
        value: draft,
        maxLength,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value.slice(0, maxLength)),
        onKeyDown: handleKeyDown,
        onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
        onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
        onContextMenu: (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
        },
        onBlur: () => finish(true),
    };

    return (
        <div className="node-editor" data-testid={`node-editor-${nodeId}`}>
            {multiline ? (
                <textarea
                    ref={areaRef}
                    className="node-editor__textarea"
                    rows={rows}
                    style={width ? { width } : undefined}
                    {...shared}
                />
            ) : (
                <input ref={inputRef} className="node-editor__input" {...shared} />
            )}
            <span className="node-editor__counter" aria-hidden="true">
                {draft.length}/{maxLength}
            </span>
        </div>
    );
}
