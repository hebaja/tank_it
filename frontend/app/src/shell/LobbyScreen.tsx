import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import LogoutIcon from '@mui/icons-material/Logout';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { LobbyHubConnection } from '../net/LobbyHubConnection';
import type {
    GameStartedPayload,
    PlayerInfo,
    PlayerJoinedPayload,
    PlayerLeftPayload,
    RoomStatusPayload,
} from '../net/contracts';

const HUB_URL =
    import.meta.env.VITE_HUB_URL ?? 'http://localhost:8080/hubs/game';
const GAME_URL = import.meta.env.VITE_GAME_URL ?? 'http://localhost:5173';

const TANK_COLORS = [
    { value: 'blue', label: 'Blue', hex: '#1e88e5' },
    { value: 'green', label: 'Green', hex: '#43a047' },
    { value: 'red', label: 'Red', hex: '#e53935' },
    { value: 'dark', label: 'Dark', hex: '#37474f' },
] as const;

function colorHex(color: string): string {
    return TANK_COLORS.find((c) => c.value === color)?.hex ?? '#37474f';
}

function labelForColor(color: string): string {
    const match = TANK_COLORS.find((c) => c.value === color);
    return match ? match.label : color.charAt(0).toUpperCase() + color.slice(1);
}

/** Pre-join form + room box — the lobby flow previously in src/main.ts. */
export function LobbyScreen() {
    const [joined, setJoined] = useState(false);
    const [joining, setJoining] = useState(false);
    const [starting, setStarting] = useState(false);
    const [roomId, setRoomId] = useState('local-dev-room');
    const [color, setColor] = useState<string>('blue');
    const [currentRoom, setCurrentRoom] = useState('');
    const [players, setPlayers] = useState<PlayerInfo[]>([]);
    const [myConnectionId, setMyConnectionId] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Keep handlers stable across renders so on/off subscriptions pair up, and
    // always read the latest state from refs inside them.
    const hubRef = useRef<LobbyHubConnection | null>(null);
    const stateRef = useRef({ roomId, color });
    stateRef.current = { roomId, color };

    const handlePlayerJoined = useRef<(p: PlayerJoinedPayload) => void>(
        () => {},
    );
    const handlePlayerLeft = useRef<(p: PlayerLeftPayload) => void>(() => {});
    const handleMatchStarted = useRef<(p: GameStartedPayload) => void>(
        () => {},
    );

    // Stable identities for SignalR on()/off() pairing — the wrappers outlive
    // renders while the inner refs always point at the latest logic.
    const onJoined = useRef((p: PlayerJoinedPayload) =>
        handlePlayerJoined.current(p),
    );
    const onLeft = useRef((p: PlayerLeftPayload) =>
        handlePlayerLeft.current(p),
    );
    const onStarted = useRef((p: GameStartedPayload) =>
        handleMatchStarted.current(p),
    );

    const redirectToGame = () => {
        const { roomId: rid, color: c } = stateRef.current;
        if (!rid || !c) return;
        const url = `${GAME_URL}?roomId=${encodeURIComponent(rid)}&color=${encodeURIComponent(c)}`;
        window.location.href = url;
    };

    useEffect(() => {
        handlePlayerJoined.current = (payload) => {
            setPlayers((prev) => {
                if (prev.some((p) => p.connectionId === payload.connectionId))
                    return prev;
                return [
                    ...prev,
                    {
                        connectionId: payload.connectionId,
                        color: payload.color,
                    },
                ];
            });
        };
        handlePlayerLeft.current = (payload) => {
            setPlayers((prev) =>
                prev.filter((p) => p.connectionId !== payload.connectionId),
            );
        };
        handleMatchStarted.current = () => redirectToGame();

        return () => {
            const active = hubRef.current;
            if (active) {
                active.offPlayerJoined(onJoined.current);
                active.offPlayerLeft(onLeft.current);
                active.offMatchStarted(onStarted.current);
                active.stop().catch(() => {});
                hubRef.current = null;
            }
        };
        // Handlers are ref-stable; this cleanup only runs on unmount.
    }, []);

    async function joinRoom() {
        setError(null);
        const requestedRoom = roomId.trim() || 'local-dev-room';
        const requestedColor = color;
        setJoining(true);

        try {
            const conn = new LobbyHubConnection(HUB_URL);
            await conn.start();

            const status: RoomStatusPayload = await conn.joinRoom(
                requestedRoom,
                requestedColor,
            );

            const mine =
                status.players.find(
                    (p) => p.color === requestedColor && p.connectionId,
                )?.connectionId ??
                (status.players.length > 0
                    ? status.players[status.players.length - 1].connectionId
                    : '');

            conn.onPlayerJoined(onJoined.current);
            conn.onPlayerLeft(onLeft.current);
            conn.onMatchStarted(onStarted.current);

            stateRef.current = { roomId: status.roomId, color: requestedColor };

            hubRef.current = conn;
            setMyConnectionId(mine);
            setPlayers(status.players);
            setCurrentRoom(status.roomId);
            setJoined(true);
        } catch (err) {
            setError(
                `Failed to join: ${err instanceof Error ? err.message : String(err)}`,
            );
            if (hubRef.current) {
                await hubRef.current.stop().catch(() => {});
                hubRef.current = null;
            }
        } finally {
            setJoining(false);
        }
    }

    async function leaveRoom() {
        const conn = hubRef.current;
        if (!conn) return;
        try {
            await conn.leaveRoom(currentRoom || stateRef.current.roomId);
        } catch {
            // Leave failures are non-fatal — we tear down locally either way.
        } finally {
            conn.offPlayerJoined(onJoined.current);
            conn.offPlayerLeft(onLeft.current);
            conn.offMatchStarted(onStarted.current);
            await conn.stop().catch(() => {});
            hubRef.current = null;
            setJoined(false);
            setCurrentRoom('');
            setPlayers([]);
            setMyConnectionId('');
            setError(null);
        }
    }

    function startMatch() {
        const conn = hubRef.current;
        if (!conn || !currentRoom) return;
        setStarting(true);
        conn.startMatch(currentRoom)
            .catch(() => setError('Failed to start game'))
            .finally(() => setStarting(false));
    }

    return (
        <Stack spacing={2.5}>
            <Stack spacing={0.5} sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    {joined ? `Room: ${currentRoom}` : 'Ready to roll?'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {joined
                        ? 'Waiting for players… share the room ID to team up.'
                        : 'Enter a room ID, pick your tank color, then join.'}
                </Typography>
            </Stack>

            {error && <Alert severity="error">{error}</Alert>}

            {!joined ? (
                <Card variant="outlined">
                    <CardContent>
                        <Stack spacing={2.5}>
                            <TextField
                                id="room-id"
                                label="Room ID"
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') void joinRoom();
                                }}
                                fullWidth
                            />
                            <TextField
                                id="color"
                                select
                                label="Tank color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') void joinRoom();
                                }}
                                fullWidth
                            >
                                {TANK_COLORS.map((c) => (
                                    <MenuItem key={c.value} value={c.value}>
                                        <Box
                                            component="span"
                                            sx={{
                                                display: 'inline-block',
                                                width: 14,
                                                height: 14,
                                                borderRadius: '3px',
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                bgcolor: c.hex,
                                                mr: 1.5,
                                                verticalAlign: 'middle',
                                            }}
                                        />
                                        {c.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <Button
                                variant="contained"
                                size="large"
                                onClick={() => void joinRoom()}
                                disabled={joining}
                                endIcon={
                                    joining ? (
                                        <CircularProgress
                                            size={16}
                                            color="inherit"
                                        />
                                    ) : undefined
                                }
                            >
                                {joining ? 'Joining…' : 'Join'}
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
            ) : (
                <Card variant="outlined">
                    <CardContent>
                        <Stack spacing={2}>
                            <List disablePadding>
                                {players.map((p) => (
                                    <ListItem
                                        key={p.connectionId}
                                        divider
                                        disableGutters
                                        sx={{ px: 0 }}
                                    >
                                        <ListItemAvatar sx={{ minWidth: 44 }}>
                                            <Box
                                                sx={{
                                                    width: 22,
                                                    height: 22,
                                                    borderRadius: '4px',
                                                    border: '2px solid',
                                                    borderColor: 'divider',
                                                    bgcolor: colorHex(p.color),
                                                }}
                                            />
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={
                                                <Stack
                                                    direction="row"
                                                    spacing={1}
                                                    sx={{
                                                        alignItems: 'center',
                                                    }}
                                                >
                                                    <Typography
                                                        variant="body1"
                                                        sx={{ fontWeight: 500 }}
                                                    >
                                                        {labelForColor(p.color)}
                                                    </Typography>
                                                    {p.connectionId ===
                                                        myConnectionId && (
                                                        <Chip
                                                            label="you"
                                                            size="small"
                                                            color="primary"
                                                            variant="outlined"
                                                        />
                                                    )}
                                                </Stack>
                                            }
                                        />
                                    </ListItem>
                                ))}
                            </List>

                            <Button
                                variant="contained"
                                size="large"
                                startIcon={
                                    starting ? (
                                        <CircularProgress
                                            size={16}
                                            color="inherit"
                                        />
                                    ) : (
                                        <PlayArrowIcon />
                                    )
                                }
                                onClick={startMatch}
                                disabled={starting}
                            >
                                {starting ? 'Starting…' : 'Start Game'}
                            </Button>
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<LogoutIcon />}
                                onClick={() => void leaveRoom()}
                            >
                                Leave room
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
            )}
        </Stack>
    );
}
