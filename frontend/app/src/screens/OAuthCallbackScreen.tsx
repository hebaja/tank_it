import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/** Transient screen shown while the OAuth code is exchanged for a JWT. */
export function OAuthCallbackScreen() {
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
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
                Completing sign-in…
            </Typography>
        </Stack>
    );
}
