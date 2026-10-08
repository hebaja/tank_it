import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AppBar,
    Box,
    Button,
    Card,
    CardContent,
    Container,
    IconButton,
    Stack,
    TextField,
    Toolbar,
    Typography,
} from '@mui/material';
import {
    Casino,
    Check,
    EmojiEvents,
    PlayArrow,
    Shield,
    SportsEsports,
    Terrain,
} from '@mui/icons-material';
import { Color } from '../game/config/color';
import { useSession } from '../session';

const FEATURES = [
    {
        icon: <SportsEsports fontSize="large" color="primary" />,
        title: 'Local battles',
        text: '2–4 tanks on one map. Outmaneuver and outgun your rivals.',
    },
    {
        icon: <Terrain fontSize="large" color="primary" />,
        title: 'Destructible terrain',
        text: 'Blast cover apart, dodge barrels and watch out for oil spills.',
    },
    {
        icon: <EmojiEvents fontSize="large" color="primary" />,
        title: 'Last tank standing',
        text: 'Manage your ammo gauge and survive the shrinking map.',
    },
];

const SWATCHES: { color: Color; hex: string; label: string }[] = [
    { color: Color.blue, hex: '#2196f3', label: 'Blue' },
    { color: Color.red, hex: '#f44336', label: 'Red' },
    { color: Color.green, hex: '#4caf50', label: 'Green' },
    { color: Color.dark, hex: '#616161', label: 'Dark' },
];

function randomRoomId() {
    return `room-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Landing() {
    const [roomId, setRoomId] = useState('');
    const { color, setColor } = useSession();
    const navigate = useNavigate();

    const joinRoom = (e: FormEvent) => {
        e.preventDefault();
        const target = roomId.trim() || 'local-dev-room';
        navigate(`/play/${encodeURIComponent(target)}`);
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <AppBar position="static" color="transparent" elevation={0}>
                <Toolbar>
                    <Shield color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 900, letterSpacing: 2 }}>
                        TANK IT!
                    </Typography>
                    <Button color="primary" variant="outlined" onClick={() => navigate(`/play/${randomRoomId()}`)}>
                        Quick play
                    </Button>
                </Toolbar>
            </AppBar>

            <Container maxWidth="md" sx={{ textAlign: 'center', pt: 8, pb: 6 }}>
                <Typography variant="h1" sx={{ fontSize: { xs: '3rem', md: '4.5rem' } }}>
                    TANK <Box component="span" sx={{ color: 'primary.main' }}>IT!</Box>
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ mt: 2, mb: 5 }}>
                    Top-down arcade tank battles. Grab a room code and roll out.
                </Typography>

                <Card sx={{ maxWidth: 520, mx: 'auto', p: 1 }}>
                    <CardContent>
                        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 700 }}>
                            Join a battle
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Your tank
                        </Typography>
                        <Stack direction="row" spacing={1.5} sx={{ mb: 2.5 }}>
                            {SWATCHES.map((s) => {
                                const selected = s.color === color;
                                return (
                                    <IconButton
                                        key={s.color}
                                        aria-label={`${s.label} tank`}
                                        aria-pressed={selected}
                                        title={s.label}
                                        onClick={() => setColor(s.color)}
                                        sx={{
                                            width: 44,
                                            height: 44,
                                            bgcolor: s.hex,
                                            border: selected ? 3 : 0,
                                            borderColor: 'primary.main',
                                            '&:hover': { bgcolor: s.hex, opacity: 0.85 },
                                        }}
                                    >
                                        {selected && <Check sx={{ color: '#fff' }} />}
                                    </IconButton>
                                );
                            })}
                        </Stack>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} component="form" onSubmit={joinRoom}>
                            <TextField
                                fullWidth
                                label="Room ID"
                                placeholder="local-dev-room"
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value)}
                                size="medium"
                            />
                            <IconButton
                                aria-label="random room"
                                title="Random room"
                                onClick={() => setRoomId(randomRoomId())}
                                sx={{ alignSelf: 'center' }}
                            >
                                <Casino />
                            </IconButton>
                            <Button type="submit" variant="contained" size="large" startIcon={<PlayArrow />} sx={{ px: 4 }}>
                                Play
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 6, textAlign: 'left' }}>
                    {FEATURES.map((f) => (
                        <Card key={f.title} sx={{ flex: 1 }}>
                            <CardContent>
                                {f.icon}
                                <Typography variant="h6" sx={{ mt: 1, fontWeight: 700 }}>
                                    {f.title}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {f.text}
                                </Typography>
                            </CardContent>
                        </Card>
                    ))}
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 5 }}>
                    Controls — <b>W/S</b> drive · <b>A/D</b> turn · <b>Space</b> fire
                </Typography>
            </Container>
        </Box>
    );
}
