import type { Scene } from 'phaser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

class TestEventEmitter {
    private listeners = new Map<
        string,
        Array<{ callback: (...args: unknown[]) => void; context?: unknown }>
    >();

    on(
        event: string,
        callback: (...args: unknown[]) => void,
        context?: unknown,
    ) {
        const listeners = this.listeners.get(event) ?? [];
        listeners.push({ callback, context });
        this.listeners.set(event, listeners);
        return this;
    }

    off(
        event: string,
        callback: (...args: unknown[]) => void,
        context?: unknown,
    ) {
        const listeners = this.listeners.get(event) ?? [];
        this.listeners.set(
            event,
            listeners.filter(
                (listener) =>
                    listener.callback !== callback ||
                    listener.context !== context,
            ),
        );
        return this;
    }

    emit(event: string, ...args: unknown[]) {
        const listeners = this.listeners.get(event) ?? [];
        listeners.forEach((listener) =>
            listener.callback.apply(listener.context, args),
        );
        return this;
    }
}

const sessionMock = vi.hoisted(() => ({
    sessionConfig: {
        roomId: 'room-1',
        localColor: 'blue',
        hubUrl: 'http://localhost:8080/hubs/game',
    },
}));

const hubMock = vi.hoisted(() => {
    const hub = {
        onTankMoved: vi.fn(),
        onMatchStarted: vi.fn(),
        onDeathWallStep: vi.fn(),
        onBlockDestroyed: vi.fn(),
        onBarrelDestroyed: vi.fn(),
        onTankDestroyed: vi.fn(),
        onProjectileFired: vi.fn(),
        onProjectileDestroyed: vi.fn(),
        onProjectilesCollided: vi.fn(),
        offTankMoved: vi.fn(),
        offMatchStarted: vi.fn(),
        offDeathWallStep: vi.fn(),
        offBlockDestroyed: vi.fn(),
        offBarrelDestroyed: vi.fn(),
        offTankDestroyed: vi.fn(),
        offProjectileFired: vi.fn(),
        offProjectileDestroyed: vi.fn(),
        offProjectilesCollided: vi.fn(),
        sendTankMove: vi.fn(),
        sendMatchEnd: vi.fn(),
        sendStartMatch: vi.fn(),
        sendBlockDestroy: vi.fn(),
        sendBarrelDestroy: vi.fn(),
        sendTankDestroy: vi.fn(),
        sendProjectileFire: vi.fn(),
        sendProjectileDestroy: vi.fn(),
        sendProjectilesCollide: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        joinRoom: vi.fn(),
        leaveRoom: vi.fn(),
        getConnectionId: vi.fn(),
    };

    return {
        hub,
        GameHubConnection: vi.fn(() => hub),
    };
});

vi.mock('../../net/sessionConfig', () => sessionMock);
vi.mock('../../net/GameHubConnection', () => ({
    GameHubConnection: hubMock.GameHubConnection,
}));

import { GameEvent } from '../config/events';
import type {
    ProjectilePayload,
    ProjectilesCollidePayload,
    RoomJoinedPayload,
} from '../../net/contracts';
import { NetworkManager } from './NetworkManager';

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
    championshipId: '',
};

function createScene() {
    const events = new TestEventEmitter();
    return { events } as unknown as Scene;
}

describe('NetworkManager projectile lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        hubMock.hub.start.mockResolvedValue(undefined);
        hubMock.hub.joinRoom.mockResolvedValue(roomJoined);
        hubMock.hub.stop.mockResolvedValue(undefined);
        hubMock.hub.leaveRoom.mockResolvedValue(undefined);
        hubMock.hub.getConnectionId.mockReturnValue('connection-a');
    });

    it('subscribes to projectile callbacks from the hub', () => {
        new NetworkManager(createScene());

        expect(hubMock.hub.onProjectileFired).toHaveBeenCalledTimes(1);
        expect(hubMock.hub.onProjectileDestroyed).toHaveBeenCalledTimes(1);
        expect(hubMock.hub.onProjectilesCollided).toHaveBeenCalledTimes(1);
    });

    it('forwards local scene events to the hub', () => {
        const scene = createScene();
        new NetworkManager(scene);

        scene.events.emit(GameEvent.ProjectileFire, projectile);
        scene.events.emit(GameEvent.ProjectileDestroy, projectile);
        scene.events.emit(GameEvent.ProjectilesCollide, collision);

        expect(hubMock.hub.sendProjectileFire).toHaveBeenCalledWith(projectile);
        expect(hubMock.hub.sendProjectileDestroy).toHaveBeenCalledWith(
            projectile,
        );
        expect(hubMock.hub.sendProjectilesCollide).toHaveBeenCalledWith(
            collision,
        );
    });

    it('forwards hub callbacks to scene events', () => {
        const scene = createScene();
        new NetworkManager(scene);

        const fired = hubMock.hub.onProjectileFired.mock.calls[0][0];
        const destroyed = hubMock.hub.onProjectileDestroyed.mock.calls[0][0];
        const collided = hubMock.hub.onProjectilesCollided.mock.calls[0][0];

        const firedListener = vi.fn();
        const destroyedListener = vi.fn();
        const collidedListener = vi.fn();
        scene.events.on(GameEvent.ProjectileFired, firedListener);
        scene.events.on(GameEvent.ProjectileDestroyed, destroyedListener);
        scene.events.on(GameEvent.ProjectilesCollided, collidedListener);

        fired(projectile);
        destroyed(projectile);
        collided(collision);

        expect(firedListener).toHaveBeenCalledWith(projectile);
        expect(destroyedListener).toHaveBeenCalledWith(projectile);
        expect(collidedListener).toHaveBeenCalledWith(collision);
    });

    it('emits RoomJoined and exposes the connection id when ready', async () => {
        const scene = createScene();
        const manager = new NetworkManager(scene);
        const joinedListener = vi.fn();
        scene.events.on(GameEvent.RoomJoined, joinedListener);

        const joined = await manager.ready;

        expect(joined).toBe(roomJoined);
        expect(joinedListener).toHaveBeenCalledWith(roomJoined);
        expect(manager.getConnectionId()).toBe('connection-a');
    });

    it('removes listeners and leaves the room on destroy', () => {
        const scene = createScene();
        const manager = new NetworkManager(scene);

        manager.destroy();
        scene.events.emit(GameEvent.ProjectileFire, projectile);

        expect(hubMock.hub.offProjectileFired).toHaveBeenCalledTimes(1);
        expect(hubMock.hub.offProjectileDestroyed).toHaveBeenCalledTimes(1);
        expect(hubMock.hub.offProjectilesCollided).toHaveBeenCalledTimes(1);
        expect(hubMock.hub.sendProjectileFire).not.toHaveBeenCalled();
        expect(hubMock.hub.leaveRoom).toHaveBeenCalledWith('room-1');
        expect(hubMock.hub.stop).toHaveBeenCalledTimes(1);
    });
});
