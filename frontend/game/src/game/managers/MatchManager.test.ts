import type { Scene } from 'phaser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameEvent } from '../config/events';
import { sessionConfig } from '../../net/sessionConfig';
import { MatchManager } from './MatchManager';

vi.mock('../../net/sessionConfig', () => ({
    sessionConfig: { roomId: 'room-1', champId: 'champ-1', mode: 'single' },
}));

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
    const scene = { events } as unknown as Scene;
    return { manager: new MatchManager(scene), events };
}

function tankGroup(length: number) {
    return { getLength: () => length } as Phaser.Physics.Arcade.Group;
}

describe('MatchManager', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each([0, 1])(
        'emits MatchEnd once with room/championship ids when %i tanks remain',
        (remaining) => {
            sessionConfig.roomId = 'room-1';
            sessionConfig.champId = 'champ-1';
            const { manager, events } = createManager();
            const matchEnd = vi.fn();
            events.on(GameEvent.MatchEnd, matchEnd);

            manager.checkEnd(tankGroup(remaining));
            manager.checkEnd(tankGroup(remaining));

            expect(matchEnd).toHaveBeenCalledTimes(1);
            expect(matchEnd).toHaveBeenCalledWith({
                roomId: 'room-1',
                championshipId: 'champ-1',
            });
        },
    );

    it('does not emit MatchEnd while more than one tank remains', () => {
        const { manager, events } = createManager();
        const matchEnd = vi.fn();
        events.on(GameEvent.MatchEnd, matchEnd);

        manager.checkEnd(tankGroup(2));
        manager.checkEnd(tankGroup(4));

        expect(matchEnd).not.toHaveBeenCalled();
    });

    it('allows a new match to end again after reset', () => {
        const { manager, events } = createManager();
        const matchEnd = vi.fn();
        events.on(GameEvent.MatchEnd, matchEnd);

        manager.checkEnd(tankGroup(1));
        manager.reset();
        manager.checkEnd(tankGroup(0));

        expect(matchEnd).toHaveBeenCalledTimes(2);
    });
});
