import type { Scene, Tilemaps } from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { GameEvent } from '../config/events';
import { DeathWallManager } from './DeathWallManager';

vi.mock('phaser', () => ({}));

class TestEventEmitter {
    private listeners = new Map<string, Array<(...args: unknown[]) => void>>();

    on(event: string, callback: (...args: unknown[]) => void) {
        const listeners = this.listeners.get(event) ?? [];
        listeners.push(callback);
        this.listeners.set(event, listeners);
        return this;
    }

    off(event: string) {
        this.listeners.delete(event);
        return this;
    }

    emit(event: string, ...args: unknown[]) {
        (this.listeners.get(event) ?? []).forEach((callback) =>
            callback(...args),
        );
        return this;
    }
}

function createManager(initialStep = -1) {
    const tiles = Array.from({ length: 15 * 15 }, (_, index) => {
        const x = index % 15;
        const y = Math.floor(index / 15);
        return {
            x,
            y,
            pixelX: x * 64,
            pixelY: y * 64,
            width: 64,
            index: 0,
            alpha: 1,
            setAlpha(alpha: number) {
                this.alpha = alpha;
                return this;
            },
            setCollision: vi.fn(),
        };
    });
    const layer = {
        width: 15 * 64,
        setDepth: vi.fn().mockReturnThis(),
        forEachTile: (callback: (tile: (typeof tiles)[number]) => void) =>
            tiles.forEach(callback),
    };
    const map = {
        addTilesetImage: vi.fn(() => ({ firstgid: 100 })),
        createLayer: vi.fn(() => layer),
    };
    const events = new TestEventEmitter();
    const tweenConfigs: Array<Record<string, unknown>> = [];
    const tweens = {
        add: vi.fn((config: Record<string, unknown>) => {
            tweenConfigs.push(config);
            return {
                targets: [config.targets],
                stop: vi.fn(),
                remove: vi.fn(),
            };
        }),
    };
    const scene = {
        events,
        physics: { add: { collider: vi.fn() } },
        tweens,
    } as unknown as Scene;
    const manager = new DeathWallManager(
        scene,
        map as unknown as Tilemaps.Tilemap,
        {} as never,
        initialStep,
    );

    return { manager, events, tiles, tweenConfigs, tweens };
}

function ringTiles(
    tiles: ReturnType<typeof createManager>['tiles'],
    ring: number,
) {
    const max = 14 - ring;
    return tiles.filter(
        (tile) =>
            tile.x >= ring &&
            tile.x <= max &&
            tile.y >= ring &&
            tile.y <= max &&
            (tile.x === ring ||
                tile.x === max ||
                tile.y === ring ||
                tile.y === max),
    );
}

describe('DeathWallManager', () => {
    it('warns once per increasing step, then destroys the previous ring', () => {
        const { manager, events, tiles } = createManager();
        const warnings = vi.fn();
        const tileDestroys = vi.fn();
        const completions: Array<() => void> = [];
        events.on(GameEvent.DangerWarning, warnings);
        events.on(GameEvent.TileDestroy, tileDestroys);
        events.on(GameEvent.Explosion, (payload) => {
            completions.push(
                (payload as { onComplete: () => void }).onComplete,
            );
        });

        manager.applyStep(0);
        manager.applyStep(0);
        expect(warnings).toHaveBeenCalledTimes(1);

        manager.applyStep(1);
        const previousRing = ringTiles(tiles, 0);
        expect(tileDestroys).toHaveBeenCalledTimes(previousRing.length);
        completions.forEach((complete) => complete());

        expect(previousRing.every((tile) => tile.index === 145)).toBe(true);
        expect(
            previousRing.every(
                (tile) => tile.setCollision.mock.calls.length === 1,
            ),
        ).toBe(true);
        expect(warnings).toHaveBeenCalledTimes(2);
    });

    it('catches up earlier rings when constructed from a server step', () => {
        const { manager, tiles, tweenConfigs } = createManager(2);
        const destroyed = [...ringTiles(tiles, 0), ...ringTiles(tiles, 1)];
        const currentRing = ringTiles(tiles, 2);

        expect(destroyed.every((tile) => tile.index === 145)).toBe(true);
        expect(
            destroyed.every(
                (tile) => tile.setCollision.mock.calls.length === 1,
            ),
        ).toBe(true);
        expect(currentRing.every((tile) => tile.alpha === 0.5)).toBe(true);
        expect(tweenConfigs).toHaveLength(currentRing.length);

        manager.destroy();
    });

    it('emits warning-finished only after all final-ring explosions complete', () => {
        const { manager, events } = createManager(0);
        const finish = vi.fn();
        const completions: Array<() => void> = [];
        events.on(GameEvent.DangerWarningFinish, finish);
        events.on(GameEvent.Explosion, (payload) => {
            completions.push(
                (payload as { onComplete: () => void }).onComplete,
            );
        });

        manager.applyStep(6);

        expect(finish).not.toHaveBeenCalled();
        expect(completions.length).toBeGreaterThan(0);
        completions.slice(0, -1).forEach((complete) => complete());
        expect(finish).not.toHaveBeenCalled();
        completions[completions.length - 1]?.();
        expect(finish).toHaveBeenCalledTimes(1);
    });
});
