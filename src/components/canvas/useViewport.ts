import { useEffect, useRef, useState } from "react";
import type { Viewport } from "../../types/project";
import {
    clampZoom,
    DEFAULT_VIEWPORT,
    getViewport,
    MIN_ZOOM,
    setViewport,
} from "../../lib/storage";

export type CanvasBounds = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
};

type UseViewportArgs = {
    projectId: string;
    bounds: CanvasBounds;
    containerRef: { current: HTMLDivElement | null };
    onInteract: () => void;
};

export default function useViewport({ projectId, bounds, containerRef, onInteract }: UseViewportArgs) {
    const [viewport, setViewportState] = useState<Viewport>(() => getViewport(projectId) ?? { ...DEFAULT_VIEWPORT });
    const [animate, setAnimate] = useState(false);
    const [dragging, setDragging] = useState(false);
    const dragRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
    const pinchRef = useRef<{ dist: number; zoom: number; midX: number; midY: number; vx: number; vy: number } | null>(
        null,
    );
    const wheelTimer = useRef<number | null>(null);
    const animateTimer = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (wheelTimer.current) window.clearTimeout(wheelTimer.current);
            if (animateTimer.current) window.clearTimeout(animateTimer.current);
        };
    }, []);

    function commitViewport(next: Viewport) {
        try {
            const persisted = setViewport(projectId, next);
            setViewportState(persisted);
        } catch {
            setViewportState(next);
        }
    }

    function handleRecenter(e?: React.MouseEvent) {
        e?.stopPropagation();
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const viewW = rect.width;
        const viewH = rect.height;
        if (bounds.width === 0 || bounds.height === 0) {
            const next = { x: 0, y: 0, zoom: 1 };
            setAnimate(true);
            commitViewport(next);
            if (animateTimer.current) window.clearTimeout(animateTimer.current);
            animateTimer.current = window.setTimeout(() => setAnimate(false), 260);
            return;
        }
        const scaleX = viewW / bounds.width;
        const scaleY = viewH / bounds.height;
        let scale = Math.min(scaleX, scaleY) * 0.85;
        scale = Math.min(1, Math.max(MIN_ZOOM, Math.min(1.5, scale)));
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        const next = { x: -centerX * scale, y: -centerY * scale, zoom: scale };
        setAnimate(true);
        commitViewport(next);
        if (animateTimer.current) window.clearTimeout(animateTimer.current);
        animateTimer.current = window.setTimeout(() => setAnimate(false), 260);
    }

    function getDistance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }): number {
        return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }

    function isOverlayEvent(e: React.SyntheticEvent): boolean {
        // MUI Menu/Dialog render into body portals, but React events from a
        // portal still bubble through this component's handlers. A press
        // inside an open overlay must not dismiss it or start a canvas drag,
        // or the menu item unmounts before its click fires.
        const el = e.target as Element | null;
        if (!el || typeof el.closest !== "function") return false;
        return el.closest('[role="menu"], [role="dialog"]') !== null;
    }

    function handleWheel(e: React.WheelEvent) {
        if (isOverlayEvent(e)) return;
        onInteract();
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const delta = e.deltaY;
        const factor = Math.exp(-delta * 0.002);
        const newZoom = clampZoom(viewport.zoom * factor);
        if (newZoom === viewport.zoom) return;
        const worldX = (cx - centerX - viewport.x) / viewport.zoom;
        const worldY = (cy - centerY - viewport.y) / viewport.zoom;
        const next = {
            x: cx - centerX - worldX * newZoom,
            y: cy - centerY - worldY * newZoom,
            zoom: newZoom,
        };
        setViewportState(next);
        if (wheelTimer.current) window.clearTimeout(wheelTimer.current);
        wheelTimer.current = window.setTimeout(() => commitViewport(next), 300);
    }

    function handleMouseDown(e: React.MouseEvent, onBackgroundPress: () => void) {
        if (isOverlayEvent(e)) return;
        onInteract();
        if (e.button !== 0) return;
        if (e.target === e.currentTarget) onBackgroundPress();
        e.preventDefault();
        dragRef.current = { sx: e.clientX, sy: e.clientY, vx: viewport.x, vy: viewport.y };
        setDragging(true);
    }

    function handleMouseMove(e: React.MouseEvent) {
        if (!dragRef.current) return;
        const dx = e.clientX - dragRef.current.sx;
        const dy = e.clientY - dragRef.current.sy;
        setViewportState({ x: dragRef.current.vx + dx, y: dragRef.current.vy + dy, zoom: viewport.zoom });
    }

    function handleMouseUp() {
        if (!dragRef.current) return;
        const final: Viewport = {
            x: viewport.x,
            y: viewport.y,
            zoom: viewport.zoom,
        };
        dragRef.current = null;
        setDragging(false);
        commitViewport(final);
    }

    function handleTouchStart(e: React.TouchEvent, onBackgroundPress: () => void) {
        if (isOverlayEvent(e)) return;
        onInteract();
        if (e.target === e.currentTarget) onBackgroundPress();
        if (e.touches.length === 1) {
            const t = e.touches[0];
            dragRef.current = { sx: t.clientX, sy: t.clientY, vx: viewport.x, vy: viewport.y };
            setDragging(true);
        } else if (e.touches.length === 2) {
            const a = e.touches[0];
            const b = e.touches[1];
            const dist = getDistance(a, b);
            const midX = (a.clientX + b.clientX) / 2;
            const midY = (a.clientY + b.clientY) / 2;
            const rect = containerRef.current?.getBoundingClientRect();
            const cx = rect ? midX - rect.left : midX;
            const cy = rect ? midY - rect.top : midY;
            // store canvas-relative mid for centered math
            pinchRef.current = { dist, zoom: viewport.zoom, midX: cx, midY: cy, vx: viewport.x, vy: viewport.y };
            dragRef.current = null;
            setDragging(false);
        }
    }

    function handleTouchMove(e: React.TouchEvent) {
        if (e.touches.length === 2 && pinchRef.current) {
            const a = e.touches[0];
            const b = e.touches[1];
            const newDist = getDistance(a, b);
            if (newDist === 0) return;
            const scale = newDist / pinchRef.current.dist;
            const newZoom = clampZoom(pinchRef.current.zoom * scale);
            // pinch mid is in canvas coordinates; convert to centered world
            const rect = containerRef.current?.getBoundingClientRect();
            const centerX = rect ? rect.width / 2 : 0;
            const centerY = rect ? rect.height / 2 : 0;
            const worldX = (pinchRef.current.midX - centerX - pinchRef.current.vx) / pinchRef.current.zoom;
            const worldY = (pinchRef.current.midY - centerY - pinchRef.current.vy) / pinchRef.current.zoom;
            const next = {
                x: pinchRef.current.midX - centerX - worldX * newZoom,
                y: pinchRef.current.midY - centerY - worldY * newZoom,
                zoom: newZoom,
            };
            setViewportState(next);
        } else if (e.touches.length === 1 && dragRef.current) {
            const t = e.touches[0];
            const dx = t.clientX - dragRef.current.sx;
            const dy = t.clientY - dragRef.current.sy;
            setViewportState({ x: dragRef.current.vx + dx, y: dragRef.current.vy + dy, zoom: viewport.zoom });
        }
    }

    function handleTouchEnd(e: React.TouchEvent) {
        if (e.touches.length === 0) {
            if (pinchRef.current) {
                const final = { x: viewport.x, y: viewport.y, zoom: viewport.zoom };
                pinchRef.current = null;
                commitViewport(final);
            } else if (dragRef.current) {
                const final = { x: viewport.x, y: viewport.y, zoom: viewport.zoom };
                dragRef.current = null;
                setDragging(false);
                commitViewport(final);
            }
        } else if (e.touches.length === 1) {
            pinchRef.current = null;
            const t = e.touches[0];
            dragRef.current = { sx: t.clientX, sy: t.clientY, vx: viewport.x, vy: viewport.y };
            setDragging(true);
        }
    }

    return {
        viewport,
        animate,
        dragging,
        handleRecenter,
        handleWheel,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
    };
}
