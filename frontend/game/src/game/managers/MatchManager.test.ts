import type { Scene } from 'phaser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Color } from '../config/color';
import { GameEvent } from '../config/events';
import type { Tank } from '../objects/Tank';
import { MatchManager } from './MatchManager';

class TestEventEmitter {
    private listeners = new Map<
        string,
        Array<{ callback: (...args: unknown[]) => void; context?: unknown }>
    >();

    once(
        event: string,
        callback: (...args: unknown[]) => void,
        context?: unknown,
    ) {
        const onceCallback = (...args: unknown[]) => {
            this.off(event, onceCallback, context);
            callback.apply(context, args);
        };
        return this.on(event, onceCallback, context);
    }

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
        this.listeners.set(
            event,
            (this.listeners.get(event) ?? []).filter(
                (listener) =>
                    listener.callback !== callback ||
                    listener.context !== context,
            ),
        );
        return this;
    }

    emit(event: string, ...args: unknown[]) {
        (this.listeners.get(event) ?? []).forEach((listener) =>
            listener.callback.apply(listener.context, args),
        );
        return this;
    }
}

function createManager() {
    const events = new TestEventEmitter();
    const scene = {
        events,
        time: { delayedCall: vi.fn() },
        scene: { pause: vi.fn(), launch: vi.fn() },
    } as unknown as Scene;

    return { manager: new MatchManager(scene), events, scene };
}

function tank(color: Color, active = true) {
    return { active, getColor: () => color } as unknown as Tank;
}

describe('MatchManager', () => {
    afterEach(() => vi.restoreAllMocks());

    it('records placements in elimination order and ends once when a winner remains', () => {
        const { manager, events, scene } = createManager();
        const matchEnd = vi.fn();
        events.on(GameEvent.MatchEnd, matchEnd);
        vi.spyOn(Date, 'now')
            .mockReturnValueOnce(1000)
            .mockReturnValueOnce(1002)
            .mockReturnValueOnce(1004);

        manager.recordPlacement(tank(Color.red));
        manager.recordPlacement(tank(Color.green));
        manager.checkEnd(1, tank(Color.blue));
        manager.checkEnd(1, tank(Color.blue));

        expect(matchEnd).toHaveBeenCalledTimes(1);
        const result = matchEnd.mock.calls[0][0] as {
            placements: Array<{ color: Color; points: number; place: number }>;
        };
        expect(result.placements).toMatchObject([
            { color: Color.red, points: 0, place: 3 },
            { color: Color.green, points: 1, place: 2 },
            { color: Color.blue, points: 2, place: 1 },
        ]);
        expect(scene.time.delayedCall).toHaveBeenCalledTimes(1);
    });

    it('assigns tied points to eliminations in the same millisecond', () => {
        const { manager, events } = createManager();
        const matchEnd = vi.fn();
        events.on(GameEvent.MatchEnd, matchEnd);
        const now = vi.spyOn(Date, 'now');
        now.mockReturnValueOnce(1000).mockReturnValueOnce(1001);

        manager.recordPlacement(tank(Color.red));
        manager.recordPlacement(tank(Color.green));
        manager.checkEnd(1, tank(Color.blue));

        const { placements } = matchEnd.mock.calls[0][0] as {
            placements: Array<{ points: number; place: number }>;
        };
        expect(
            placements
                .slice(0, 2)
                .map(({ points, place }) => ({ points, place })),
        ).toEqual([
            { points: 1, place: 3 },
            { points: 1, place: 2 },
        ]);
    });

    it('ends with recorded placements when no tanks remain', () => {
        const { manager, events } = createManager();
        const matchEnd = vi.fn();
        events.on(GameEvent.MatchEnd, matchEnd);
        manager.recordPlacement(tank(Color.red));

        manager.checkEnd(0, undefined);
        manager.checkEnd(0, undefined);

        expect(matchEnd).toHaveBeenCalledTimes(1);
        expect(matchEnd.mock.calls[0][0]).toMatchObject({
            placements: [{ color: Color.red, points: 0, place: 3 }],
        });
    });

    it('ignores inactive tanks when recording a placement', () => {
        const { manager, events } = createManager();
        const matchEnd = vi.fn();
        events.on(GameEvent.MatchEnd, matchEnd);

        manager.recordPlacement(tank(Color.red, false));
        manager.checkEnd(0, undefined);

        expect(matchEnd.mock.calls[0][0]).toMatchObject({ placements: [] });
    });
});
