import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Scene } from 'phaser';
import {
    MUSIC_TRACKS,
    MUSIC_VOLUME,
    SoundManager,
    type MusicTrack,
} from './SoundManager';

vi.mock('phaser', () => ({
    Sound: {
        Events: {
            COMPLETE: 'complete',
        },
    },
}));

type Handler = (...args: unknown[]) => void;

interface Listener {
    handler: Handler;
    context?: unknown;
}

class FakeEmitter {
    private readonly listeners = new Map<string, Set<Handler>>();

    on(event: string, handler: Handler): this {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event)?.add(handler);
        return this;
    }

    off(event: string, handler: Handler): this {
        this.listeners.get(event)?.delete(handler);
        return this;
    }
}

class FakeSound {
    readonly play = vi.fn(() => true);
    readonly destroy = vi.fn();

    private readonly listeners = new Map<string, Listener[]>();

    constructor(readonly key: string) {}

    once(event: string, handler: Handler, context?: unknown): this {
        const listeners = this.listeners.get(event) ?? [];
        listeners.push({ handler, context });
        this.listeners.set(event, listeners);
        return this;
    }

    off(event: string, handler: Handler, context?: unknown): this {
        const listeners = this.listeners.get(event) ?? [];
        this.listeners.set(
            event,
            listeners.filter(
                (listener) =>
                    listener.handler !== handler ||
                    listener.context !== context,
            ),
        );
        return this;
    }

    emit(event: string) {
        const listeners = this.listeners.get(event) ?? [];
        this.listeners.delete(event);
        listeners.forEach(({ handler, context }) => handler.call(context));
    }
}

class FakeSoundManager {
    readonly sounds: FakeSound[] = [];
    readonly play = vi.fn(() => true);
    readonly add = vi.fn((key: string) => {
        const sound = new FakeSound(key);
        this.sounds.push(sound);
        return sound;
    });
}

interface MusicHarness {
    manager: SoundManager;
    sound: FakeSoundManager;
    intro: FakeSound;
    loop: FakeSound;
}

function createHarness(track: MusicTrack = 'track01'): MusicHarness {
    const sound = new FakeSoundManager();
    const scene = {
        events: new FakeEmitter(),
        sound,
        time: { addEvent: vi.fn() },
    } as unknown as Scene;
    const manager = new SoundManager(scene, track);

    return {
        manager,
        sound,
        intro: sound.sounds[0],
        loop: sound.sounds[1],
    };
}

describe('SoundManager music', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('maps random values to the track catalogue', () => {
        const random = vi.spyOn(Math, 'random');
        random
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(0.34)
            .mockReturnValueOnce(0.67);

        expect(SoundManager.pickMusicTrack()).toBe('track01');
        expect(SoundManager.pickMusicTrack()).toBe('track02');
        expect(SoundManager.pickMusicTrack()).toBe('track03');
    });

    it('always picks a track from the catalogue', () => {
        for (const value of [0, 0.1, 0.5, 0.99]) {
            vi.spyOn(Math, 'random').mockReturnValue(value);
            expect(MUSIC_TRACKS).toContain(SoundManager.pickMusicTrack());
        }
    });

    it.each(MUSIC_TRACKS)('preloads only the %s music files', (track) => {
        const audio = vi.fn();
        const scene = { load: { audio } } as unknown as Scene;

        SoundManager.preload(scene, track);

        const musicCalls = audio.mock.calls.filter(([key]) =>
            String(key).startsWith('music-'),
        );

        expect(musicCalls).toEqual([
            [
                `music-${track}-intro`,
                [
                    `sounds/music/${track}_intro.ogg`,
                    `sounds/music/${track}_intro.mp3`,
                ],
            ],
            [
                `music-${track}-loop`,
                [
                    `sounds/music/${track}_loop.ogg`,
                    `sounds/music/${track}_loop.mp3`,
                ],
            ],
        ]);
    });

    it('starts the intro and prepares the loop', () => {
        const { sound, intro, loop } = createHarness('track02');

        expect(sound.add).toHaveBeenNthCalledWith(1, 'music-track02-intro', {
            volume: MUSIC_VOLUME,
        });
        expect(sound.add).toHaveBeenNthCalledWith(2, 'music-track02-loop', {
            volume: MUSIC_VOLUME,
            loop: true,
        });
        expect(intro.play).toHaveBeenCalledTimes(1);
        expect(loop.play).not.toHaveBeenCalled();
    });

    it('starts the loop once after the intro completes', () => {
        const { intro, loop } = createHarness();

        intro.emit('complete');

        expect(loop.play).toHaveBeenCalledTimes(1);

        intro.emit('complete');

        expect(loop.play).toHaveBeenCalledTimes(1);
    });

    it('destroys both sounds and ignores completion after shutdown', () => {
        const { manager, intro, loop } = createHarness();

        manager.destroy();
        manager.destroy();

        expect(intro.destroy).toHaveBeenCalledTimes(1);
        expect(loop.destroy).toHaveBeenCalledTimes(1);

        intro.emit('complete');

        expect(loop.play).not.toHaveBeenCalled();
    });

    it('does not restart the previous loop after a new session starts', () => {
        const first = createHarness('track01');
        first.manager.destroy();

        const second = createHarness('track02');

        first.intro.emit('complete');

        expect(first.loop.play).not.toHaveBeenCalled();
        expect(second.intro.play).toHaveBeenCalledTimes(1);

        second.intro.emit('complete');

        expect(second.loop.play).toHaveBeenCalledTimes(1);
    });
});
