import type { Scene } from 'phaser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const phaserMock = vi.hoisted(() => {
    class Container {
        active = true;
        scene: unknown;
        add = vi.fn();
        setDepth = vi.fn(() => this);

        constructor(scene: unknown) {
            this.scene = scene;
        }

        destroy() {}
    }

    return {
        GameObjects: { Container },
        Scenes: { Events: { UPDATE: 'update' } },
        Display: {
            Color: {
                ValueToColor: vi.fn((color: number) => ({ color })),
                Interpolate: {
                    ColorWithColor: vi.fn(() => ({ color: 0xff0000 })),
                },
            },
        },
    };
});

vi.mock('phaser', () => phaserMock);

import { Color } from '../config/color';
import { GameEvent } from '../config/events';
import { HUD } from '../config/layout';
import { AmmoGauge } from './AmmoGauge';

class TestEventEmitter {
    on = vi.fn();
    off = vi.fn();
    emit = vi.fn();
}

function createGauge() {
    const events = new TestEventEmitter();
    const fill = {
        width: HUD.gaugeWidth,
        setDepth: vi.fn().mockReturnThis(),
        setOrigin: vi.fn().mockReturnThis(),
    };
    const bg = {
        setDepth: vi.fn().mockReturnThis(),
        setFillStyle: vi.fn(),
    };
    const quantity = {
        setDepth: vi.fn().mockReturnThis(),
        setText: vi.fn(),
    };
    const chainable = () => ({
        setDepth: vi.fn().mockReturnThis(),
        setScale: vi.fn().mockReturnThis(),
    });
    const addTween = vi.fn((config?: Record<string, unknown>) => {
        void config;
        return { stop: vi.fn() };
    });
    const addCounter = vi.fn((config?: Record<string, unknown>) => {
        void config;
        return { stop: vi.fn() };
    });
    const tweens = {
        add: addTween,
        addCounter,
        killTweensOf: vi.fn(),
    };
    const scene = {
        physics: { world: { bounds: { width: 960, height: 960 } } },
        add: {
            nineslice: vi.fn((_x, _y, texture) =>
                texture === `${Color.blue}_fill` ? fill : chainable(),
            ),
            image: vi.fn(chainable),
            text: vi.fn(() => quantity),
            rectangle: vi.fn(() => bg),
            existing: vi.fn(),
        },
        events,
        tweens,
    } as unknown as Scene;
    const gauge = new AmmoGauge(scene, Color.blue, 'top-left');

    return {
        gauge,
        scene,
        events,
        fill,
        bg,
        quantity,
        tweens,
        addTween,
        addCounter,
    };
}

describe('AmmoGauge', () => {
    beforeEach(() => vi.clearAllMocks());

    it('consumes one shot per call and disables fire until recharge completes', () => {
        const { gauge, events, quantity, addTween } = createGauge();

        for (let shot = 0; shot < HUD.initialAmmo - 1; shot++)
            gauge.consumeGauge();
        expect(gauge.getCanFire()).toBe(true);
        expect(quantity.setText).toHaveBeenCalledTimes(HUD.initialAmmo - 1);

        gauge.consumeGauge();
        expect(gauge.getCanFire()).toBe(false);
        expect(quantity.setText).toHaveBeenLastCalledWith('x0');

        const recharge = addTween.mock.calls[
            addTween.mock.calls.length - 1
        ][0] as {
            onComplete: () => void;
        };
        recharge.onComplete();

        expect(gauge.getCanFire()).toBe(true);
        expect(quantity.setText).toHaveBeenLastCalledWith(
            `x${HUD.initialAmmo}`,
        );
        expect(events.emit).toHaveBeenCalledWith(GameEvent.AmmoBarComplete);
    });

    it('does not drain or begin another recharge while recharging', () => {
        const { gauge, addTween } = createGauge();

        for (let shot = 0; shot < HUD.initialAmmo; shot++) gauge.consumeGauge();
        const tweenCount = addTween.mock.calls.length;

        gauge.consumeGauge();

        expect(addTween).toHaveBeenCalledTimes(tweenCount);
        expect(gauge.getCanFire()).toBe(false);
    });

    it('starts the low-ammo alarm at the final shot and clears listeners on destroy', () => {
        const { gauge, scene, events, addCounter } = createGauge();

        for (let shot = 0; shot < HUD.initialAmmo - 1; shot++)
            gauge.consumeGauge();
        gauge.update();

        expect(addCounter).toHaveBeenCalledWith(
            expect.objectContaining({ from: 0, to: 1, repeat: -1 }),
        );

        gauge.destroy();
        expect(events.off).toHaveBeenCalledWith(
            'update',
            expect.any(Function),
            gauge,
        );
        expect(scene.tweens.killTweensOf).toHaveBeenCalled();
    });
});
