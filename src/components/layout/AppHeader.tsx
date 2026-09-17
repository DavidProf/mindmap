import { Button } from "@mui/material";
import { Link } from "react-router-dom";
import BrandMark from "../BrandMark";
import "./AppHeader.css";

type AppHeaderProps = {
    variant?: "home" | "editor";
    projectName?: string;
    onRecenter?: () => void;
    onExport?: () => void;
    exporting?: boolean;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
};

export default function AppHeader({ variant = "home", projectName, onRecenter, onExport, exporting, onUndo, onRedo, canUndo, canRedo }: AppHeaderProps) {
    const modKey = typeof navigator !== "undefined" && /mac/i.test(navigator.platform ?? "") ? "Cmd" : "Ctrl";
    if (variant === "editor") {
        return (
            <header className="app-header app-header--editor">
                <div className="app-header__left">
                    <Link to="/" className="app-header__back" aria-label="Back to projects">
                        ←
                    </Link>
                    <div className="app-header__title-group">
                        <div className="app-header__title">{projectName ?? "Untitled project"}</div>
                        <div className="app-header__sub">local</div>
                    </div>
                    <span className="app-header__sep" aria-hidden="true" />
                    <span className="app-header__hint">
                        tap / hover + to add · long-press / right-click for menu
                    </span>
                </div>
                <div className="app-header__actions">
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={onUndo}
                        disabled={!canUndo}
                        aria-label="Undo"
                        title={`Undo (${modKey}+Z)`}
                    >
                        ↩ Undo
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={onRedo}
                        disabled={!canRedo}
                        aria-label="Redo"
                        title={`Redo (${modKey}+Shift+Z)`}
                    >
                        ↪ Redo
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={onRecenter}
                        disabled={!onRecenter}
                        aria-label="Re-center"
                    >
                        ↺ Re-center
                    </Button>
                    <Button
                        variant="contained"
                        size="small"
                        onClick={onExport}
                        disabled={!onExport || exporting}
                        aria-label="Export PNG"
                    >
                        {exporting ? "Exporting..." : "⤓ Export PNG"}
                    </Button>
                </div>
            </header>
        );
    }

    return (
        <header className="app-header">
            <div className="app-header__brand">
                <BrandMark />
                <span>Mind Map</span>
                <span className="app-header__local">— local</span>
            </div>
            <div className="app-header__actions">
                <span className="app-header__badge">local only • GitHub Pages</span>
            </div>
        </header>
    );
}
