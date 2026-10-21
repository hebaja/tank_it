import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../auth/api';
import { useAuth } from '../auth/AuthContext';
import { PasswordField } from '../auth/PasswordField';

interface RegisterScreenProps {
    onSwitchToLogin: () => void;
}

/** Mirrors the [Required]/length rules on AuthController.RegisterRequest. */
const USERNAME_MIN = 3;
const USERNAME_MAX = 32;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 100;
const EMAIL_MAX = 255;
const DISPLAY_NAME_MAX = 32;

const TERMS_URL =
    'https://github.com/hebaja/tank_it/blob/develop/docs/terms-and-conditions.md';

export function RegisterScreen({ onSwitchToLogin }: RegisterScreenProps) {
    const { register, notice, dismissNotice } = useAuth();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [attempted, setAttempted] = useState(false);

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    const validations = {
        username:
            trimmedUsername.length < USERNAME_MIN
                ? `Username must be at least ${USERNAME_MIN} characters.`
                : trimmedUsername.length > USERNAME_MAX
                  ? `Username must be at most ${USERNAME_MAX} characters.`
                  : null,
        email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
            ? 'Enter a valid email address.'
            : null,
        password:
            password.length < PASSWORD_MIN
                ? `Password must be at least ${PASSWORD_MIN} characters.`
                : password.length > PASSWORD_MAX
                  ? `Password must be at most ${PASSWORD_MAX} characters.`
                  : null,
        confirm: confirm !== password ? 'Passwords do not match.' : null,
    };
    const show = attempted;
    const formValid =
        !validations.username &&
        !validations.email &&
        !validations.password &&
        !validations.confirm &&
        acceptedTerms;

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setAttempted(true);
        dismissNotice();
        setError(null);
        if (!formValid) return;

        setSubmitting(true);
        try {
            await register({
                username: trimmedUsername,
                email: trimmedEmail,
                password,
                ...(displayName.trim()
                    ? { displayName: displayName.trim() }
                    : {}),
            });
            // AuthContext flips to the app shell; nothing else to do here.
        } catch (err) {
            setError(
                err instanceof ApiError
                    ? err.message
                    : 'Registration failed. Please try again.',
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Card sx={{ width: '100%', maxWidth: 460 }}>
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
                            <HowToRegOutlinedIcon />
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            Create your account
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Pick a callsign and join the fight.
                        </Typography>
                    </Stack>

                    {notice && (
                        <Alert severity="warning" onClose={dismissNotice}>
                            {notice}
                        </Alert>
                    )}
                    {error && <Alert severity="error">{error}</Alert>}

                    <TextField
                        id="username"
                        label="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username"
                        slotProps={{
                            htmlInput: {
                                minLength: USERNAME_MIN,
                                maxLength: USERNAME_MAX,
                            },
                        }}
                        required
                        fullWidth
                        error={show && !!validations.username}
                        helperText={
                            show && validations.username
                                ? validations.username
                                : undefined
                        }
                    />
                    <TextField
                        id="email"
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        slotProps={{ htmlInput: { maxLength: EMAIL_MAX } }}
                        required
                        fullWidth
                        error={show && !!validations.email}
                        helperText={
                            show && validations.email
                                ? validations.email
                                : undefined
                        }
                    />
                    <TextField
                        id="displayName"
                        label="Display name (optional)"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        autoComplete="nickname"
                        slotProps={{
                            htmlInput: { maxLength: DISPLAY_NAME_MAX },
                        }}
                        fullWidth
                        helperText="Defaults to your username if left blank."
                    />
                    <PasswordField
                        id="password"
                        label="Password"
                        value={password}
                        onChange={setPassword}
                        autoComplete="new-password"
                        required
                        error={show && !!validations.password}
                        helperText={
                            show && validations.password
                                ? validations.password
                                : `At least ${PASSWORD_MIN} characters.`
                        }
                    />
                    <PasswordField
                        id="confirmPassword"
                        label="Confirm password"
                        value={confirm}
                        onChange={setConfirm}
                        autoComplete="new-password"
                        required
                        error={show && !!validations.confirm}
                        helperText={
                            show && validations.confirm
                                ? validations.confirm
                                : undefined
                        }
                    />

                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={acceptedTerms}
                                onChange={(e) =>
                                    setAcceptedTerms(e.target.checked)
                                }
                                color="primary"
                            />
                        }
                        sx={{ alignItems: 'flex-start' }}
                        label={
                            <Typography variant="body2" color="text.secondary">
                                I have read and agree to the{' '}
                                <Link
                                    href={TERMS_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    underline="hover"
                                >
                                    Terms &amp; Conditions
                                </Link>
                                .
                            </Typography>
                        }
                    />
                    {show && !acceptedTerms && (
                        <Typography
                            variant="caption"
                            color="error"
                            sx={{ mt: -2, ml: 2 }}
                        >
                            You must accept the Terms &amp; Conditions to
                            register.
                        </Typography>
                    )}

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
                        {submitting ? 'Creating account…' : 'Create account'}
                    </Button>

                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ textAlign: 'center' }}
                    >
                        Already have an account?{' '}
                        <Button
                            variant="text"
                            size="small"
                            onClick={onSwitchToLogin}
                            sx={{ minWidth: 0, px: 0.5 }}
                        >
                            Sign in
                        </Button>
                    </Typography>
                </Stack>
            </CardContent>
        </Card>
    );
}
