import { beforeEach, describe, expect, it, vi } from 'vitest';

const signalRMock = vi.hoisted(() => {
    const connection = {
        state: 1,
        start: vi.fn(),
        stop: vi.fn(),
        send: vi.fn(),
        invoke: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
    };
    const builder = {
        withUrl: vi.fn(),
        withAutomaticReconnect: vi.fn(),
        build: vi.fn(),
    };
    builder.withUrl.mockReturnValue(builder);
    builder.withAutomaticReconnect.mockReturnValue(builder);
    builder.build.mockReturnValue(connection);

    return {
        connection,
        builder,
        builderCtor: vi.fn(() => builder),
        HubConnectionState: {
            Disconnected: 0,
            Connected: 1,
        },
    };
});

vi.mock('@microsoft/signalr', () => ({
    HubConnectionBuilder: signalRMock.builderCtor,
    HubConnectionState: signalRMock.HubConnectionState,
}));

import type {
    ProjectilePayload,
    ProjectilesCollidePayload,
    RoomJoinedPayload,
    TankInfoPayload,
} from './contracts';
import { GameHubConnection } from './GameHubConnection';

const payload: ProjectilePayload = {
    roomId: 'room-1',
    ownerId: 'blue',
    projectileId: 'projectile-1',
    origin: { x: 10, y: 20 },
    angle: 90,
    color: 'blue',
    timestamp: 111,
    sequence: 1,
};

const collision: ProjectilesCollidePayload = {
    projectileA: payload,
    projectileB: {
        ...payload,
        ownerId: 'red',
        projectileId: 'projectile-2',
        color: 'red',
    },
    timestamp: 112,
};

const fireFail: TankInfoPayload = {
    roomId: 'room-1',
    color: 'blue',
};

const roomJoined: RoomJoinedPayload = {
    connectionId: 'connection-a',
    roomId: 'room-1',
    roomCreatedAt: 100,
    players: [],
    randomBarrelPositions: [],
    deathWallStep: -1,
};

describe('GameHubConnection projectile lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        signalRMock.connection.state = signalRMock.HubConnectionState.Connected;
        signalRMock.connection.start.mockResolvedValue(undefined);
        signalRMock.connection.stop.mockResolvedValue(undefined);
        signalRMock.connection.send.mockResolvedValue(undefined);
        signalRMock.connection.invoke.mockResolvedValue(roomJoined);
    });

    it('sends the fire payload on ProjectileFire', () => {
        const hub = new GameHubConnection();

        hub.sendProjectileFire(payload);

        expect(signalRMock.connection.send).toHaveBeenCalledWith(
            'ProjectileFire',
            payload,
        );
    });

    it('sends the destroy payload on ProjectileDestroy', () => {
        const hub = new GameHubConnection();

        hub.sendProjectileDestroy(payload);

        expect(signalRMock.connection.send).toHaveBeenCalledWith(
            'ProjectileDestroy',
            payload,
        );
    });

    it('sends the collision payload on ProjectilesCollide', () => {
        const hub = new GameHubConnection();

        hub.sendProjectilesCollide(collision);

        expect(signalRMock.connection.send).toHaveBeenCalledWith(
            'ProjectilesCollide',
            collision,
        );
    });

    it('sends the fire fail payload on ProjectileFireFail', () => {
        const hub = new GameHubConnection();

        hub.sendProjectileFireFail(fireFail);

        expect(signalRMock.connection.send).toHaveBeenCalledWith(
            'ProjectileFireFail',
            fireFail,
        );
    });

    it('does not send while disconnected', () => {
        signalRMock.connection.state =
            signalRMock.HubConnectionState.Disconnected;
        const hub = new GameHubConnection();

        hub.sendProjectileFire(payload);
        hub.sendProjectileDestroy(payload);
        hub.sendProjectilesCollide(collision);
        hub.sendProjectileFireFail(fireFail);

        expect(signalRMock.connection.send).not.toHaveBeenCalled();
    });

    it('logs a warning when a send fails', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        signalRMock.connection.send.mockRejectedValueOnce(new Error('boom'));
        const hub = new GameHubConnection();

        hub.sendProjectileFire(payload);

        await vi.waitFor(() => expect(warn).toHaveBeenCalled());
        warn.mockRestore();
    });

    it('subscribes and unsubscribes to the projectile events', () => {
        const hub = new GameHubConnection();
        const onFired = vi.fn();
        const onDestroyed = vi.fn();
        const onCollided = vi.fn();

        hub.onProjectileFired(onFired);
        hub.onProjectileDestroyed(onDestroyed);
        hub.onProjectilesCollided(onCollided);
        hub.offProjectileFired(onFired);
        hub.offProjectileDestroyed(onDestroyed);
        hub.offProjectilesCollided(onCollided);

        expect(signalRMock.connection.on).toHaveBeenCalledWith(
            'ProjectileFired',
            onFired,
        );
        expect(signalRMock.connection.on).toHaveBeenCalledWith(
            'ProjectileDestroyed',
            onDestroyed,
        );
        expect(signalRMock.connection.on).toHaveBeenCalledWith(
            'ProjectilesCollided',
            onCollided,
        );
        expect(signalRMock.connection.off).toHaveBeenCalledWith(
            'ProjectileFired',
            onFired,
        );
        expect(signalRMock.connection.off).toHaveBeenCalledWith(
            'ProjectileDestroyed',
            onDestroyed,
        );
        expect(signalRMock.connection.off).toHaveBeenCalledWith(
            'ProjectilesCollided',
            onCollided,
        );
    });

    it('subscribes and unsubscribes to the fire fail event', () => {
        const hub = new GameHubConnection();
        const onFailed = vi.fn();

        hub.onProjectileFireFailed(onFailed);
        hub.offProjectileFireFailed(onFailed);

        expect(signalRMock.connection.on).toHaveBeenCalledWith(
            'ProjectileFireFailed',
            onFailed,
        );
        expect(signalRMock.connection.off).toHaveBeenCalledWith(
            'ProjectileFireFailed',
            onFailed,
        );
    });

    it('stores the connection id returned by JoinRoom', async () => {
        const hub = new GameHubConnection();

        expect(hub.getConnectionId()).toBeNull();

        const joined = await hub.joinRoom('room-1', 'blue');

        expect(joined).toBe(roomJoined);
        expect(hub.getConnectionId()).toBe('connection-a');
        expect(signalRMock.connection.invoke).toHaveBeenCalledWith(
            'JoinRoom',
            'room-1',
            'blue',
        );
    });

    it('starts only once and starts again after stop', async () => {
        const hub = new GameHubConnection();

        await hub.start();
        await hub.start();
        expect(signalRMock.connection.start).toHaveBeenCalledTimes(1);

        await hub.stop();
        await hub.start();
        expect(signalRMock.connection.start).toHaveBeenCalledTimes(2);
    });
});
