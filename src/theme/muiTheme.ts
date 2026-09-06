import { createTheme } from "@mui/material/styles";
import { TOKENS } from "./tokens";

const muiTheme = createTheme({
    palette: {
        primary: {
            main: TOKENS.accent,
            light: TOKENS.accentRing,
            dark: TOKENS.accentHover,
            contrastText: TOKENS.accentInk,
        },
        background: {
            default: TOKENS.bg,
            paper: TOKENS.surface,
        },
        text: {
            primary: TOKENS.text,
            secondary: TOKENS.muted,
        },
        error: {
            main: TOKENS.danger,
        },
    },
    typography: {
        fontFamily: TOKENS.fontSans,
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
