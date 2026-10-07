import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
    const [roomId, setRoomId] = useState('');
    const navigate = useNavigate();

    const joinRoom = (e: FormEvent) => {
        e.preventDefault();
        const target = roomId.trim() || 'local-dev-room';
        navigate(`/play/${encodeURIComponent(target)}`);
    };

    return (
        <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
            <h1>Tank It!</h1>
            <p>Landing placeholder — auth, matchmaking, rankings go here.</p>
            <form onSubmit={joinRoom}>
                <label htmlFor="room-id">Room ID</label>{' '}
                <input
                    id="room-id"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="local-dev-room"
                />{' '}
                <button type="submit">Play</button>
            </form>
        </main>
    );
}
