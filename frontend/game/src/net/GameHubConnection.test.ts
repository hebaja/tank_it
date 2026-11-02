import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HubConnectionState } from '@microsoft/signalr';
import type {
    ProjectilePayload,
    ProjectilesCollidePayload,
    RoomJoinedPayload,
} from './contracts';
import { GameHubConnection } from './GameHubConnection';

/**
 * Minimal stand-in for @microsoft/signalr: the wrapper under test only touches
 * builder/start/stop/invoke/send/on/off plus the connection state.
 */
const fakeSignalR = vi.hoisted(() => {
    class FakeConnection {
        /** Hub URL handed to HubConnectionBuilder.withUrl(). */
        url = '';
        state = 'Disconnected';
        startCalls = 0;
        stopCalls = 0;
        invocations: { method: string; args: unknown[] }[] = [];
        sends: { method: string; args: unknown[] }[] = [];
        handlers = new Map<string, Set<(payload: unknown) => void>>();
        /** Value `invoke` resolves with — RoomJoined in practice. */
        invokeResult: unknown = undefined;
        failNextSend: Error | null = null;

        start(): Promise<void> {
            this.startCalls += 1;
            this.state = 'Connected';
            return Promise.resolve();
        }

        stop(): Promise<void> {
            this.stopCalls += 1;
            this.state = 'Disconnected';
            return Promise.resolve();
        }

        invoke(method: string, ...args: unknown[]): Promise<unknown> {
            this.invocations.push({ method, args });
            return Promise.resolve(this.invokeResult);
        }

        send(method: string, ...args: unknown[]): Promise<void> {
            if (this.failNextSend) {
                const error = this.failNextSend;
                this.failNextSend = null;
                return Promise.reject(error);
            }
            this.sends.push({ method, args });
            return Promise.resolve();
        }

        on(event: string, handler: (payload: unknown) => void): void {
            if (!this.handlers.has(event)) this.handlers.set(event, new Set());
            this.handlers.get(event)?.add(handler);
        }

        off(event: string, handler: (payload: unknown) => void): void {
            this.handlers.get(event)?.delete(handler);
        }

        emit(event: string, payload: unknown): void {
            this.handlers.get(event)?.forEach((handler) => handler(payload));
        }
    }

    const instances: FakeConnection[] = [];

    let pendingConnection: FakeConnection | null = null;

    class FakeConnectionBuilder {
        withUrl(url: string): this {
            const connection = new FakeConnection();
            connection.url = url;
            pendingConnection = connection;
            return this;
        }

        withAutomaticReconnect(): this {
            return this;
        }

        build(): FakeConnection {
            const connection = pendingConnection ?? new FakeConnection();
            pendingConnection = null;
            instances.push(connection);
            return connection;
        }
    }

    return { instances, FakeConnectionBuilder };
});

vi.mock('@microsoft/signalr', () => ({
    HubConnectionBuilder: fakeSignalR.FakeConnectionBuilder,
    HubConnectionState: {
        Disconnected: 'Disconnected',
        Connecting: 'Connecting',
        Connected: 'Connected',
        Reconnecting: 'Reconnecting',
    },
}));

function connection() {
    const instance = fakeSignalR.instances[fakeSignalR.instances.length - 1];
    if (!instance) throw new Error('no hub connection was built');
    return instance;
}

const projectile: ProjectilePayload = {
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
    projectileA: projectile,
    projectileB: {
        ...projectile,
        ownerId: 'red',
        projectileId: 'projectile-2',
        color: 'red',
    },
    timestamp: 112,
};

const roomJoined: RoomJoinedPayload = {
    connectionId: 'connection-a',
    roomId: 'room-1',
    roomCreatedAt: 100,
    players: [],
    randomBarrelPositions: [],
    deathWallStep: -1,
};

describe('GameHubConnection', () => {
    beforeEach(() => {
        fakeSignalR.instances.length = 0;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('connects once per start and reconnects after stop', async () => {
        const hub = new GameHubConnection('http://localhost:8080/hubs/game');
        expect(hub.state).toBe(HubConnectionState.Disconnected);
        expect(connection().url).toBe('http://localhost:8080/hubs/game');

        // SignalR start() is not idempotent — the wrapper must memoize it.
        await Promise.all([hub.start(), hub.start()]);
        await hub.start();
        expect(connection().startCalls).toBe(1);
        expect(hub.state).toBe(HubConnectionState.Connected);

        await hub.stop();
        expect(connection().stopCalls).toBe(1);
        expect(hub.state).toBe(HubConnectionState.Disconnected);

        await hub.start();
        expect(connection().startCalls).toBe(2);
    });

    it('invokes JoinRoom/LeaveRoom with the room and color', async () => {
        const hub = new GameHubConnection();
        const status = {
            roomId: 'squad-42',
            players: [{ connectionId: 'conn-me', color: 'red' }],
            roomCreatedAt: 1_700_000_000_000,
            randomBarrelPositions: [],
        };
        connection().invokeResult = status;

        await expect(hub.joinRoom('squad-42', 'red')).resolves.toEqual(status);
        await hub.leaveRoom('squad-42');

        expect(connection().invocations).toEqual([
            { method: 'JoinRoom', args: ['squad-42', 'red'] },
            { method: 'LeaveRoom', args: ['squad-42'] },
        ]);
    });

    it('stores the connection id returned by JoinRoom', async () => {
        const hub = new GameHubConnection();
        connection().invokeResult = roomJoined;

        expect(hub.getConnectionId()).toBeNull();

        const joined = await hub.joinRoom('room-1', 'blue');

        expect(joined).toBe(roomJoined);
        expect(hub.getConnectionId()).toBe('connection-a');
    });

    it('drops sends while the connection is down and forwards them once connected', async () => {
        const hub = new GameHubConnection();
        const move = {
            roomId: 'squad-42',
            playerId: 'pilot-1',
            position: { x: 12, y: 34 },
            rotation: 1.5,
            timestamp: 1_700_000_000_000,
            sequence: 7,
        };

        hub.sendTankMove(move);
        hub.sendStartMatch('squad-42');
        expect(connection().sends).toEqual([]);

        await hub.start();

        hub.sendTankMove(move);
        hub.sendStartMatch('squad-42');
        expect(connection().sends).toEqual([
            { method: 'TankMove', args: [move] },
            { method: 'StartMatch', args: ['squad-42'] },
        ]);
    });

    it('warns instead of throwing when a send fails', async () => {
        const warn = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        const hub = new GameHubConnection();
        await hub.start();
        connection().failNextSend = new Error('socket closed');

        hub.sendMatchEnd({
            roomId: 'squad-42',
            placements: [],
        });

        await vi.waitFor(() =>
            expect(warn).toHaveBeenCalledWith(
                expect.stringContaining('MatchEnd send failed'),
                expect.any(Error),
            ),
        );
        expect(connection().sends).toEqual([]);
    });

    it('routes hub events to the subscribed handler until it unsubscribes', async () => {
        const hub = new GameHubConnection();
        const onMoved = vi.fn();
        const onStarted = vi.fn();

        hub.onTankMoved(onMoved);
        hub.onMatchStarted(onStarted);

        connection().emit('TankMoved', { sequence: 3 });
        connection().emit('MatchStarted', { roomId: 'squad-42' });
        expect(onMoved).toHaveBeenCalledWith({ sequence: 3 });
        expect(onStarted).toHaveBeenCalledWith({ roomId: 'squad-42' });

        hub.offTankMoved(onMoved);
        hub.offMatchStarted(onStarted);
        connection().emit('TankMoved', { sequence: 4 });
        connection().emit('MatchStarted', { roomId: 'squad-42' });
        expect(onMoved).toHaveBeenCalledTimes(1);
        expect(onStarted).toHaveBeenCalledTimes(1);
    });

    describe('projectile lifecycle', () => {
        it('sends the fire payload on ProjectileFire', async () => {
            const hub = new GameHubConnection();
            await hub.start();

            hub.sendProjectileFire(projectile);

            expect(connection().sends).toEqual([
                { method: 'ProjectileFire', args: [projectile] },
            ]);
        });

        it('sends the destroy payload on ProjectileDestroy', async () => {
            const hub = new GameHubConnection();
            await hub.start();

            hub.sendProjectileDestroy(projectile);

            expect(connection().sends).toEqual([
                { method: 'ProjectileDestroy', args: [projectile] },
            ]);
        });

        it('sends the collision payload on ProjectilesCollide', async () => {
            const hub = new GameHubConnection();
            await hub.start();

            hub.sendProjectilesCollide(collision);

            expect(connection().sends).toEqual([
                { method: 'ProjectilesCollide', args: [collision] },
            ]);
        });

        it('does not send projectile events while disconnected', () => {
            const hub = new GameHubConnection();

            hub.sendProjectileFire(projectile);
            hub.sendProjectileDestroy(projectile);
            hub.sendProjectilesCollide(collision);

            expect(connection().sends).toEqual([]);
        });

        it('logs a warning when a projectile send fails', async () => {
            const warn = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => undefined);
            const hub = new GameHubConnection();
            await hub.start();
            connection().failNextSend = new Error('boom');

            hub.sendProjectileFire(projectile);

            await vi.waitFor(() =>
                expect(warn).toHaveBeenCalledWith(
                    expect.stringContaining('ProjectileFire send failed'),
                    expect.any(Error),
                ),
            );
            expect(connection().sends).toEqual([]);
        });

        it('subscribes and unsubscribes to the projectile events', () => {
            const hub = new GameHubConnection();
            const onFired = vi.fn();
            const onDestroyed = vi.fn();
            const onCollided = vi.fn();

            hub.onProjectileFired(onFired);
            hub.onProjectileDestroyed(onDestroyed);
            hub.onProjectilesCollided(onCollided);

            connection().emit('ProjectileFired', projectile);
            connection().emit('ProjectileDestroyed', projectile);
            connection().emit('ProjectilesCollided', collision);
            expect(onFired).toHaveBeenCalledWith(projectile);
            expect(onDestroyed).toHaveBeenCalledWith(projectile);
            expect(onCollided).toHaveBeenCalledWith(collision);

            hub.offProjectileFired(onFired);
            hub.offProjectileDestroyed(onDestroyed);
            hub.offProjectilesCollided(onCollided);
            connection().emit('ProjectileFired', projectile);
            connection().emit('ProjectileDestroyed', projectile);
            connection().emit('ProjectilesCollided', collision);
            expect(onFired).toHaveBeenCalledTimes(1);
            expect(onDestroyed).toHaveBeenCalledTimes(1);
            expect(onCollided).toHaveBeenCalledTimes(1);
        });
    });
});
