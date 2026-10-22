import { Scene } from 'phaser';
import { GameHubConnection } from '../../net/GameHubConnection';
import { GameEvent } from '../config/events';
import { sessionConfig } from '../../net/sessionConfig';
import type {
    BarrelDestroyPayload,
    BlockDestroyPayload,
    DeathWallStepPayload,
    MatchEndPayload,
    MatchStartedPayload,
    ProjectileFirePayload,
    ProjectilesCollidePayload,
    RoomJoinedPayload,
    TankDestroyPayload,
    TankMovePayload,
    TankMovedPayload,
} from '../../net/contracts';

export class NetworkManager {
    private scene: Scene;
    private hub: GameHubConnection;
    public readonly ready: Promise<RoomJoinedPayload>;

    constructor(scene: Scene) {
        this.scene = scene;
        this.hub = new GameHubConnection(sessionConfig.hubUrl);
        this.hub.onTankMoved(this.handleTankMoved);
        this.hub.onMatchStarted(this.handleMatchStarted);
        this.hub.onDeathWallStep(this.handleDeathWallStep);
        this.hub.onBlockDestroyed(this.handleBlockDestroyed);
        this.hub.onBarrelDestroyed(this.handleBarrelDestroyed);
        this.hub.onTankDestroyed(this.handleTankDestroyed);
        this.hub.onProjectileFired(this.handleProjectileFired);
        this.hub.onProjectileDestroyed(this.handleProjectileDestroyed);
        this.hub.onProjectilesCollided(this.handleProjectilesCollided);
        this.scene.events.on(
            GameEvent.TankMove,
            this.handleLocalTankMove,
            this,
        );
        this.scene.events.on(GameEvent.MatchEnd, this.handleMatchEnd, this);
        this.scene.events.on(
            GameEvent.MatchRestartRequested,
            this.handleRestartRequested,
            this,
        );
        this.scene.events.on(
            GameEvent.BlockDestroy,
            this.handleBlockDestroy,
            this,
        );
        this.scene.events.on(
            GameEvent.BarrelDestroy,
            this.handleBarrelDestroy,
            this,
        );
        this.scene.events.on(
            GameEvent.TankDestroy,
            this.handleTankDestroy,
            this,
        );
        this.scene.events.on(
            GameEvent.ProjectileFire,
            this.handleProjectileFire,
            this,
        );
        this.scene.events.on(
            GameEvent.ProjectileDestroy,
            this.handleProjectileDestroy,
            this,
        );
        this.scene.events.on(
            GameEvent.ProjectilesCollide,
            this.handleProjectilesCollide,
            this,
        );
        this.ready = this.hub
            .start()
            .then(() =>
                this.hub.joinRoom(
                    sessionConfig.roomId,
                    sessionConfig.localColor,
                ),
            )
            .then((dto) => {
                this.scene.events.emit(GameEvent.RoomJoined, dto);
                return dto;
            })
            .catch((err): never => {
                console.warn('[NetworkManager] connect/join failed', err);
                throw err;
            });
    }

    getConnectionId(): string | null {
        return this.hub.getConnectionId();
    }

    private handleLocalTankMove = (payload: TankMovePayload) =>
        this.hub.sendTankMove(payload);
    private handleTankMoved = (payload: TankMovedPayload) =>
        this.scene.events.emit(GameEvent.TankMoved, payload);
    private handleMatchEnd = (payload: MatchEndPayload) =>
        this.hub.sendMatchEnd(payload);
    private handleMatchStarted = (payload: MatchStartedPayload) =>
        this.scene.events.emit(GameEvent.MatchStarted, payload);
    private handleRestartRequested = () => {
        this.hub.sendStartMatch(sessionConfig.roomId);
    };
    private handleDeathWallStep = (p: DeathWallStepPayload) =>
        this.scene.events.emit(GameEvent.DeathWallStep, p);
    private handleBlockDestroy = (payload: BlockDestroyPayload) =>
        this.hub.sendBlockDestroy(payload);
    private handleBlockDestroyed = (payload: BlockDestroyPayload) =>
        this.scene.events.emit(GameEvent.BlockDestroyed, payload);
    private handleBarrelDestroy = (payload: BarrelDestroyPayload) =>
        this.hub.sendBarrelDestroy(payload);
    private handleBarrelDestroyed = (payload: BarrelDestroyPayload) =>
        this.scene.events.emit(GameEvent.BarrelDestroyed, payload);
    private handleTankDestroy = (payload: TankDestroyPayload) =>
        this.hub.sendTankDestroy(payload);
    private handleTankDestroyed = (payload: TankDestroyPayload) =>
        this.scene.events.emit(GameEvent.TankDestroyed, payload);
    private handleProjectileFire = (payload: ProjectileFirePayload) =>
        this.hub.sendProjectileFire(payload);
    private handleProjectileFired = (payload: ProjectileFirePayload) =>
        this.scene.events.emit(GameEvent.ProjectileFired, payload);
    private handleProjectileDestroy = (payload: ProjectileFirePayload) =>
        this.hub.sendProjectileDestroy(payload);
    private handleProjectileDestroyed = (payload: ProjectileFirePayload) =>
        this.scene.events.emit(GameEvent.ProjectileDestroyed, payload);
    private handleProjectilesCollide = (payload: ProjectilesCollidePayload) =>
        this.hub.sendProjectilesCollide(payload);
    private handleProjectilesCollided = (payload: ProjectilesCollidePayload) =>
        this.scene.events.emit(GameEvent.ProjectilesCollided, payload);

    destroy() {
        this.scene.events.off(
            GameEvent.TankMove,
            this.handleLocalTankMove,
            this,
        );
        this.scene.events.off(GameEvent.MatchEnd, this.handleMatchEnd, this);
        this.scene.events.off(
            GameEvent.MatchRestartRequested,
            this.handleRestartRequested,
            this,
        );
        this.scene.events.off(
            GameEvent.BarrelDestroy,
            this.handleBarrelDestroy,
            this,
        );
        this.scene.events.off(
            GameEvent.TankDestroy,
            this.handleTankDestroy,
            this,
        );
        this.scene.events.off(
            GameEvent.ProjectileFire,
            this.handleProjectileFire,
            this,
        );
        this.scene.events.off(
            GameEvent.ProjectileDestroy,
            this.handleProjectileDestroy,
            this,
        );
        this.scene.events.off(
            GameEvent.ProjectilesCollide,
            this.handleProjectilesCollide,
            this,
        );
        this.scene.events.off(
            GameEvent.BlockDestroy,
            this.handleBlockDestroy,
            this,
        );
        this.hub.offTankMoved(this.handleTankMoved);
        this.hub.offMatchStarted(this.handleMatchStarted);
        this.hub.offDeathWallStep(this.handleDeathWallStep);
        this.hub.offBarrelDestroyed(this.handleBarrelDestroyed);
        this.hub.offTankDestroyed(this.handleTankDestroyed);
        this.hub.offBlockDestroyed(this.handleBlockDestroyed);
        this.hub.offProjectileFired(this.handleProjectileFired);
        this.hub.offProjectileDestroyed(this.handleProjectileDestroyed);
        this.hub.offProjectilesCollided(this.handleProjectilesCollided);
        this.hub.leaveRoom(sessionConfig.roomId).catch(() => {});
        this.hub.stop().catch(() => {});
    }
}
