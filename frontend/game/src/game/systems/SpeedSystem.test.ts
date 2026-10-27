import type { Scene } from 'phaser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const oilMock = vi.hoisted(() => {
    const instances: Array<{ x: number; y: number }> = [];
    class FakeOil {
        constructor(
            _scene: Scene,
            public x: number,
            public y: number,
        ) {
            instances.push(this);
        }
    }
    return { Oil: FakeOil, instances };
});

vi.mock('phaser', () => ({ Scenes: { Events: { UPDATE: 'update' } } }));
vi.mock('../objects/Oil', () => ({ Oil: oilMock.Oil }));

import { SpeedSystem } from './SpeedSystem';

function createSystem() {
    const tankGroup = { getChildren: vi.fn(() => []) };
    const oilGroup = { add: vi.fn(), destroy: vi.fn() };
    const events = { on: vi.fn(), off: vi.fn() };
    const overlap = vi.fn();
    const scene = {
        events,
        physics: {
            add: {
                group: vi.fn(() => oilGroup),
                overlap,
            },
        },
    } as unknown as Scene;

    return {
        system: new SpeedSystem(scene, tankGroup as never),
        tankGroup,
        oilGroup,
        events,
        overlap,
    };
}

describe('SpeedSystem', () => {
    beforeEach(() => {
        oilMock.instances.length = 0;
        vi.clearAllMocks();
    });

    it('slows a tank on oil overlap and clears the slowdown each update', () => {
        const tank = { setSlow: vi.fn() };
        const tankGroup = { getChildren: vi.fn(() => [tank]) };
        const oilGroup = { add: vi.fn(), destroy: vi.fn() };
        const events = { on: vi.fn(), off: vi.fn() };
        const overlap = vi.fn();
        const scene = {
            events,
            physics: { add: { group: vi.fn(() => oilGroup), overlap } },
        } as unknown as Scene;
        const system = new SpeedSystem(scene, tankGroup as never);

        const onOverlap = overlap.mock.calls[0][2] as (tank: unknown) => void;
        onOverlap(tank);
        const onUpdate = events.on.mock.calls[0][1] as () => void;
        onUpdate();

        expect(tank.setSlow).toHaveBeenNthCalledWith(1, true);
        expect(tank.setSlow).toHaveBeenNthCalledWith(2, false);
        system.destroy();
    });

    it('adds oil to the physics group and clears listeners and oil on destroy', () => {
        const { system, oilGroup, events } = createSystem();

        system.addOil(120, 240);
        system.destroy();

        expect(oilMock.instances).toMatchObject([{ x: 120, y: 240 }]);
        expect(oilGroup.add).toHaveBeenCalledWith(oilMock.instances[0]);
        expect(events.off).toHaveBeenCalledWith('update', expect.any(Function));
        expect(oilGroup.destroy).toHaveBeenCalledWith(true);
    });
});
