import GoogleIcon from '@mui/icons-material/Google';
import GitHubIcon from '@mui/icons-material/GitHub';
import { Button, Stack, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import fortyTwoLogo from '../assets/42.svg';
import { oauthStartUrl } from '../auth/api';
import { OAUTH_PROVIDERS, type OAuthProvider } from '../auth/types';

/**
 * MUI ships no official 42 logo. The source mark is black, so invert it to
 * match the dark theme's button text.
 */
function FortyTwoIcon() {
    return (
        <Box
            component="img"
            src={fortyTwoLogo}
            alt=""
            sx={{
                display: 'block',
                width: 20,
                height: 20,
                filter: 'invert(1)',
            }}
        />
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

export function OAuthButtons() {
    const start = (provider: OAuthProvider) => {
        // Full-page redirect: the backend drives the provider flow, then sends
        // the browser to /auth/callback with a single-use code (never a JWT).
        window.location.assign(oauthStartUrl(provider));
    };

    return (
        <Stack spacing={1.5} sx={{ mt: 0 }}>
            <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: 'center' }}
            >
                or sign in with
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
                    Continue with {label}
                </Button>
            ))}
        </Stack>
    );
}
