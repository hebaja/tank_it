import type { Scene } from 'phaser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const phaserMock = vi.hoisted(() => {
    class Sprite {
        scene: unknown;
        x: number;
        y: number;
        texture: string;
        angle = 0;
        active = true;

        constructor(scene: unknown, x: number, y: number, texture: string) {
            this.scene = scene;
            this.x = x;
            this.y = y;
            this.texture = texture;
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
    };
});

vi.mock('phaser', () => ({ Physics: phaserMock.Physics }));

import { Color } from '../config/color';
import { GAME_CONFIG } from '../config/game';
import { Projectile } from './Projectile';

function createScene() {
    const world = {
        on: vi.fn(),
        off: vi.fn(),
    };

    return {
        scene: {
            add: { existing: vi.fn() },
            physics: {
                add: { existing: vi.fn() },
                world,
                velocityFromAngle: vi.fn((angle: number, speed: number) => ({
                    x: angle,
                    y: speed,
                })),
            },
        },
        world,
    };
}

function createProjectile(
    overrides: {
        id?: string;
        position?: { x: number; y: number };
        angle?: number;
        color?: Color;
        owner?: { getColor(): Color } | null;
        timestamp?: number;
    } = {},
) {
    const { scene, world } = createScene();
    const group = { add: vi.fn() };
    const owner = overrides.owner ?? null;
    const projectile = new Projectile(
        scene as unknown as Scene,
        overrides.id ?? 'projectile-1',
        overrides.position ?? { x: 100, y: 200 },
        overrides.angle ?? 90,
        overrides.color ?? Color.blue,
        group as never,
        owner as never,
        overrides.timestamp ?? 123456789,
    );

    return { projectile, scene, group, world };
}

describe('Projectile', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('keeps the server-assigned identity and metadata', () => {
        const { projectile } = createProjectile();

        expect(projectile.getId()).toBe('projectile-1');
        expect(projectile.getColor()).toBe(Color.blue);
        expect(projectile.getTimestamp()).toBe(123456789);
    });

    it('keeps the owning tank', () => {
        const owner = { getColor: () => Color.red };
        const { projectile } = createProjectile({ owner });

        expect(projectile.getOwner()).toBe(owner);
    });

    it('accepts a projectile without an owner', () => {
        const { projectile } = createProjectile({ owner: null });

        expect(projectile.getOwner()).toBeNull();
    });

    it('uses the projectile texture for its color', () => {
        const { projectile, group } = createProjectile({
            color: Color.green,
        });

        expect((projectile as unknown as { texture: string }).texture).toBe(
            `projectile_${Color.green}`,
        );
        expect(group.add).toHaveBeenCalledWith(projectile);
    });

    it('sets the sprite angle and velocity from the shot angle', () => {
        const { projectile, scene } = createProjectile({ angle: 90 });

        expect(projectile.angle).toBe(-90);
        expect(scene.physics.velocityFromAngle).toHaveBeenCalledWith(
            -180,
            GAME_CONFIG.projectile.speed,
        );
    });

    it('registers a world-bounds listener', () => {
        const { world } = createProjectile();

        expect(world.on).toHaveBeenCalledWith(
            'worldbounds',
            expect.any(Function),
        );
    });
});
