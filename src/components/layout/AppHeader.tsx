import { Button } from "@mui/material";
import { Link } from "react-router-dom";
import "./AppHeader.css";

type AppHeaderProps = {
    variant?: "home" | "editor";
    projectName?: string;
};

export default function AppHeader({ variant = "home", projectName }: AppHeaderProps) {
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
                    <Button variant="outlined" size="small" disabled sx={{ borderRadius: "999px" }}>
                        ⤢ Fit view
                    </Button>
                    <Button variant="outlined" size="small" disabled sx={{ borderRadius: "999px" }}>
                        ↺ Re-center
                    </Button>
                    <Button variant="contained" size="small" disabled sx={{ borderRadius: "999px" }}>
                        ⤓ Export PNG
                    </Button>
                </div>
            </header>
        );
    }

    return (
        <header className="app-header">
            <div className="app-header__brand">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <circle cx="12" cy="12" r="3.5" />
                    <circle cx="6" cy="7" r="2" />
                    <circle cx="18" cy="7" r="2" />
                    <circle cx="6" cy="17" r="2" />
                    <circle cx="18" cy="17" r="2" />
                    <path d="M9 10.2L12 12M12 12l2.9-1.8M12 12l-3 3.2M12 12l3 3.2" />
                </svg>
                <span>Mind Map</span>
                <span className="app-header__local">— local</span>
            </div>
            <div className="app-header__actions">
                <span className="app-header__badge">local only • GitHub Pages</span>
            </div>
        </header>
    );
}
