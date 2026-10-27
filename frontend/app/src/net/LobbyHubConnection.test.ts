import { beforeEach, describe, expect, it, vi } from 'vitest';

const signalRMock = vi.hoisted(() => {
    const connection = {
        state: 1,
        start: vi.fn(),
        stop: vi.fn(),
        invoke: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
    };
    const builder = {
        withUrl: vi.fn(),
        withAutomaticReconnect: vi.fn(),
        build: vi.fn(() => connection),
    };
    builder.withUrl.mockReturnValue(builder);
    builder.withAutomaticReconnect.mockReturnValue(builder);

    return { connection, builder, builderCtor: vi.fn(() => builder) };
});

vi.mock('@microsoft/signalr', () => ({
    HubConnectionBuilder: signalRMock.builderCtor,
}));

import { LobbyHubConnection } from './LobbyHubConnection';

describe('LobbyHubConnection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        signalRMock.connection.start.mockResolvedValue(undefined);
        signalRMock.connection.stop.mockResolvedValue(undefined);
        signalRMock.connection.invoke.mockResolvedValue({
            roomId: 'room-1',
            players: [],
            randomBarrelPositions: [],
            roomCreatedAt: 123,
        });
    });

    it('configures the supplied hub URL and automatic reconnect', () => {
        new LobbyHubConnection('http://example.test/hubs/game');

        expect(signalRMock.builder.withUrl).toHaveBeenCalledWith(
            'http://example.test/hubs/game',
        );
        expect(signalRMock.builder.withAutomaticReconnect).toHaveBeenCalled();
    });

    it('starts once until stopped, then can start again', async () => {
        const hub = new LobbyHubConnection();

        await hub.start();
        await hub.start();
        expect(signalRMock.connection.start).toHaveBeenCalledTimes(1);

        await hub.stop();
        await hub.start();
        expect(signalRMock.connection.start).toHaveBeenCalledTimes(2);
    });

    it('invokes lobby operations with the expected SignalR method names', async () => {
        const hub = new LobbyHubConnection();

        const status = await hub.joinRoom('room-1', 'blue');
        await hub.leaveRoom('room-1');
        await hub.startMatch('room-1');

        expect(status.roomId).toBe('room-1');
        expect(signalRMock.connection.invoke).toHaveBeenNthCalledWith(
            1,
            'JoinRoom',
            'room-1',
            'blue',
        );
        expect(signalRMock.connection.invoke).toHaveBeenNthCalledWith(
            2,
            'LeaveRoom',
            'room-1',
        );
        expect(signalRMock.connection.invoke).toHaveBeenNthCalledWith(
            3,
            'StartMatch',
            'room-1',
        );
    });

    it('registers and removes lobby event handlers', () => {
        const hub = new LobbyHubConnection();
        const onJoined = vi.fn();
        const onLeft = vi.fn();
        const onStarted = vi.fn();

        hub.onPlayerJoined(onJoined);
        hub.onPlayerLeft(onLeft);
        hub.onMatchStarted(onStarted);
        hub.offPlayerJoined(onJoined);
        hub.offPlayerLeft(onLeft);
        hub.offMatchStarted(onStarted);

        expect(signalRMock.connection.on).toHaveBeenCalledWith(
            'PlayerJoined',
            onJoined,
        );
        expect(signalRMock.connection.off).toHaveBeenCalledWith(
            'PlayerJoined',
            onJoined,
        );
        expect(signalRMock.connection.on).toHaveBeenCalledWith(
            'PlayerLeft',
            onLeft,
        );
        expect(signalRMock.connection.off).toHaveBeenCalledWith(
            'PlayerLeft',
            onLeft,
        );
        expect(signalRMock.connection.on).toHaveBeenCalledWith(
            'MatchStarted',
            onStarted,
        );
        expect(signalRMock.connection.off).toHaveBeenCalledWith(
            'MatchStarted',
            onStarted,
        );
    });
});
