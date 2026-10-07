import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import StartGame from '../game/main';

export default function Play() {
    const { roomId } = useParams();
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }
        const game = StartGame(containerRef.current, {
            roomId: roomId ?? 'local-dev-room',
        });
        return () => {
            game.destroy(true);
        };
    }, [roomId]);

    return (
        <main>
            <nav style={{ padding: 8 }}>
                <Link to="/">← Lobby</Link> | Room: {roomId}
            </nav>
            <div ref={containerRef} id="game-container" />
        </main>
    );
}
