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
    GameMode,
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

const GAME_MODES = [
    { value: 'single', label: 'Single match' },
    { value: 'championship', label: 'Championship' },
] as const;

function colorHex(color: string): string {
    return TANK_COLORS.find((c) => c.value === color)?.hex ?? '#37474f';
}

function labelForColor(color: string): string {
    const match = TANK_COLORS.find((c) => c.value === color);
    return match ? match.label : color.charAt(0).toUpperCase() + color.slice(1);
}

function labelForMode(mode: GameMode): string {
    return GAME_MODES.find((m) => m.value === mode)?.label ?? mode;
}

function readQuery() {
    const params = new URLSearchParams(window.location.search);
    const colorParam = params.get('color');
    const color = TANK_COLORS.some((c) => c.value === colorParam)
        ? (colorParam as string)
        : 'blue';
    return {
        roomId: params.get('roomId') ?? 'local-dev-room',
        color,
        mode:
            params.get('mode') === 'championship'
                ? ('championship' as const)
                : ('single' as const),
    };
}

/** One row per tank color; own connection is the representative row. */
function onePerColor(
    players: PlayerInfo[],
    ownConnectionId: string,
): PlayerInfo[] {
    const byColor = new Map<string, PlayerInfo>();
    for (const player of players) {
        if (!player.color) continue;
        const existing = byColor.get(player.color);
        if (!existing) {
            byColor.set(player.color, player);
        } else if (player.connectionId === ownConnectionId) {
            byColor.set(player.color, player);
        }
    }
    return [...byColor.values()];
}

/** Pre-join form + room box — the lobby flow previously in src/main.ts. */
export function LobbyScreen() {
    const initial = useRef(readQuery()).current;
    const [joined, setJoined] = useState(false);
    const [joining, setJoining] = useState(false);
    const [starting, setStarting] = useState(false);
    const [roomId, setRoomId] = useState(initial.roomId);
    const [color, setColor] = useState<string>(initial.color);
    const [mode, setMode] = useState<GameMode>(initial.mode);
    const [currentRoom, setCurrentRoom] = useState('');
    const [championshipId, setChampionshipId] = useState('');
    const [players, setPlayers] = useState<PlayerInfo[]>([]);
    const [myConnectionId, setMyConnectionId] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Keep handlers stable across renders so on/off subscriptions pair up, and
    // always read the latest state from refs inside them.
    const hubRef = useRef<LobbyHubConnection | null>(null);
    const stateRef = useRef({
        roomId,
        color,
        championshipId,
        mode,
    });
    stateRef.current = { roomId, color, championshipId, mode };

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
        const current = stateRef.current;
        if (!current.roomId || !current.color) return;
        const params = new URLSearchParams({
            roomId: current.roomId,
            color: current.color,
            mode: current.mode,
        });
        if (current.championshipId)
            params.set('champId', current.championshipId);
        window.location.href = `${GAME_URL}?${params.toString()}`;
    };

    useEffect(() => {
        handlePlayerJoined.current = (payload) => {
            setPlayers((prev) => {
                if (prev.some((p) => p.connectionId === payload.connectionId))
                    return prev;
                if (prev.some((p) => p.color === payload.color)) {
                    if (payload.connectionId !== myConnectionId) return prev;
                    return prev.map((p) =>
                        p.color === payload.color ? payload : p,
                    );
                }
                return [...prev, payload];
            });
        };
        handlePlayerLeft.current = (payload) => {
            setPlayers((prev) => {
                const removed = prev.find(
                    (p) => p.connectionId === payload.connectionId,
                );
                const next = prev.filter(
                    (p) => p.connectionId !== payload.connectionId,
                );
                // Same-color seats can exist briefly; keep a placeholder row
                // so the roster still shows the color after one peer leaves.
                if (removed && next.some((p) => p.color === removed.color))
                    return next;
                return next;
            });
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
        const requestedMode = mode;
        setJoining(true);

        try {
            const conn = new LobbyHubConnection(HUB_URL);
            await conn.start();

            const status: RoomStatusPayload = await conn.joinRoom(
                requestedRoom,
                requestedColor,
                requestedMode,
            );

            const mine =
                status.connectionId ||
                status.players.find(
                    (p) => p.color === requestedColor && p.connectionId,
                )?.connectionId ||
                '';
            const activeMode: GameMode = status.mode ?? requestedMode;
            const activeChampionshipId = status.championshipId ?? '';

            conn.onPlayerJoined(onJoined.current);
            conn.onPlayerLeft(onLeft.current);
            conn.onMatchStarted(onStarted.current);

            stateRef.current = {
                roomId: status.roomId,
                color: requestedColor,
                championshipId: activeChampionshipId,
                mode: activeMode,
            };

            hubRef.current = conn;
            setMyConnectionId(mine);
            setPlayers(onePerColor(status.players ?? [], mine));
            setCurrentRoom(status.roomId);
            setChampionshipId(activeChampionshipId);
            setMode(activeMode);
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
            await conn.leaveRoom(
                currentRoom || stateRef.current.roomId,
                championshipId || stateRef.current.championshipId,
            );
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
            setChampionshipId('');
            setPlayers([]);
            setMyConnectionId('');
            setMode(initial.mode);
            setError(null);
        }
    }

    function startMatch() {
        const conn = hubRef.current;
        if (!conn || !currentRoom) return;
        setStarting(true);
        conn.startMatch(
            currentRoom,
            championshipId || stateRef.current.championshipId,
        )
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
                        ? `Waiting for players… ${labelForMode(mode)}.`
                        : 'Enter a room ID, pick your tank color and mode, then join.'}
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
                            <TextField
                                id="mode"
                                select
                                label="Game mode"
                                value={mode}
                                onChange={(e) =>
                                    setMode(e.target.value as GameMode)
                                }
                                fullWidth
                            >
                                {GAME_MODES.map((m) => (
                                    <MenuItem key={m.value} value={m.value}>
                                        {m.label}
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
                                        key={p.color}
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
