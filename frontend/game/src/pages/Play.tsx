import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import StartGame from '../game/main';
import { useSession } from '../session';

export default function Play() {
    const { roomId } = useParams();
    const { color } = useSession();
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }
        const game = StartGame(containerRef.current, {
            roomId: roomId ?? 'local-dev-room',
            localColor: color,
        });
        return () => {
            game.destroy(true);
        };
    }, [roomId, color]);

    return (
        <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box
                component="nav"
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2,
                    py: 0.5,
                    borderBottom: 1,
                    borderColor: 'divider',
                }}
            >
                <Link to="/">← Lobby</Link>
                <Typography variant="body2" color="text.secondary">
                    Room: {roomId}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Tank: {color}
                </Typography>
            </Box>
            <Box
                ref={containerRef}
                id="game-container"
                sx={{
                    flex: 1,
                    minHeight: 0,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                }}
            />
        </Box>
    );
}
