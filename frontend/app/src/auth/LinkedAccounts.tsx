import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { ApiError, linkOAuthProvider } from './api';
import { useAuth } from './AuthContext';
import { OAUTH_PROVIDERS, type OAuthProvider } from './types';

/**
 * Explicit account-linking flow: never automatic, and only available while the
 * user is already signed in. The backend binds a single-use code to this
 * browser and returns the provider-challenge URL.
 */
export function LinkedAccounts() {
    const { session } = useAuth();
    const [busy, setBusy] = useState<OAuthProvider | null>(null);
    const [error, setError] = useState<string | null>(null);

    if (!session) return null;

    const start = async (provider: OAuthProvider) => {
        setBusy(provider);
        setError(null);
        try {
            const url = await linkOAuthProvider(provider, session.accessToken);
            window.location.assign(url);
        } catch (err) {
            setError(
                err instanceof ApiError
                    ? err.message
                    : 'Could not start account linking. Please try again.',
            );
            setBusy(null);
        }
    };

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={2}>
                    <Stack spacing={0.5}>
                        <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 700 }}
                        >
                            Linked sign-in methods
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Add Google, GitHub or 42 to this account. You must
                            be signed in to link another provider.
                        </Typography>
                    </Stack>

                    {error && <Alert severity="error">{error}</Alert>}

                    <Stack
                        direction="row"
                        spacing={1}
                        sx={{ flexWrap: 'wrap', rowGap: 1 }}
                    >
                        {OAUTH_PROVIDERS.map(({ id, label }) => (
                            <Button
                                key={id}
                                variant="outlined"
                                size="small"
                                disabled={busy !== null}
                                onClick={() => void start(id)}
                                startIcon={
                                    busy === id ? (
                                        <CircularProgress
                                            size={14}
                                            color="inherit"
                                        />
                                    ) : undefined
                                }
                            >
                                Link {label}
                            </Button>
                        ))}
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}
