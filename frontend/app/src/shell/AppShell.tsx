import LogoutIcon from '@mui/icons-material/Logout';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useAuth } from '../auth/AuthContext';
import { LobbyScreen } from './LobbyScreen';

/** Authenticated app shell: brand bar with the signed-in user + the lobby. */
export function AppShell() {
    const { session, logout } = useAuth();
    const username = session?.username ?? '';
    const initial = username.charAt(0).toUpperCase() || '?';

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <AppBar
                position="sticky"
                color="transparent"
                elevation={0}
                sx={{
                    borderBottom: 1,
                    borderColor: 'divider',
                    backdropFilter: 'blur(8px)',
                }}
            >
                <Toolbar disableGutters>
                    <Container
                        maxWidth="sm"
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            py: 1,
                        }}
                    >
                        <Avatar
                            sx={{
                                bgcolor: 'primary.main',
                                width: 32,
                                height: 32,
                                fontSize: 16,
                                fontWeight: 700,
                            }}
                        >
                            T
                        </Avatar>
                        <Typography
                            variant="h6"
                            sx={{ fontWeight: 800, flexGrow: 1 }}
                        >
                            Tank It!
                        </Typography>
                        <Tooltip title="Signed in">
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                }}
                            >
                                <Avatar
                                    sx={{
                                        bgcolor: 'grey.800',
                                        width: 28,
                                        height: 28,
                                        fontSize: 14,
                                    }}
                                >
                                    {initial}
                                </Avatar>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ maxWidth: 140 }}
                                    noWrap
                                >
                                    {username}
                                </Typography>
                            </Box>
                        </Tooltip>
                        <Button
                            color="inherit"
                            size="small"
                            startIcon={<LogoutIcon fontSize="small" />}
                            onClick={logout}
                            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                        >
                            Sign out
                        </Button>
                        <Tooltip title="Sign out">
                            <Button
                                color="inherit"
                                size="small"
                                onClick={logout}
                                sx={{
                                    display: { xs: 'inline-flex', sm: 'none' },
                                    minWidth: 0,
                                    px: 1,
                                }}
                            >
                                <LogoutIcon fontSize="small" />
                            </Button>
                        </Tooltip>
                    </Container>
                </Toolbar>
            </AppBar>

            <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 5 } }}>
                <LobbyScreen />
            </Container>
        </Box>
    );
}
