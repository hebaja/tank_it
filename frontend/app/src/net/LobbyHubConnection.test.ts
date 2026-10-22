import { beforeEach, describe, expect, it, vi } from 'vitest';

interface RecordedInvoke {
    method: string;
    args: unknown[];
}

type Handler = (payload: unknown) => void;

const fake = vi.hoisted(() => {
    class FakeHubConnection {
        state = 'Disconnected';
        startCalls = 0;
        stopCalls = 0;
        invokes: RecordedInvoke[] = [];
        handlers = new Map<string, Set<Handler>>();
        responses = new Map<string, unknown>();
        startError: Error | null = null;
        invokeError: Error | null = null;

        async start(): Promise<void> {
            this.startCalls += 1;
            if (this.startError) throw this.startError;
            this.state = 'Connected';
        }

        async stop(): Promise<void> {
            this.stopCalls += 1;
            this.state = 'Disconnected';
        }

        async invoke<T>(method: string, ...args: unknown[]): Promise<T> {
            this.invokes.push({ method, args });
            if (this.invokeError) throw this.invokeError;
            return this.responses.get(method) as T;
        }

        on(method: string, handler: Handler): void {
            if (!this.handlers.has(method))
                this.handlers.set(method, new Set());
            this.handlers.get(method)?.add(handler);
        }

        off(method: string, handler: Handler): void {
            this.handlers.get(method)?.delete(handler);
        }

        emit(method: string, payload: unknown): void {
            this.handlers.get(method)?.forEach((handler) => handler(payload));
        }
    }

    const state = {
        connections: [] as FakeHubConnection[],
        builder: { url: null as string | null, automaticReconnect: 0 },
    };

    return { FakeHubConnection, state };
});

vi.mock('@microsoft/signalr', () => ({
    HubConnectionBuilder: class {
        withUrl(url: string) {
            fake.state.builder.url = url;
            return this;
        }

        withAutomaticReconnect() {
            fake.state.builder.automaticReconnect += 1;
            return this;
        }

        build() {
            const connection = new fake.FakeHubConnection();
            fake.state.connections.push(connection);
            return connection;
        }
    },
}));

import { LobbyHubConnection } from './LobbyHubConnection';
import type { PlayerJoinedPayload } from './contracts';

function build(): {
    wrapper: LobbyHubConnection;
    connection: InstanceType<typeof fake.FakeHubConnection>;
} {
    const wrapper = new LobbyHubConnection('http://backend.test/hubs/game');
    return {
        wrapper,
        connection: fake.state.connections[fake.state.connections.length - 1],
    };
}

describe('LobbyHubConnection', () => {
    beforeEach(() => {
        fake.state.connections.length = 0;
        fake.state.builder.url = null;
        fake.state.builder.automaticReconnect = 0;
    });

    it('configures the hub URL and automatic reconnect', async () => {
        const { wrapper, connection } = build();
        await wrapper.start();

        expect(fake.state.builder).toEqual({
            url: 'http://backend.test/hubs/game',
            automaticReconnect: 1,
        });
        expect(connection.state).toBe('Connected');
        expect(wrapper.state).toBe('Connected');
    });

    it('starts the underlying connection only once', async () => {
        const { wrapper, connection } = build();

        await Promise.all([wrapper.start(), wrapper.start()]);
        await wrapper.start();

        expect(connection.startCalls).toBe(1);
    });

    it('can start again after a stop', async () => {
        const { wrapper, connection } = build();

        await wrapper.start();
        await wrapper.stop();
        await wrapper.start();

        expect(connection.stopCalls).toBe(1);
        expect(connection.startCalls).toBe(2);
    });

    it('joins, leaves and starts matches through the right hub methods', async () => {
        const { wrapper, connection } = build();
        connection.responses.set('JoinRoom', {
            roomId: 'room-7',
            players: [{ connectionId: 'conn-1', color: 'blue' }],
            randomBarrelPositions: [],
            roomCreatedAt: 1,
        });

        const status = await wrapper.joinRoom('room-7', 'blue');
        await wrapper.leaveRoom('room-7');
        await wrapper.startMatch('room-7');

        expect(connection.invokes).toEqual([
            { method: 'JoinRoom', args: ['room-7', 'blue'] },
            { method: 'LeaveRoom', args: ['room-7'] },
            { method: 'StartMatch', args: ['room-7'] },
        ]);
        expect(status.roomId).toBe('room-7');
        expect(status.players[0]).toEqual({
            connectionId: 'conn-1',
            color: 'blue',
        });
    });

    it('propagates hub failures to the caller', async () => {
        const { wrapper, connection } = build();
        connection.invokeError = new Error('roomId is required');

        await expect(wrapper.joinRoom('', 'blue')).rejects.toThrow(
            'roomId is required',
        );

        await wrapper.start();
        await wrapper.stop(); // clears the memoized start promise
        connection.startError = new Error('offline');
        await expect(wrapper.start()).rejects.toThrow('offline');
    });

    it('registers and removes event handlers as pairs', () => {
        const { wrapper, connection } = build();
        const joined = vi.fn();
        const left = vi.fn();
        const started = vi.fn();

        wrapper.onPlayerJoined(joined);
        wrapper.onPlayerLeft(left);
        wrapper.onMatchStarted(started);

        const payload: PlayerJoinedPayload = {
            connectionId: 'conn-2',
            color: 'green',
        };
        connection.emit('PlayerJoined', payload);
        connection.emit('PlayerLeft', { connectionId: 'conn-2' });
        connection.emit('MatchStarted', { roomId: 'room-7' });

        expect(joined).toHaveBeenCalledWith(payload);
        expect(left).toHaveBeenCalledWith({ connectionId: 'conn-2' });
        expect(started).toHaveBeenCalledWith({ roomId: 'room-7' });

        wrapper.offPlayerJoined(joined);
        wrapper.offPlayerLeft(left);
        wrapper.offMatchStarted(started);
        connection.emit('PlayerJoined', payload);
        connection.emit('PlayerLeft', { connectionId: 'conn-2' });
        connection.emit('MatchStarted', { roomId: 'room-7' });

        expect(joined).toHaveBeenCalledTimes(1);
        expect(left).toHaveBeenCalledTimes(1);
        expect(started).toHaveBeenCalledTimes(1);
    });
});
