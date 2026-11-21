import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../auth/api';
import { useAuth } from '../auth/AuthContext';
import { PasswordField } from '../auth/PasswordField';

interface LoginScreenProps {
    onSwitchToRegister: () => void;
}

export function LoginScreen({ onSwitchToRegister }: LoginScreenProps) {
    const { login, notice, dismissNotice } = useAuth();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const identifierError = identifier.trim().length === 0;
    const passwordError = password.length === 0;
    const showValidation = submitting && (identifierError || passwordError);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        dismissNotice();
        setError(null);
        setSubmitting(true);
        try {
            await login({ identifier: identifier.trim(), password });
            // AuthContext flips to the app shell; nothing else to do here.
        } catch (err) {
            setError(
                err instanceof ApiError
                    ? err.message
                    : 'Sign-in failed. Please try again.',
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Card sx={{ width: '100%', maxWidth: 420 }}>
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                <Stack
                    spacing={2.5}
                    component="form"
                    onSubmit={handleSubmit}
                    noValidate
                >
                    <Stack
                        spacing={1}
                        sx={{ alignItems: 'center', textAlign: 'center' }}
                    >
                        <Box
                            sx={{
                                width: 48,
                                height: 48,
                                borderRadius: '50%',
                                bgcolor: 'primary.main',
                                display: 'grid',
                                placeItems: 'center',
                                color: 'primary.contrastText',
                            }}
                        >
                            <LockOutlinedIcon />
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            Welcome back
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Sign in to Tank It! to create rooms and play.
                        </Typography>
                    </Stack>

                    {notice && (
                        <Alert severity="warning" onClose={dismissNotice}>
                            {notice}
                        </Alert>
                    )}
                    {error && <Alert severity="error">{error}</Alert>}

                    <TextField
                        id="identifier"
                        label="Username or email"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        autoComplete="username"
                        required
                        fullWidth
                        error={showValidation && identifierError}
                        helperText={
                            showValidation && identifierError
                                ? 'Enter your username or email.'
                                : undefined
                        }
                    />
                    <PasswordField
                        id="password"
                        label="Password"
                        value={password}
                        onChange={setPassword}
                        autoComplete="current-password"
                        required
                        error={showValidation && passwordError}
                        helperText={
                            showValidation && passwordError
                                ? 'Enter your password.'
                                : undefined
                        }
                    />

                    <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        disabled={submitting}
                        endIcon={
                            submitting ? (
                                <CircularProgress size={16} color="inherit" />
                            ) : (
                                <ArrowForwardIcon />
                            )
                        }
                    >
                        {submitting ? 'Signing in…' : 'Sign in'}
                    </Button>

                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ textAlign: 'center' }}
                    >
                        New here?{' '}
                        <Button
                            variant="text"
                            size="small"
                            onClick={onSwitchToRegister}
                            sx={{ minWidth: 0, px: 0.5 }}
                        >
                            Create an account
                        </Button>
                    </Typography>
                </Stack>
            </CardContent>
        </Card>
    );
}
