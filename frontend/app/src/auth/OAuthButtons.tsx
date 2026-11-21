import GoogleIcon from '@mui/icons-material/Google';
import GitHubIcon from '@mui/icons-material/GitHub';
import { Button, Stack, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import { oauthStartUrl } from '../auth/api';
import { OAUTH_PROVIDERS, type OAuthProvider } from '../auth/types';

/** MUI ships no official 42 logo — render the intranet mark as bold text. */
function FortyTwoIcon() {
    return (
        <Box
            component="span"
            aria-hidden
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
                borderRadius: '4px',
                border: '1.5px solid currentColor',
                fontSize: 10,
                fontWeight: 800,
                lineHeight: 1,
            }}
        >
            42
        </Box>
    );
}

function providerIcon(provider: OAuthProvider) {
    switch (provider) {
        case 'google':
            return <GoogleIcon fontSize="small" />;
        case 'github':
            return <GitHubIcon fontSize="small" />;
        case 'fortytwo':
            return <FortyTwoIcon />;
    }
}

function labelFor(provider: OAuthProvider, label: string): string {
    return provider === 'fortytwo' ? label : `Continue with ${label}`;
}

export function OAuthButtons() {
    const start = (provider: OAuthProvider) => {
        // Full-page redirect: the backend drives the provider flow, then sends
        // the browser back to this origin (see auth/oauthCallback.ts).
        window.location.assign(oauthStartUrl(provider));
    };

    return (
        <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: 'center' }}
            >
                or continue with
            </Typography>
            {OAUTH_PROVIDERS.map(({ id, label }) => (
                <Button
                    key={id}
                    fullWidth
                    variant="outlined"
                    color="inherit"
                    startIcon={providerIcon(id)}
                    onClick={() => start(id)}
                    sx={{ py: 0.9 }}
                >
                    {labelFor(id, label)}
                </Button>
            ))}
        </Stack>
    );
}
