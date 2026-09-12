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

    // Notes commit on blur or Ctrl/Cmd+Enter so plain Enter adds a newline.
    if (multiline) {
        return (
            <div className="node-editor" data-testid={`node-editor-${nodeId}`}>
                <textarea
                    ref={areaRef}
                    className="node-editor__textarea"
                    aria-label="Edit node text"
                    value={draft}
                    maxLength={maxLength}
                    rows={rows}
                    style={width ? { width } : undefined}
                    onChange={(e) => setDraft(e.target.value.slice(0, maxLength))}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            finish(true);
                        } else if (e.key === "Escape") {
                            e.preventDefault();
                            finish(false);
                        }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    onBlur={() => finish(true)}
                />
                <span className="node-editor__counter" aria-hidden="true">
                    {draft.length}/{maxLength}
                </span>
            </div>
        );
    }

    return (
        <div className="node-editor" data-testid={`node-editor-${nodeId}`}>
            <input
                ref={inputRef}
                className="node-editor__input"
                aria-label="Edit node text"
                value={draft}
                maxLength={maxLength}
                onChange={(e) => setDraft(e.target.value.slice(0, maxLength))}
                onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        e.preventDefault();
                        finish(true);
                    } else if (e.key === "Escape") {
                        e.preventDefault();
                        finish(false);
                    }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }}
                onBlur={() => finish(true)}
            />
            <span className="node-editor__counter" aria-hidden="true">
                {draft.length}/{maxLength}
            </span>
        </div>
    );
}
