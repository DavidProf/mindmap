import { ThemeProvider, CssBaseline } from "@mui/material";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import muiTheme from "./theme/muiTheme";
import HomePage from "./pages/HomePage";
import EditorPage from "./pages/EditorPage";

// HashRouter is SPA-safe on GitHub Pages without a 404.html fallback.
// Feature 7 (Deploy & polish) can revisit BrowserRouter + 404.html if clean URLs are desired.
function App() {
    return (
        <ThemeProvider theme={muiTheme}>
            <CssBaseline />
            <HashRouter>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/project/:projectId" element={<EditorPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </HashRouter>
        </ThemeProvider>
    )
}

export default App
