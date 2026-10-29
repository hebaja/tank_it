// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

type PlayerJoined = { connectionId: string; color: string };
type PlayerLeft = { connectionId: string };
type MatchStarted = { roomId: string };

const lobbyMock = vi.hoisted(() => {
    const callbacks: {
        playerJoined?: (payload: PlayerJoined) => void;
        playerLeft?: (payload: PlayerLeft) => void;
        matchStarted?: (payload: MatchStarted) => void;
    } = {};
    const connection = {
        start: vi.fn(),
        stop: vi.fn(),
        joinRoom: vi.fn(),
        leaveRoom: vi.fn(),
        startMatch: vi.fn(),
        onPlayerJoined: vi.fn((callback: (payload: PlayerJoined) => void) => {
            callbacks.playerJoined = callback;
        }),
        offPlayerJoined: vi.fn(),
        onPlayerLeft: vi.fn((callback: (payload: PlayerLeft) => void) => {
            callbacks.playerLeft = callback;
        }),
        offPlayerLeft: vi.fn(),
        onMatchStarted: vi.fn((callback: (payload: MatchStarted) => void) => {
            callbacks.matchStarted = callback;
        }),
        offMatchStarted: vi.fn(),
    };

    return {
        callbacks,
        connection,
        LobbyHubConnection: vi.fn(() => connection),
    };
});

vi.mock('./net/LobbyHubConnection', () => ({
    LobbyHubConnection: lobbyMock.LobbyHubConnection,
}));

const initialRoom = {
    roomId: 'room-1',
    players: [{ connectionId: 'mine', color: 'blue' }],
    randomBarrelPositions: [],
    roomCreatedAt: 123,
};

async function loadLobby() {
    document.body.innerHTML = `
        <section id="join-form">
            <input id="room-id" value="room-1" />
            <select id="color"><option value="blue" selected>Blue</option></select>
            <button id="join-btn">Join</button>
        </section>
        <section id="room-box" class="hidden">
            <span id="room-id-display"></span>
            <ul id="player-list"></ul>
            <button id="start-btn" class="hidden">Start Game</button>
            <button id="leave-btn">Leave</button>
        </section>
        <p id="error" class="hidden"></p>
    `;
    vi.resetModules();
    // @ts-expect-error Vite needs the extension to load TypeScript main.ts instead of legacy main.js.
    await import('./main.ts');
}

describe('lobby UI', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        Object.keys(lobbyMock.callbacks).forEach((key) => {
            delete lobbyMock.callbacks[key as keyof typeof lobbyMock.callbacks];
        });
        lobbyMock.connection.start.mockResolvedValue(undefined);
        lobbyMock.connection.stop.mockResolvedValue(undefined);
        lobbyMock.connection.leaveRoom.mockResolvedValue(undefined);
        lobbyMock.connection.startMatch.mockResolvedValue(undefined);
        lobbyMock.connection.joinRoom.mockResolvedValue(initialRoom);
        await loadLobby();
    });

    it('joins and renders the room and local player', async () => {
        document.getElementById('join-btn')!.click();

        await vi.waitFor(() =>
            expect(lobbyMock.connection.joinRoom).toHaveBeenCalledWith(
                'room-1',
                'blue',
            ),
        );
        await vi.waitFor(() =>
            expect(
                document.getElementById('room-id-display')?.textContent,
            ).toBe('room-1'),
        );

        expect(lobbyMock.connection.joinRoom).toHaveBeenCalledWith(
            'room-1',
            'blue',
        );
        expect(
            document.querySelector('#player-list .player-name')?.textContent,
        ).toBe('Blue');
        expect(
            document.querySelector('#player-list .player-you')?.textContent,
        ).toBe(' (you)');
        expect(
            document.getElementById('join-form')?.classList.contains('hidden'),
        ).toBe(true);
        expect(
            document.getElementById('start-btn')?.classList.contains('hidden'),
        ).toBe(false);
    });

    it('applies player join and leave events, then cleans up on leave', async () => {
        document.getElementById('join-btn')!.click();
        await vi.waitFor(() =>
            expect(lobbyMock.callbacks.playerJoined).toBeDefined(),
        );

        lobbyMock.callbacks.playerJoined?.({
            connectionId: 'other',
            color: 'red',
        });
        expect(document.querySelectorAll('#player-list li')).toHaveLength(2);
        expect(
            document.querySelector(
                '#player-list li[data-conn="other"] .player-name',
            )?.textContent,
        ).toBe('Red');

        lobbyMock.callbacks.playerLeft?.({ connectionId: 'other' });
        expect(document.querySelectorAll('#player-list li')).toHaveLength(1);

        document.getElementById('leave-btn')!.click();
        await vi.waitFor(() =>
            expect(
                document
                    .getElementById('join-form')
                    ?.classList.contains('hidden'),
            ).toBe(false),
        );

        expect(lobbyMock.connection.leaveRoom).toHaveBeenCalledWith('room-1');
        expect(lobbyMock.connection.offPlayerJoined).toHaveBeenCalled();
        expect(lobbyMock.connection.offPlayerLeft).toHaveBeenCalled();
        expect(lobbyMock.connection.offMatchStarted).toHaveBeenCalled();
        expect(lobbyMock.connection.stop).toHaveBeenCalled();
        expect(document.querySelectorAll('#player-list li')).toHaveLength(0);
    });

    it('shows a join error and restores the button when connection fails', async () => {
        lobbyMock.connection.joinRoom.mockRejectedValue(new Error('room full'));

        document.getElementById('join-btn')!.click();

        await vi.waitFor(() =>
            expect(document.getElementById('error')?.textContent).toContain(
                'room full',
            ),
        );
        expect(document.getElementById('join-btn')?.textContent).toBe('Join');
        expect(
            document.getElementById('join-form')?.classList.contains('hidden'),
        ).toBe(false);
        expect(lobbyMock.connection.stop).toHaveBeenCalled();
    });

    it('shows a start error and leaves the joined room visible', async () => {
        lobbyMock.connection.startMatch.mockRejectedValue(new Error('offline'));
        document.getElementById('join-btn')!.click();
        await vi.waitFor(() =>
            expect(
                document.getElementById('room-id-display')?.textContent,
            ).toBe('room-1'),
        );

        document.getElementById('start-btn')!.click();
        await vi.waitFor(() =>
            expect(document.getElementById('error')?.textContent).toBe(
                'Failed to start game',
            ),
        );
        expect(
            document.getElementById('room-box')?.classList.contains('hidden'),
        ).toBe(false);
    });
});
