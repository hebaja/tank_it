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
    },
}));

const phaserMock = vi.hoisted(() => {
    class Sprite {
        scene: unknown;
        x: number;
        y: number;
        angle = 0;
        body = {};
        active = true;

        constructor(scene: unknown, x: number, y: number) {
            this.scene = scene;
            this.x = x;
            this.y = y;
        }

        setCollideWorldBounds() {}
        setVelocity() {}
        destroy() {
            this.active = false;
        }
    }

    return {
        Sprite,
        Physics: { Arcade: { Sprite } },
        Input: {
            Keyboard: {
                KeyCodes: {
                    A: 'A',
                    D: 'D',
                    W: 'W',
                    S: 'S',
                    SPACE: 'SPACE',
                },
                JustDown: vi.fn(),
            },
        },
        Scenes: { Events: { UPDATE: 'update' } },
        Math: {
            DegToRad: (degrees: number) => (degrees * Math.PI) / 180,
        },
    };
});

const ammoMock = vi.hoisted(() => {
    const instances: FakeAmmoGauge[] = [];

    class FakeAmmoGauge {
        canFire = true;
        consumeGauge = vi.fn();
        destroy = vi.fn();

        constructor() {
            instances.push(this);
        }

        getCanFire() {
            return this.canFire;
        }
    }

    return { AmmoGauge: FakeAmmoGauge, instances };
});

const projectileMock = vi.hoisted(() => {
    const instances: FakeProjectile[] = [];

    class FakeProjectile {
        id: string;
        args: unknown[];
        depth = 0;
        destroyed = false;
        private destroyListeners: Array<() => void> = [];

        constructor(...args: unknown[]) {
            this.args = args;
            this.id = args[1] as string;
            instances.push(this);
        }

        getId() {
            return this.id;
        }

        once(event: string, callback: () => void) {
            if (event === 'destroy') this.destroyListeners.push(callback);
        }

        destroy() {
            this.destroyed = true;
            this.destroyListeners.forEach((callback) => callback());
        }
    }

    return { Projectile: FakeProjectile, instances };
});

vi.mock('phaser', () => ({
    Physics: phaserMock.Physics,
    Input: phaserMock.Input,
    Scenes: phaserMock.Scenes,
    Math: phaserMock.Math,
}));
vi.mock('./AmmoGauge', () => ({ AmmoGauge: ammoMock.AmmoGauge }));
vi.mock('./Projectile', () => ({ Projectile: projectileMock.Projectile }));
vi.mock('../../net/sessionConfig', () => sessionMock);

import type { ProjectilePayload } from '../../net/contracts';
import { GameEvent } from '../config/events';
import { Color } from '../config/color';
import type { TankMovedPayload } from '../../net/contracts';
import { Tank } from './Tank';

const payload: ProjectilePayload = {
    roomId: 'room-1',
    ownerId: 'red',
    projectileId: 'remote-projectile',
    origin: { x: 500, y: 600 },
    angle: 180,
    color: 'red',
    timestamp: 999,
    sequence: 4,
};

function createScene(
    events: TestEventEmitter = new TestEventEmitter(),
    keys = {
        A: { isDown: false },
        D: { isDown: false },
        W: { isDown: false },
        S: { isDown: false },
        SPACE: { isDown: false },
    },
) {
    const spark = {
        destroy: vi.fn(),
        setPosition: vi.fn(),
        angle: 0,
        depth: 0,
    };

    return {
        events,
        input: {
            keyboard: {
                addKeys: vi.fn(() => ({
                    ...keys,
                })),
            },
        },
        physics: {
            add: { existing: vi.fn() },
            velocityFromAngle: vi.fn((angle: number, speed: number) => ({
                x: angle,
                y: speed,
            })),
        },
        add: {
            existing: vi.fn(),
            sprite: vi.fn(() => spark),
        },
        time: {
            now: 0,
            delayedCall: vi.fn(),
        },
    } as unknown as Scene;
}

function createTank(isLocal: boolean) {
    const scene = createScene();
    const tank = new Tank(
        scene,
        100,
        200,
        90,
        Color.blue,
        { add: vi.fn() } as never,
        { add: vi.fn() } as never,
        isLocal,
    );

    return {
        tank,
        scene,
        ammo: ammoMock.instances[ammoMock.instances.length - 1],
    };
}

describe('Tank', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ammoMock.instances.length = 0;
        projectileMock.instances.length = 0;
    });

    it('local fire consumes ammo once and emits a fire payload', () => {
        const events = new TestEventEmitter();
        const fireListener = vi.fn();
        events.on(GameEvent.ProjectileFire, fireListener);

        const tank = new Tank(
            createScene(events),
            100,
            200,
            90,
            Color.blue,
            { add: vi.fn() } as never,
            { add: vi.fn() } as never,
            true,
        );
        const ammo = ammoMock.instances[0];

        tank.fire();

        expect(ammo.consumeGauge).toHaveBeenCalledTimes(1);
        expect(projectileMock.instances).toHaveLength(1);
        expect(fireListener).toHaveBeenCalledTimes(1);

        const fired = fireListener.mock.calls[0][0] as ProjectilePayload;
        expect(fired.roomId).toBe('room-1');
        expect(fired.ownerId).toBe(Color.blue);
        expect(fired.color).toBe(Color.blue);
        expect(fired.origin.x).toBeCloseTo(80, 6);
        expect(fired.origin.y).toBeCloseTo(200, 6);
        expect(fired.angle).toBe(90);
        expect(fired.sequence).toBe(0);
    });

    it('does not fire locally while the ammo gauge is locked', () => {
        const events = new TestEventEmitter();
        const failListener = vi.fn();
        events.on(GameEvent.ProjectileFireFail, failListener);

        const tank = new Tank(
            createScene(events),
            100,
            200,
            0,
            Color.blue,
            { add: vi.fn() } as never,
            { add: vi.fn() } as never,
            true,
        );
        const ammo = ammoMock.instances[0];
        ammo.canFire = false;

        tank.fire();

        expect(failListener).toHaveBeenCalledTimes(1);
        expect(projectileMock.instances).toHaveLength(0);
        expect(ammo.consumeGauge).not.toHaveBeenCalled();
    });

    it('remote fire consumes ammo once without emitting a local payload', () => {
        const events = new TestEventEmitter();
        const fireListener = vi.fn();
        events.on(GameEvent.ProjectileFire, fireListener);

        const tank = new Tank(
            createScene(events),
            100,
            200,
            0,
            Color.red,
            { add: vi.fn() } as never,
            { add: vi.fn() } as never,
            false,
        );
        const ammo = ammoMock.instances[0];

        tank.fireRemoteProjectile(payload);

        expect(fireListener).not.toHaveBeenCalled();
        expect(ammo.consumeGauge).toHaveBeenCalledTimes(1);
        expect(projectileMock.instances).toHaveLength(1);
    });

    it('uses the server-provided origin and angle for remote shots', () => {
        const { tank } = createTank(false);

        tank.fireRemoteProjectile(payload);

        const args = projectileMock.instances[0].args;
        expect(args[1]).toBe('remote-projectile');
        expect(args[2]).toEqual({ x: 500, y: 600 });
        expect(args[3]).toBe(180);
    });

    it.each([
        [0, 100, 220],
        [90, 80, 200],
        [180, 100, 180],
        [270, 120, 200],
    ])('computes the projectile origin at angle %s', (angle, x, y) => {
        const { tank } = createTank(true);
        tank.angle = angle;

        const origin = tank.getProjectileOrigin(20);

        expect(origin.x).toBeCloseTo(x, 6);
        expect(origin.y).toBeCloseTo(y, 6);
    });

    it('moves local tanks from input and emits sequenced movement state', () => {
        const events = new TestEventEmitter();
        const moveListener = vi.fn();
        events.on(GameEvent.TankMove, moveListener);
        const keys = {
            A: { isDown: true },
            D: { isDown: false },
            W: { isDown: false },
            S: { isDown: true },
            SPACE: { isDown: false },
        };
        const scene = createScene(events, keys);
        (scene as unknown as { time: { now: number } }).time.now = 100;
        const tank = new Tank(
            scene,
            100,
            200,
            90,
            Color.blue,
            { add: vi.fn() } as never,
            { add: vi.fn() } as never,
            true,
        );

        tank.update();

        expect(tank.angle).toBe(88);
        expect(scene.physics.velocityFromAngle).toHaveBeenCalledWith(-2, 150);
        expect(moveListener).toHaveBeenCalledWith(
            expect.objectContaining({
                roomId: 'room-1',
                playerId: Color.blue,
                position: { x: 100, y: 200 },
                rotation: 88,
                sequence: 0,
            }),
        );
    });

    it('applies the latest received state to remote tanks during update', () => {
        const scene = createScene();
        const tank = new Tank(
            scene,
            100,
            200,
            90,
            Color.red,
            { add: vi.fn() } as never,
            { add: vi.fn() } as never,
            false,
        );
        const remote: TankMovedPayload = {
            roomId: 'room-1',
            playerId: Color.red,
            position: { x: 320, y: 440 },
            rotation: 180,
            sequence: 2,
            timestamp: 123,
        };

        tank.receiveRemoteState(remote);
        tank.update();

        expect(tank.x).toBe(320);
        expect(tank.y).toBe(440);
        expect(tank.angle).toBe(180);
    });
});
