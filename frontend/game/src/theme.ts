import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#ffb300',
        },
        secondary: {
            main: '#4caf50',
        },
        background: {
            default: '#0f0f0f',
            paper: '#1a1a1a',
        },
    },
    typography: {
        fontFamily: 'Roboto, Arial, sans-serif',
        h1: {
            fontWeight: 900,
            letterSpacing: 2,
        },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    fontWeight: 700,
                    letterSpacing: 1,
                },
            },
        },
    },
});
