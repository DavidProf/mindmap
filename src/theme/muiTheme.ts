import { createTheme } from "@mui/material/styles";

const muiTheme = createTheme({
    palette: {
        primary: {
            main: "#3b82f6",
            light: "#93c5fd",
            dark: "#2563eb",
            contrastText: "#ffffff",
        },
        background: {
            default: "#fbfaf7",
            paper: "#ffffff",
        },
        text: {
            primary: "#0f172a",
            secondary: "#64748b",
        },
        error: {
            main: "#ef4444",
        },
    },
    typography: {
        fontFamily:
            '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },
    shape: {
        borderRadius: 12,
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    backgroundColor: "var(--bg)",
                    color: "var(--text)",
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: "var(--radius-full)",
                    textTransform: "none",
                    fontWeight: 500,
                    boxShadow: "none",
                    backgroundImage: "none",
                    "&:hover": {
                        boxShadow: "var(--shadow-sm)",
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: "none",
                },
            },
        },
    },
});

export default muiTheme;
