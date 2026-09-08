import { useRef } from "react";
import type { KeyboardEvent, MouseEvent, TouchEvent } from "react";
import { NODE_SIDES } from "../../types/node";
import type { NodeSide } from "../../types/node";

// Movement beyond this is a canvas pan, not a tap, so the tap is ignored.
const CLICK_THRESHOLD_PX = 6;
// Two taps within this window count as a double-tap to edit.
// One code path covers mouse double-click and touch double-tap.
const DOUBLE_TAP_MS = 350;
// Holding a finger still this long opens the context menu (feature 5).
const LONG_PRESS_MS = 500;
// Movement beyond this cancels a pending long-press (it became a pan).
const LONG_PRESS_MOVE_PX = 10;

export const PLUS_POSITIONS: readonly NodeSide[] = NODE_SIDES;

type NodeGestures = {
    id: string;
    selected: boolean;
    onSelect: (id: string) => void;
    onEditStart: (id: string) => void;
    onContextMenu: (id: string, x: number, y: number) => void;
};

// Shared tap, double-tap-to-edit, long-press menu, and keyboard behavior
// for circle and note shapes so the two stay identical.
export function useNodeGestures({ id, selected, onSelect, onEditStart, onContextMenu }: NodeGestures) {
    const downRef = useRef<{ x: number; y: number } | null>(null);
    const lastTapRef = useRef(0);
    const pressRef = useRef<{ timer: number; x: number; y: number } | null>(null);
    const pressFiredRef = useRef(false);

    function recordDown(clientX: number, clientY: number) {
        downRef.current = { x: clientX, y: clientY };
    }

    function wasDrag(clientX: number, clientY: number): boolean {
        const down = downRef.current;
        downRef.current = null;
        if (!down) return false;
        return Math.hypot(clientX - down.x, clientY - down.y) > CLICK_THRESHOLD_PX;
    }

    function cancelPress() {
        if (pressRef.current) {
            window.clearTimeout(pressRef.current.timer);
            pressRef.current = null;
        }
    }

    function handleShapeClick(e: MouseEvent) {
        e.stopPropagation();
        // A long-press is followed by a synthetic click; swallow it so the
        // tap does not select or double-tap-edit after the menu opens.
        if (pressFiredRef.current) {
            pressFiredRef.current = false;
            return;
        }
        if (wasDrag(e.clientX, e.clientY)) return;
        onSelect(id);
        const now = Date.now();
        if (now - lastTapRef.current < DOUBLE_TAP_MS) {
            lastTapRef.current = 0;
            onEditStart(id);
        } else {
            lastTapRef.current = now;
        }
    }

    function handleShapeContextMenu(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(id, e.clientX, e.clientY);
    }

    function handleTouchStart(e: TouchEvent) {
        const t = e.touches[0];
        if (t) recordDown(t.clientX, t.clientY);
        // A second finger means pinch, never a long-press.
        if (e.touches.length !== 1) {
            cancelPress();
            return;
        }
        const touch = e.touches[0];
        cancelPress();
        pressRef.current = {
            timer: window.setTimeout(() => {
                pressRef.current = null;
                pressFiredRef.current = true;
                onContextMenu(id, touch.clientX, touch.clientY);
            }, LONG_PRESS_MS),
            x: touch.clientX,
            y: touch.clientY,
        };
    }

    function handleTouchMove(e: TouchEvent) {
        const p = pressRef.current;
        if (!p) return;
        const t = e.touches[0];
        if (!t || e.touches.length !== 1 || Math.hypot(t.clientX - p.x, t.clientY - p.y) > LONG_PRESS_MOVE_PX) {
            cancelPress();
        }
    }

    function handleTouchEnd() {
        // Keep pressFiredRef until the synthetic click runs and clears it.
        cancelPress();
    }

    function handleShapeKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            // Enter on an already-selected node edits; otherwise it selects.
            if (selected && e.key === "Enter") onEditStart(id);
            else onSelect(id);
        }
    }

    return {
        recordMouseDown: (e: MouseEvent) => recordDown(e.clientX, e.clientY),
        handleShapeClick,
        handleShapeContextMenu,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleShapeKeyDown,
    };
}
