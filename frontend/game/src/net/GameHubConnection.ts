import * as signalR from '@microsoft/signalr';
import type {
    BarrelDestroyPayload,
    BlockDestroyPayload,
    DeathWallStepPayload,
    MatchEndPayload,
    MatchStartedPayload,
    ProjectilePayload,
    ProjectilesCollidePayload,
    RoomJoinedPayload,
    TankDestroyPayload,
    TankMovePayload,
    TankMovedPayload,
} from './contracts';

const DEFAULT_HUB_URL = 'http://localhost:8080/hubs/game';

export class GameHubConnection {
    private conn: signalR.HubConnection;
    private started: Promise<void> | null = null;
    private connectionId: string | null = null;

    constructor(hubUrl: string = DEFAULT_HUB_URL) {
        this.conn = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl)
            .withAutomaticReconnect()
            .build();
    }

    getConnectionId(): string | null {
        return this.connectionId;
    }

    async start(): Promise<void> {
        if (!this.started) this.started = this.conn.start();
        return this.started;
    }

    async stop(): Promise<void> {
        this.started = null;
        await this.conn.stop();
    }

    async joinRoom(
        roomId: string,
        color: string,
        isChamp: boolean,
    ): Promise<RoomJoinedPayload> {
        const joined = await this.conn.invoke<RoomJoinedPayload>(
            'JoinRoom',
            roomId,
            color,
            isChamp,
        );
        this.connectionId = joined.connectionId;
        return joined;
    }
    async leaveRoom(roomId: string): Promise<void> {
        await this.conn.invoke('LeaveRoom', roomId);
    }

    sendTankMove(payload: TankMovePayload): void {
        if (this.conn.state !== signalR.HubConnectionState.Connected) return;
        this.conn
            .send('TankMove', payload)
            .catch((err) =>
                console.warn('[GameHubConnection] TankMove send failed', err),
            );
    }

    sendMatchEnd(payload: MatchEndPayload): void {
        if (this.conn.state !== signalR.HubConnectionState.Connected) return;
        this.conn
            .send('MatchEnd', payload)
            .catch((err) =>
                console.warn('[GameHubConnectio] MatchEnd send failed', err),
            );
    }

    sendStartMatch(roomId: string): void {
        if (this.conn.state !== signalR.HubConnectionState.Connected) return;
        this.conn
            .send('StartMatch', roomId)
            .catch((err) =>
                console.warn('[GameHubConnection] StartMatch send failed', err),
            );
    }

    sendBlockDestroy(payload: BlockDestroyPayload): void {
        if (this.conn.state !== signalR.HubConnectionState.Connected) return;
        this.conn
            .send('BlockDestroy', payload)
            .catch((err) =>
                console.warn(
                    '[GameHubConnection] BlockDestroyed send failed',
                    err,
                ),
            );
    }

    sendBarrelDestroy(payload: BarrelDestroyPayload): void {
        if (this.conn.state !== signalR.HubConnectionState.Connected) return;
        this.conn
            .send('BarrelDestroy', payload)
            .catch((err) =>
                console.warn(
                    '[GameHubConnection] DestroyBarrel send failed',
                    err,
                ),
            );
    }

    sendTankDestroy(payload: TankDestroyPayload): void {
        if (this.conn.state !== signalR.HubConnectionState.Connected) return;
        this.conn
            .send('TankDestroy', payload)
            .catch((err) =>
                console.warn(
                    '[GameHubConnection] TankDestroy send failed',
                    err,
                ),
            );
    }

    sendProjectileFire(payload: ProjectilePayload): void {
        if (this.conn.state !== signalR.HubConnectionState.Connected) return;
        this.conn
            .send('ProjectileFire', payload)
            .catch((err) =>
                console.warn(
                    '[GameHubConnection] ProjectileFire send failed',
                    err,
                ),
            );
    }

    sendProjectileDestroy(payload: ProjectilePayload): void {
        if (this.conn.state !== signalR.HubConnectionState.Connected) return;
        this.conn
            .send('ProjectileDestroy', payload)
            .catch((err) =>
                console.warn(
                    '[GameHubConnection] ProjectileDestroy send failed',
                    err,
                ),
            );
    }

    sendProjectilesCollide(payload: ProjectilesCollidePayload): void {
        if (this.conn.state !== signalR.HubConnectionState.Connected) return;
        this.conn
            .send('ProjectilesCollide', payload)
            .catch((err) =>
                console.warn(
                    '[GameHubConnection] ProjectilesCollide send failed',
                    err,
                ),
            );
    }

    onTankMoved(cb: (p: TankMovedPayload) => void): void {
        this.conn.on('TankMoved', cb);
    }
    offTankMoved(cb: (p: TankMovedPayload) => void): void {
        this.conn.off('TankMoved', cb);
    }
    onMatchStarted(cb: (p: MatchStartedPayload) => void): void {
        this.conn.on('MatchStarted', cb);
    }
    offMatchStarted(cb: (p: MatchStartedPayload) => void): void {
        this.conn.off('MatchStarted', cb);
    }
    onDeathWallStep(cb: (p: DeathWallStepPayload) => void): void {
        this.conn.on('DeathWallStep', cb);
    }
    offDeathWallStep(cb: (p: DeathWallStepPayload) => void): void {
        this.conn.off('DeathWallStep', cb);
    }
    onBlockDestroyed(cb: (p: BlockDestroyPayload) => void): void {
        this.conn.on('BlockDestroyed', cb);
    }
    offBlockDestroyed(cb: (p: BlockDestroyPayload) => void): void {
        this.conn.off('BlockDestroyed', cb);
    }
    onBarrelDestroyed(cb: (p: BarrelDestroyPayload) => void): void {
        this.conn.on('BarrelDestroyed', cb);
    }
    offBarrelDestroyed(cb: (p: BarrelDestroyPayload) => void): void {
        this.conn.off('BarrelDestroyed', cb);
    }
    onTankDestroyed(cb: (p: TankDestroyPayload) => void): void {
        this.conn.on('TankDestroyed', cb);
    }
    offTankDestroyed(cb: (p: TankDestroyPayload) => void): void {
        this.conn.off('TankDestroyed', cb);
    }
    onProjectileFired(cb: (p: ProjectilePayload) => void): void {
        this.conn.on('ProjectileFired', cb);
    }
    offProjectileFired(cb: (p: ProjectilePayload) => void): void {
        this.conn.off('ProjectileFired', cb);
    }
    onProjectileDestroyed(cb: (p: ProjectilePayload) => void): void {
        this.conn.on('ProjectileDestroyed', cb);
    }
    offProjectileDestroyed(cb: (p: ProjectilePayload) => void): void {
        this.conn.off('ProjectileDestroyed', cb);
    }
    onProjectilesCollided(cb: (p: ProjectilesCollidePayload) => void): void {
        this.conn.on('ProjectilesCollided', cb);
    }
    offProjectilesCollided(cb: (p: ProjectilesCollidePayload) => void): void {
        this.conn.off('ProjectilesCollided', cb);
    }

    get state(): signalR.HubConnectionState {
        return this.conn.state;
    }
}
