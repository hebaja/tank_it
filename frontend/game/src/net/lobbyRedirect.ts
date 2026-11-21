import { sessionConfig } from './sessionConfig';

const LOBBY_URL = import.meta.env.VITE_LOBBY_URL ?? 'http://localhost:3000';

export function redirectToLobby(): void {
    const url = new URL(LOBBY_URL);
    url.searchParams.set('roomId', sessionConfig.roomId);
    url.searchParams.set('color', sessionConfig.localColor);
    url.searchParams.set('mode', sessionConfig.mode);
    window.location.assign(url.toString());
}
