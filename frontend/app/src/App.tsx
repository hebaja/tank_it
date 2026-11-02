import CssBaseline from '@mui/material/CssBaseline';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ThemeProvider } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { OAuthButtons } from './auth/OAuthButtons';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { AppShell } from './shell/AppShell';
import theme from './theme';

type AuthView = 'login' | 'register';

function FullPage({ label }: { label: string }) {
    return (
        <Stack
            spacing={2}
            sx={{
                minHeight: '100vh',
                alignItems: 'center',
                justifyContent: 'center',
            }}
            role="status"
            aria-live="polite"
        >
            <Typography variant="body2" color="text.secondary">
                {label}
            </Typography>
        </Stack>
    );
}

function AuthScreen() {
    const [view, setView] = useState<AuthView>('login');

    return (
        <Stack
            spacing={3}
            sx={{
                minHeight: '100vh',
                px: 2,
                py: 4,
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Stack
                spacing={0.5}
                sx={{ alignItems: 'center', textAlign: 'center' }}
            >
                <Typography
                    variant="h3"
                    sx={{ fontWeight: 900, letterSpacing: -1 }}
                >
                    Tank It!
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Online tank battles with friends — sign in to get rolling.
                </Typography>
            </Stack>

            {view === 'login' ? (
                <LoginScreen onSwitchToRegister={() => setView('register')} />
            ) : (
                <RegisterScreen onSwitchToLogin={() => setView('login')} />
            )}

            {/* OAuth/startup notices render as Alerts inside the form cards. */}
            <Stack sx={{ width: '100%', maxWidth: 460 }}>
                <OAuthButtons />
            </Stack>
        </Stack>
    );
}

function Routes() {
    const { status } = useAuth();

    // Keep document.title in sync so tab/context menus read correctly.
    useEffect(() => {
        document.title =
            status === 'authenticated'
                ? 'Tank It! — Lobby'
                : 'Tank It! — Sign in';
    }, [status]);

    if (status === 'loading') return <FullPage label="Loading Tank It!…" />;
    if (status === 'authenticated') return <AppShell />;
    return <AuthScreen />;
}

export default function App() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <AuthProvider>
                <Routes />
            </AuthProvider>
        </ThemeProvider>
    );
}
