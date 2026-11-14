import CssBaseline from '@mui/material/CssBaseline';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ThemeProvider } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { OAuthButtons } from './auth/OAuthButtons';
import { isOAuthCallbackPath } from './auth/oauthCallback';
import { LoginScreen } from './screens/LoginScreen';
import { OAuthCallbackScreen } from './screens/OAuthCallbackScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { LandingScreen } from './screens/LandingScreen';
import { AppShell } from './shell/AppShell';
import theme from './theme';

type AuthView = 'login' | 'register';
type AppView = 'landing' | 'auth' | 'lobby';

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

function AuthScreen({ onBack }: { onBack: () => void }) {
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
            <ButtonBack onBack={onBack} />
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

function ButtonBack({ onBack }: { onBack: () => void }) {
    return (
        <Stack
            sx={{
                width: '100%',
                maxWidth: 460,
                alignItems: 'flex-start',
            }}
        >
            <Typography
                component="button"
                type="button"
                onClick={onBack}
                sx={{
                    border: 0,
                    background: 'none',
                    color: 'text.secondary',
                    cursor: 'pointer',
                    p: 0,
                    font: 'inherit',
                }}
            >
                ← Back to home
            </Typography>
        </Stack>
    );
}

function Routes() {
    const { status, logout, notice } = useAuth();
    const [view, setView] = useState<AppView>('landing');
    const [afterAuthView, setAfterAuthView] = useState<'landing' | 'lobby'>(
        'landing',
    );

    // Open the auth screen when an OAuth failure notice arrives at boot.
    useEffect(() => {
        if (status === 'anonymous' && notice && view === 'landing') {
            setView('auth');
        }
    }, [status, notice, view]);

    // Authenticated users can't stay on the auth screen.
    useEffect(() => {
        if (status === 'authenticated' && view === 'auth') {
            setView(afterAuthView);
        }
    }, [status, view, afterAuthView]);

    // Online play is open without a session, so the lobby stays mounted
    // regardless of auth status.

    useEffect(() => {
        document.title =
            view === 'lobby' && status === 'authenticated'
                ? 'Tank It! — Lobby'
                : view === 'auth'
                  ? 'Tank It! — Sign in'
                  : 'Tank It!';
    }, [view, status]);

    const handleLoginLogout = () => {
        if (status === 'authenticated') {
            logout();
            setView('landing');
            return;
        }
        setAfterAuthView('landing');
        setView('auth');
    };

    const handleOnlinePlay = () => {
        // Online play is open to everyone — no sign-in required.
        setView('lobby');
    };

    if (status === 'loading') {
        return isOAuthCallbackPath() ? (
            <OAuthCallbackScreen />
        ) : (
            <FullPage label="Loading Tank It!…" />
        );
    }
    if (view === 'lobby') return <AppShell />;
    if (view === 'auth') {
        return (
            <AuthScreen
                onBack={() => {
                    setView('landing');
                }}
            />
        );
    }
    return (
        <LandingScreen
            onLoginLogout={handleLoginLogout}
            onLocalPlay={() => {
                // Local play is not implemented yet.
            }}
            onOnlinePlay={handleOnlinePlay}
            onTerms={() => {
                // Terms & Conditions page is not implemented yet.
            }}
        />
    );
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
