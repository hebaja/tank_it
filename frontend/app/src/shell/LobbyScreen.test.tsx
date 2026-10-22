import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp, type RenderedApp } from '../test/appHarness';
import { seedSession } from '../test/helpers';

interface FakePlayer {
    connectionId: string;
    color: string;
}

const fakeHub = vi.hoisted(() => {
    const config = {
        joinError: null as Error | null,
        startMatchError: null as Error | null,
        players: null as FakePlayer[] | null,
    };
    const instances: FakeHub[] = [];

    class FakeHub {
        hubUrl: string;
        startCalls = 0;
        stopCalls = 0;
        joins: { roomId: string; color: string }[] = [];
        leaves: string[] = [];
        starts: string[] = [];
        offEvents: string[] = [];
        handlers = new Map<string, Set<(payload: unknown) => void>>();

        constructor(hubUrl: string) {
            this.hubUrl = hubUrl;
            instances.push(this);
        }

        async start(): Promise<void> {
            this.startCalls += 1;
        }

        async stop(): Promise<void> {
            this.stopCalls += 1;
        }

        async joinRoom(roomId: string, color: string) {
            this.joins.push({ roomId, color });
            if (config.joinError) throw config.joinError;
            return {
                roomId,
                players: config.players ?? [{ connectionId: 'conn-me', color }],
                randomBarrelPositions: [],
                roomCreatedAt: 1_700_000_000_000,
            };
        }

        async leaveRoom(roomId: string): Promise<void> {
            this.leaves.push(roomId);
        }

        async startMatch(roomId: string): Promise<void> {
            this.starts.push(roomId);
            if (config.startMatchError) throw config.startMatchError;
        }

        on(event: string, handler: (payload: unknown) => void): void {
            if (!this.handlers.has(event)) this.handlers.set(event, new Set());
            this.handlers.get(event)?.add(handler);
        }

        off(event: string, handler: (payload: unknown) => void): void {
            this.offEvents.push(event);
            this.handlers.get(event)?.delete(handler);
        }

        // Typed wrappers LobbyHubConnection exposes; they delegate to on/off so
        // the subscription bookkeeping below stays observable.
        onPlayerJoined(cb: (payload: unknown) => void): void {
            this.on('PlayerJoined', cb);
        }

        offPlayerJoined(cb: (payload: unknown) => void): void {
            this.off('PlayerJoined', cb);
        }

        onPlayerLeft(cb: (payload: unknown) => void): void {
            this.on('PlayerLeft', cb);
        }

        offPlayerLeft(cb: (payload: unknown) => void): void {
            this.off('PlayerLeft', cb);
        }

        onMatchStarted(cb: (payload: unknown) => void): void {
            this.on('MatchStarted', cb);
        }

        offMatchStarted(cb: (payload: unknown) => void): void {
            this.off('MatchStarted', cb);
        }

        emit(event: string, payload: unknown): void {
            this.handlers.get(event)?.forEach((handler) => handler(payload));
        }
    }

    return { config, instances, FakeHub };
});

vi.mock('../net/LobbyHubConnection', () => ({
    LobbyHubConnection: fakeHub.FakeHub,
}));

function hub(): (typeof fakeHub)['instances'][number] {
    return fakeHub.instances[fakeHub.instances.length - 1];
}

async function joinDefaultRoom(app: RenderedApp) {
    await app.user.click(app.screen.getByRole('button', { name: 'Join' }));
    return app.screen.findByRole('heading', { name: 'Room: local-dev-room' });
}

describe('LobbyScreen', () => {
    beforeEach(() => {
        seedSession();
        fakeHub.instances.length = 0;
        fakeHub.config.joinError = null;
        fakeHub.config.startMatchError = null;
        fakeHub.config.players = null;
    });

    it('joins the default room and marks me in the player list', async () => {
        const app = await renderApp();

        await joinDefaultRoom(app);

        expect(hub().hubUrl).toBe('http://localhost:8080/hubs/game');
        expect(hub().startCalls).toBe(1);
        expect(hub().joins).toEqual([
            { roomId: 'local-dev-room', color: 'blue' },
        ]);
        expect(app.screen.getByText('Blue')).toBeInTheDocument();
        expect(app.screen.getByText('you')).toBeInTheDocument();
        expect(app.screen.queryByRole('button', { name: 'Join' })).toBeNull();
    });

    it('joins a custom room with the picked tank color', async () => {
        const app = await renderApp();

        await app.user.clear(app.screen.getByLabelText(/^Room ID/));
        await app.user.type(app.screen.getByLabelText(/^Room ID/), 'squad-42');
        await app.user.click(
            app.screen.getByRole('combobox', { name: 'Tank color' }),
        );
        await app.user.click(
            await app.screen.findByRole('option', { name: 'Red' }),
        );

        await app.user.click(app.screen.getByRole('button', { name: 'Join' }));

        expect(
            await app.screen.findByRole('heading', {
                name: 'Room: squad-42',
            }),
        ).toBeInTheDocument();
        expect(hub().joins).toEqual([{ roomId: 'squad-42', color: 'red' }]);
        expect(app.screen.getByText('Red')).toBeInTheDocument();
        expect(app.screen.getByText('you')).toBeInTheDocument();
    });

    it('shows players as the hub reports them joining and leaving', async () => {
        fakeHub.config.players = [{ connectionId: 'conn-me', color: 'blue' }];
        const app = await renderApp();
        await joinDefaultRoom(app);

        await app.act(async () => {
            hub().emit('PlayerJoined', {
                connectionId: 'conn-other',
                color: 'green',
            });
        });
        expect(await app.screen.findByText('Green')).toBeInTheDocument();

        // The same connection reporting twice must not duplicate the row.
        await app.act(async () => {
            hub().emit('PlayerJoined', {
                connectionId: 'conn-other',
                color: 'green',
            });
        });
        expect(app.screen.getAllByText('Green')).toHaveLength(1);

        await app.act(async () => {
            hub().emit('PlayerLeft', { connectionId: 'conn-other' });
        });
        expect(app.screen.queryByText('Green')).toBeNull();
        expect(app.screen.getByText('Blue')).toBeInTheDocument();
    });

    it('surfaces a hub failure and stays on the join form', async () => {
        fakeHub.config.joinError = new Error('roomId is required');
        const app = await renderApp();

        await app.user.click(app.screen.getByRole('button', { name: 'Join' }));

        expect(
            await app.screen.findByText('Failed to join: roomId is required'),
        ).toBeInTheDocument();
        expect(
            app.screen.getByRole('heading', { name: 'Ready to roll?' }),
        ).toBeInTheDocument();
        expect(app.screen.getByRole('button', { name: 'Join' })).toBeEnabled();
    });

    it('leaves the room and tears the connection down', async () => {
        const app = await renderApp();
        await joinDefaultRoom(app);

        await app.user.click(
            app.screen.getByRole('button', { name: 'Leave room' }),
        );

        expect(
            await app.screen.findByRole('heading', {
                name: 'Ready to roll?',
            }),
        ).toBeInTheDocument();
        expect(hub().leaves).toEqual(['local-dev-room']);
        expect(hub().stopCalls).toBe(1);
        expect(hub().offEvents.sort()).toEqual([
            'MatchStarted',
            'PlayerJoined',
            'PlayerLeft',
        ]);
        // The join form is back, and its color select also reads "Blue", so
        // assert on the "you" marker that only the player list renders.
        expect(app.screen.queryByText('you')).toBeNull();
    });

    it('starts the match through the hub', async () => {
        const app = await renderApp();
        await joinDefaultRoom(app);

        await app.user.click(
            app.screen.getByRole('button', { name: 'Start Game' }),
        );

        await vi.waitFor(() =>
            expect(hub().starts).toEqual(['local-dev-room']),
        );
        expect(app.screen.queryByText('Failed to start game')).toBeNull();
    });

    it('reports a failed match start', async () => {
        fakeHub.config.startMatchError = new Error('not allowed');
        const app = await renderApp();
        await joinDefaultRoom(app);

        await app.user.click(
            app.screen.getByRole('button', { name: 'Start Game' }),
        );

        expect(
            await app.screen.findByText('Failed to start game'),
        ).toBeInTheDocument();
    });
});
