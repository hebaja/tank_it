import { createTheme } from '@mui/material/styles';

// Dark theme matching the palette the lobby page already used
// (#101418 background, #181d22 surface, #2a2f36 borders, #4caf50 accent).
const theme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#4caf50' },
        error: { main: '#e53935' },
        warning: { main: '#ffb300' },
        background: { default: '#101418', paper: '#181d22' },
        divider: '#2a2f36',
        text: { primary: '#f2f4f6', secondary: 'rgba(242, 244, 246, 0.7)' },
    },
    shape: { borderRadius: 10 },
    typography: {
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: { textTransform: 'none', fontWeight: 600 },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    border: '1px solid #2a2f36',
                    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
                },
            },
        },
    },
});

export default theme;
