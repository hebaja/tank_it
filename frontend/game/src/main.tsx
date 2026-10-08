import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import App from './App';
import { theme } from './theme';
import { SessionProvider } from './session';

const rootEl = document.getElementById('root');

if (!rootEl) {
    throw new Error('Missing #root element');
}

createRoot(rootEl).render(
    <StrictMode>
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <SessionProvider>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </SessionProvider>
        </ThemeProvider>
    </StrictMode>
);
