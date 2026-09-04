import { useEffect, useRef, useState } from "react";
import { MAX_NODE_TEXT_LENGTH } from "../../lib/storage";
import "./TreeCanvas.css";

type NodeEditorProps = {
    nodeId: string;
    initialText: string;
    onCommit: (text: string) => void;
    onCancel: () => void;
};

export default function NodeEditor({ nodeId, initialText, onCommit, onCancel }: NodeEditorProps) {
    const [draft, setDraft] = useState(initialText);
    const inputRef = useRef<HTMLInputElement>(null);
    const doneRef = useRef(false);

    useEffect(() => {
        const input = inputRef.current;
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

    return (
        <div className="node-editor" data-testid={`node-editor-${nodeId}`}>
            <input
                ref={inputRef}
                className="node-editor__input"
                aria-label="Edit node text"
                value={draft}
                maxLength={MAX_NODE_TEXT_LENGTH}
                onChange={(e) => setDraft(e.target.value.slice(0, MAX_NODE_TEXT_LENGTH))}
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
                {draft.length}/{MAX_NODE_TEXT_LENGTH}
            </span>
        </div>
    );
}
