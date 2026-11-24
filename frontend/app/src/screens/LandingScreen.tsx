import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useAuth } from '../auth/AuthContext';

interface LandingScreenProps {
    onLoginLogout: () => void;
    onLocalPlay: () => void;
    onOnlinePlay: () => void;
    onTerms: () => void;
}

/** Main landing page: hero image on the left, action buttons on the right. */
export function LandingScreen({
    onLoginLogout,
    onLocalPlay,
    onOnlinePlay,
    onTerms,
}: LandingScreenProps) {
    const { session } = useAuth();
    const username = session?.username ?? '';
    const authenticated = username.length > 0;
    const initial = username.charAt(0).toUpperCase() || '?';

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                px: { xs: 2, sm: 3, md: 4 },
                py: { xs: 2, sm: 3 },
            }}
        >
            {/* User info lives in the top-right corner, per the landing layout. */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: 1,
                    minHeight: 40,
                }}
            >
                {authenticated ? (
                    <>
                        <Box
                            sx={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                bgcolor: 'grey.800',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: 14,
                                fontWeight: 700,
                            }}
                        >
                            {initial}
                        </Box>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            noWrap
                            sx={{ maxWidth: 160 }}
                        >
                            {username}
                        </Typography>
                    </>
                ) : (
                    <>
                        <AccountCircleOutlinedIcon
                            fontSize="small"
                            sx={{ color: 'text.secondary' }}
                        />
                        <Typography variant="body2" color="text.secondary">
                            Guest
                        </Typography>
                    </>
                )}
            </Box>

            <Container
                maxWidth={false}
                sx={{
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: { xs: 3, md: 6 },
                    py: { xs: 2, md: 4 },
                }}
            >
                <Typography
                    component="h1"
                    variant="h1"
                    sx={{
                        position: 'absolute',
                        width: 1,
                        height: 1,
                        padding: 0,
                        margin: -1,
                        overflow: 'hidden',
                        clip: 'rect(0, 0, 0, 0)',
                        whiteSpace: 'nowrap',
                        border: 0,
                    }}
                >
                    Tank It!
                </Typography>

                <Box
                    component="img"
                    src="/assets/landing_main_image.png"
                    alt="Tank It! — blue and red tanks facing off"
                    sx={{
                        width: '100%',
                        maxWidth: { xs: 420, sm: 560, md: 720 },
                        height: 'auto',
                        display: 'block',
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                    }}
                />

                <Stack
                    spacing={2}
                    sx={{
                        width: '100%',
                        maxWidth: 320,
                        alignItems: 'stretch',
                    }}
                >
                    <Button
                        variant="outlined"
                        size="large"
                        onClick={onLoginLogout}
                        fullWidth
                    >
                        {authenticated ? 'Logout' : 'Login'}
                    </Button>
                    <Button
                        variant="outlined"
                        size="large"
                        onClick={onLocalPlay}
                        fullWidth
                    >
                        Local Play
                    </Button>
                    <Button
                        variant="contained"
                        size="large"
                        onClick={onOnlinePlay}
                        fullWidth
                    >
                        Online Play
                    </Button>
                    <Box sx={{ flexGrow: 1, minHeight: { xs: 8, md: 16 } }} />
                    <Button
                        variant="text"
                        size="large"
                        onClick={onTerms}
                        fullWidth
                    >
                        Terms &amp; Conditions
                    </Button>
                </Stack>
            </Container>
        </Box>
    );
}
