import { Scene, Scenes, Tilemaps } from 'phaser';
import { Tank } from '../objects/Tank';
import { Projectile } from '../objects/Projectile';
import { ExplosionManager } from '../managers/ExplosionManager';
import { Barrel } from '../objects/Barrel';
import { AmmoGauge } from '../objects/AmmoGauge';
import { DeathWallManager } from '../managers/DeathWallManager';
import { MatchManager } from '../managers/MatchManager';
import { SpeedSystem } from '../systems/SpeedSystem';
import { GAME_CONFIG } from '../config/game';
import { GameEvent } from '../config/events';
import { Color } from '../config/color';
import { NetworkManager } from '../managers/NetworkManager';
import { sessionConfig } from '../../net/sessionConfig';
import type {
    Position,
    BlockDestroyPayload,
    PlayerInfo,
    PlayerJoinedPayload,
    RoomJoinedPayload,
    TankMovedPayload,
    DeathWallStepPayload,
    BarrelDestroyPayload,
    TankDestroyPayload,
    ProjectilePayload,
    ProjectilesCollidePayload,
    MatchEndedPayload,
    MatchStartedPayload,
    ChampionshipFinishedPayload,
    GameMode,
} from '../../net/contracts';
import { MusicTrack, SoundManager } from '../managers/SoundManager';
import { redirectToLobby } from '../../net/lobbyRedirect';

export class Game extends Scene {
    barrelGroup: Phaser.Physics.Arcade.Group;
    tankGroup: Phaser.Physics.Arcade.Group;
    projectileGroup: Phaser.Physics.Arcade.Group;
    matchManager: MatchManager;
    speedSystem: SpeedSystem;
    private explosionManager: ExplosionManager;
    private deathWallManager: DeathWallManager;
    private networkManager: NetworkManager;
    private soundManager: SoundManager;
    private tankRoster: Map<string, Tank>;
    private spawnPoints: Map<Color, { x: number; y: number; angle: number }> =
        new Map();
    private roomJoinedFallback: Phaser.Time.TimerEvent | null = null;
    private barrelPos: Position[] = [];
    private map: Tilemaps.Tilemap;
    private blocksLayer: Tilemaps.TilemapLayer | Tilemaps.TilemapGPULayer;
    private blocksHardLayer: Tilemaps.TilemapLayer | Tilemaps.TilemapGPULayer;
    private isShuttingDown: boolean = false;
    private blocksInitialState: number[][];
    private musicTrack: MusicTrack;
    private championshipId: string;
    private gameMode: GameMode = 'single';
    // Colors playing the current match. Null means no filter (before the first
    // MatchStarted). Tie-break matches exclude players eliminated from the championship.
    private activeColors: Set<Color> | null = null;

    constructor() {
        super('Game');
    }

    init() {
        this.isShuttingDown = false;
        this.musicTrack = SoundManager.pickMusicTrack();
    }

    preload() {
        this.load.setPath('assets');
        this.load.tilemapTiledJSON('level', 'map/tanks_map.json');
        this.load.image('main_tileset', 'map/main_tileset.png');
        this.load.font(
            'press-start-2p-regular',
            'fonts/PressStart2P-Regular.ttf',
        );

        Tank.preload(this);
        Projectile.preload(this);
        ExplosionManager.preload(this);
        Barrel.preload(this);
        SpeedSystem.preload(this);
        AmmoGauge.preload(this);
        SoundManager.preload(this, this.musicTrack);
    }

    create() {
        const { map, tanksSpawnLayer } = this.createMap();
        this.map = map;
        this.createGroups();
        this.collectSpawnPoints(tanksSpawnLayer);

        // TODO: Fallback: spawn all tanks if no RoomJoined after 3s (dev mode) -> might not need it
        this.roomJoinedFallback = this.time.delayedCall(3000, () => {
            if (this.tankRoster.size > 0) return;
            this.spawnPoints.forEach((_, color) =>
                this.ensureTank(color, color === sessionConfig.localColor),
            );
        });

        this.createManagers();
        this.createCollisions();
        this.registerSceneEvents();

        this.events.on(GameEvent.TankMoved, this.handleTankMoved, this);
        this.events.on(GameEvent.RoomJoined, this.handleRoomJoined, this);
        this.events.on(GameEvent.MatchStarted, this.handleMatchStarted, this);
        this.events.on(GameEvent.DeathWallStep, this.handleDeathWallStep, this);
        this.events.on(
            GameEvent.BlockDestroyed,
            this.handleBlockDestroyed,
            this,
        );
        this.events.on(
            GameEvent.BarrelDestroyed,
            this.handleBarrelDestroyed,
            this,
        );
        this.events.on(GameEvent.TankDestroyed, this.handleTankDestroyed, this);
        this.events.on(
            GameEvent.ProjectileFired,
            this.handleProjectileFired,
            this,
        );
        this.events.on(
            GameEvent.ProjectileDestroyed,
            this.handleProjectileDestroyed,
            this,
        );
        this.events.on(
            GameEvent.ProjectilesCollided,
            this.handleProjectilesCollided,
            this,
        );
        this.events.on(GameEvent.PlayerJoined, this.handlePlayerJoined, this);
        this.events.on(GameEvent.MatchEnded, this.handleMatchEnded, this);
        this.events.on(
            GameEvent.ChampionshipFinished,
            this.handleChampionshipFinished,
            this,
        );
        this.networkManager = new NetworkManager(this);
    }

    private createMap() {
        const map = this.make.tilemap({ key: 'level' });

        if (!map) throw new Error('Map could not be initialized');

        const HORIZONTAL_MARGIN = (this.scale.width - map.widthInPixels) / 2;

        this.cameras.main.setScroll(-HORIZONTAL_MARGIN, 0);
        this.physics.world.setBounds(
            0,
            0,
            map.widthInPixels,
            map.heightInPixels,
        );

        const terrainTileset = map.addTilesetImage(
            'main_tileset',
            'main_tileset',
        );
        const blocksTileset = map.addTilesetImage(
            'main_tileset',
            'main_tileset',
        );
        const blocksHardTileset = map.addTilesetImage(
            'main_tileset',
            'main_tileset',
        );

        if (!terrainTileset || !blocksTileset || !blocksHardTileset)
            throw new Error('Tileset not found');

        const backgroundLayer = map.createLayer('background', [terrainTileset]);
        this.blocksLayer = map.createLayer('blocks', [blocksTileset]);
        this.blocksHardLayer = map.createLayer('blocks_hard', [
            blocksHardTileset,
        ]);
        const tanksSpawnLayer = map.getObjectLayer('tanks_spawn');

        backgroundLayer.depth = GAME_CONFIG.depth.background;
        this.blocksLayer.depth = GAME_CONFIG.depth.blocks;
        this.blocksHardLayer.depth = GAME_CONFIG.depth.blocks;

        this.blocksLayer.setCollisionByExclusion([-1]);
        this.blocksHardLayer.setCollisionByExclusion([-1]);

        const w = this.blocksLayer.width;
        const h = this.blocksLayer.height;
        this.blocksInitialState = [];
        for (let row = 0; row < h; row++) {
            this.blocksInitialState[row] = [];
            for (let col = 0; col < w; col++) {
                this.blocksInitialState[row][col] =
                    this.blocksLayer.getTileAt(col, row)?.index ?? -1;
            }
        }
        return { map, tanksSpawnLayer };
    }

    private createManagers() {
        this.matchManager = new MatchManager(this);
        this.matchManager.reset();
        this.explosionManager = new ExplosionManager(this);
        this.speedSystem = new SpeedSystem(this, this.tankGroup);
        // TODO: avoid sound
        // this.soundManager = new SoundManager(this, this.musicTrack);
    }

    private createBarrels(map: Tilemaps.Tilemap) {
        this.barrelGroup.clear(true, true);

        const barrels = Barrel.generateRandomBarrels(this, this.barrelPos, map);
        for (let i = 0; i < barrels.length; i++)
            this.barrelGroup.add(barrels[i]);

        this.barrelGroup.children.forEach((child) =>
            (child as Barrel).setImmovable(true),
        );
    }

    private createGroups() {
        this.projectileGroup = this.physics.add.group();
        this.barrelGroup = this.physics.add.group();
        this.tankGroup = this.physics.add.group();
    }

    private createCollisions() {
        this.registerPassiveColliders();
        this.registerActiveColliders();
    }

    private registerPassiveColliders() {
        this.physics.add.collider(this.tankGroup, this.blocksLayer);
        this.physics.add.collider(this.tankGroup, this.blocksHardLayer);
        this.physics.add.collider(this.tankGroup, this.tankGroup);
        this.physics.add.collider(this.tankGroup, this.barrelGroup);
    }

    private registerActiveColliders() {
        this.physics.add.collider(
            this.projectileGroup,
            this.blocksLayer,
            (p, b) => {
                const proj = p as Projectile;
                const tile = b as Phaser.Tilemaps.Tile;

                if (proj.getOwner()?.getIsLocal()) {
                    this.destroyBlock(
                        tile.getCenterX(),
                        tile.getCenterY(),
                        tile.x,
                        tile.y,
                    );
                    this.events.emit(GameEvent.BlockDestroy, {
                        roomId: sessionConfig.roomId,
                        tileX: tile.x,
                        tileY: tile.y,
                        position: {
                            x: tile.getCenterX(),
                            y: tile.getCenterY(),
                        },
                    });
                }
                this.destroyProjectile(proj);
            },
        );

        this.physics.add.collider(
            this.projectileGroup,
            this.blocksHardLayer,
            (p) => {
                const proj = p as Projectile;
                this.events.emit(GameEvent.ExplosionSmoke, {
                    x: proj.x,
                    y: proj.y,
                    type: 'explosion_smoke',
                });
                proj.destroy();
            },
        );

        this.physics.add.collider(
            this.projectileGroup,
            this.barrelGroup,
            (p, b) => {
                const proj = p as Projectile;
                const barrel = b as Barrel;

                if (proj.getOwner()?.getIsLocal()) {
                    this.destroyBarrel(barrel);
                    this.events.emit(GameEvent.BarrelDestroy, {
                        roomId: sessionConfig.roomId,
                        index: barrel.getIndex(),
                    });
                }
                this.destroyProjectile(proj);
            },
        );

        this.physics.add.collider(
            this.projectileGroup,
            this.tankGroup,
            (p, t) => {
                const proj = p as Projectile;
                const tank = t as Tank;
                if (proj.getOwner() === tank) return;

                if (
                    tank.active &&
                    tank.getColor() == sessionConfig.localColor
                ) {
                    this.events.emit(GameEvent.TankDestroy, {
                        roomId: sessionConfig.roomId,
                        championshipId: this.championshipId,
                        color: tank.getColor(),
                        x: tank.x,
                        y: tank.y,
                        wallStep: null,
                    });
                }
                this.destroyTank(tank);
                this.destroyProjectile(proj);
            },
        );

        this.physics.add.collider(
            this.projectileGroup,
            this.projectileGroup,
            (p1, p2) => {
                const projA = p1 as Projectile;
                const projB = p2 as Projectile;
                if (!projA.active || !projB.active) return;
                this.events.emit(GameEvent.Explosion, {
                    x: (projA.x + projB.x) / 2,
                    y: (projA.y + projB.y) / 2,
                    type: 'explosion',
                });
                this.events.emit(GameEvent.ProjectileHitProjectile);
                if (projA.getColor() === sessionConfig.localColor)
                    this.events.emit(GameEvent.ProjectilesCollide, {
                        projectileA: this.fillProjectilePayload(projA),
                        projectileB: this.fillProjectilePayload(projB),
                        timestamp: Date.now(),
                    });
                projA.destroy();
                projB.destroy();
            },
        );
    }

    fillProjectilePayload(proj: Projectile): ProjectilePayload {
        return {
            roomId: sessionConfig.roomId,
            ownerId: proj.getOwner()?.getColor() ?? '',
            projectileId: proj.getId(),
            origin: {
                x: proj.x,
                y: proj.y,
            },
            angle: proj.angle,
            color: proj.getColor(),
            timestamp: proj.getTimestamp(),
            sequence: 0,
        };
    }

    private destroyBlock(x: number, y: number, tileX: number, tileY: number) {
        this.events.emit(GameEvent.Explosion, {
            x: x,
            y: y,
            type: 'explosion',
        });
        this.blocksLayer.removeTileAt(tileX, tileY);
    }

    private destroyBarrel(barrel: Barrel) {
        this.events.emit(GameEvent.Explosion, {
            x: barrel.x,
            y: barrel.y,
            type: 'explosion',
        });
        barrel.destroy();
        this.time.delayedCall(GAME_CONFIG.timing.oilSpawnDelay, () => {
            this.speedSystem.addOil(barrel.x, barrel.y);
        });
    }

    private destroyTank(tank: Tank) {
        tank.destroy();
        this.events.emit(GameEvent.Explosion, {
            x: tank.x,
            y: tank.y,
            type: 'explosion',
        });
        this.matchManager.checkEnd(this.tankGroup);
    }

    private destroyProjectile(proj: Projectile) {
        const owner = proj.getOwner();
        const projectileId = proj.getId();
        const color = proj.getColor();
        proj.destroy();
        if (!owner?.getIsLocal()) return;

        this.events.emit(GameEvent.ProjectileDestroy, {
            roomId: sessionConfig.roomId,
            ownerId: owner.getColor(),
            projectileId: projectileId,
            origin: {
                x: proj.x,
                y: proj.y,
            },
            angle: proj.angle,
            color: color,
            timestamp: Date.now(),
            sequence: 0,
        } satisfies ProjectilePayload);
    }

    private registerSceneEvents() {
        this.events.once(Scenes.Events.SHUTDOWN, this.shutdown, this);
        // this.events.on
        this.events.on(
            GameEvent.TileDestroy,
            ({ tile, step }: { tile: Tilemaps.Tile; step: number }) => {
                this.tankGroup.getChildren().forEach((t) => {
                    const tank: Tank = t as Tank;
                    const body = tank.body;
                    if (!body) return;
                    if (
                        tile.intersects(
                            body.left,
                            body.top,
                            body.right,
                            body.bottom,
                        )
                    ) {
                        this.events.emit(GameEvent.Explosion, {
                            x: tank.x,
                            y: tank.y,
                            type: GameEvent.Explosion,
                        });
                        if (
                            tank.active &&
                            tank.getColor() == sessionConfig.localColor
                        ) {
                            this.events.emit(GameEvent.TankDestroy, {
                                roomId: sessionConfig.roomId,
                                championshipId: this.championshipId,
                                color: tank.getColor(),
                                x: tank.x,
                                y: tank.y,
                                wallStep: step,
                            });
                        }
                        this.destroyTank(tank);
                    }
                });
            },
        );
    }

    shutdown() {
        this.isShuttingDown = true;

        if (this.roomJoinedFallback) {
            this.roomJoinedFallback.remove();
            this.roomJoinedFallback = null;
        }

        this.explosionManager.destroy();
        this.deathWallManager?.destroy();
        this.speedSystem.destroy();
        this.events.off(GameEvent.TileDestroy);
        this.networkManager.destroy();
        this.soundManager.destroy();
        this.events.off(GameEvent.TankMoved, this.handleTankMoved, this);
        this.events.off(GameEvent.RoomJoined, this.handleRoomJoined, this);
        this.events.off(GameEvent.MatchStarted, this.handleMatchStarted, this);
        this.events.off(
            GameEvent.DeathWallStep,
            this.handleDeathWallStep,
            this,
        );
        this.events.off(
            GameEvent.BlockDestroyed,
            this.handleBlockDestroyed,
            this,
        );
        this.events.off(
            GameEvent.BarrelDestroyed,
            this.handleBarrelDestroyed,
            this,
        );
        this.events.off(
            GameEvent.TankDestroyed,
            this.handleTankDestroyed,
            this,
        );
        this.events.off(
            GameEvent.ProjectileFired,
            this.handleProjectileFired,
            this,
        );
        this.events.off(
            GameEvent.ProjectileDestroyed,
            this.handleProjectileDestroyed,
            this,
        );
        this.events.off(
            GameEvent.ProjectilesCollided,
            this.handleProjectilesCollided,
            this,
        );
        this.events.off(GameEvent.PlayerJoined, this.handlePlayerJoined, this);
        this.events.off(
            GameEvent.ChampionshipFinished,
            this.handleChampionshipFinished,
            this,
        );
    }

    private collectSpawnPoints(tanksSpawnLayer: Tilemaps.ObjectLayer | null) {
        this.tankRoster = new Map();
        this.spawnPoints.clear();

        tanksSpawnLayer?.objects.forEach((obj) => {
            const properties = obj.properties as
                { name: string; value: unknown }[] | undefined;
            const colorValue = properties?.find(
                (property) => property.name === 'type_color',
            )?.value;
            const angle = properties?.find(
                (property) => property.name === 'angle',
            )?.value;

            if (
                typeof colorValue !== 'string' ||
                !Object.values(Color).includes(colorValue as Color) ||
                typeof angle !== 'number'
            ) {
                return;
            }

            this.spawnPoints.set(colorValue as Color, {
                x: obj.x ?? 0,
                y: obj.y ?? 0,
                angle,
            });
        });
    }

    private handleTankMoved = (payload: TankMovedPayload) =>
        this.tankRoster.get(payload.playerId)?.receiveRemoteState(payload);

    private handleRoomJoined = (payload: RoomJoinedPayload) => {
        this.barrelPos = payload.randomBarrelPositions;
        this.championshipId = payload.championshipId;
        this.gameMode = payload.mode;

        // TODO: Cancel fallback — we have real player data -> might not need it
        if (this.roomJoinedFallback) {
            this.roomJoinedFallback.remove();
            this.roomJoinedFallback = null;
        }

        const playersByColor = new Map<string, PlayerInfo>();
        for (const player of payload.players)
            if (!playersByColor.has(player.color))
                playersByColor.set(player.color, player);

        if (playersByColor.size !== payload.players.length)
            console.warn(
                `[RoomJoined] Duplicate player colors in room ${payload.roomId}; spawning one tank per color`,
            );

        for (const player of playersByColor.values())
            this.ensureTank(
                player.color as Color,
                player.color === sessionConfig.localColor,
            );

        if (this.map) {
            this.createBarrels(this.map);
            if (!this.deathWallManager) {
                this.deathWallManager = new DeathWallManager(
                    this,
                    this.map,
                    this.tankGroup,
                    payload.deathWallStep,
                );
            } else {
                this.deathWallManager.reset(payload.deathWallStep);
            }
        }
    };

    private handlePlayerJoined = (payload: PlayerJoinedPayload) => {
        const color = payload.color as Color;
        if (!this.isActive(color)) return;
        this.ensureTank(color, false);
    };

    private isActive(color: Color): boolean {
        return this.activeColors === null || this.activeColors.has(color);
    }

    private ensureTank(color: Color, isLocal: boolean): Tank | undefined {
        const existing = this.tankRoster.get(color);

        if (existing) return existing;

        const spawn = this.spawnPoints.get(color);
        if (!spawn) {
            console.warn(`[TankSpawn] No spawn point for color ${color}`);
            return undefined;
        }
        const tank = new Tank(
            this,
            spawn.x,
            spawn.y,
            spawn.angle,
            color,
            this.tankGroup,
            this.projectileGroup,
            isLocal,
        );
        this.tankRoster.set(color, tank);

        return tank;
    }

    private handleMatchStarted = (payload: MatchStartedPayload) => {
        if (this.isShuttingDown) return;

        this.scene.resume();
        this.scene.stop('Overlay');
        this.tankGroup.clear(true, true);
        this.tankRoster.clear();
        this.projectileGroup.clear();
        this.speedSystem.clearOilGroup();
        this.deathWallManager?.reset();

        this.barrelPos = payload.randomBarrelPositions;
        this.createBarrels(this.map);

        this.activeColors =
            payload.activeColors && payload.activeColors.length > 0
                ? new Set(payload.activeColors)
                : null;

        for (let row = 0; row < this.blocksInitialState.length; row++) {
            for (
                let col = 0;
                col < this.blocksInitialState[row].length;
                col++
            ) {
                const idx = this.blocksInitialState[row][col];
                if (idx === -1) {
                    this.blocksLayer.removeTileAt(col, row);
                } else {
                    this.blocksLayer.putTileAt(idx, col, row);
                }
            }
        }

        const playersByColor = new Map<string, PlayerInfo>();

        for (const player of payload.players)
            if (!playersByColor.has(player.color))
                playersByColor.set(player.color, player);

        if (playersByColor.size !== payload.players.length)
            console.warn(
                `[RoomJoined] Duplicate player colors in room ${payload.roomId}; spawning one tank per color`,
            );

        for (const player of playersByColor.values()) {
            const color = player.color as Color;
            if (!this.isActive(color)) continue;
            this.ensureTank(color, color === sessionConfig.localColor);
        }
    };

    private handleDeathWallStep = (p: DeathWallStepPayload) =>
        this.deathWallManager?.applyStep(p.step);

    private handleBlockDestroyed = (payload: BlockDestroyPayload) => {
        this.destroyBlock(
            payload.position.x,
            payload.position.y,
            payload.tileX,
            payload.tileY,
        );
    };

    private handleBarrelDestroyed = (payload: BarrelDestroyPayload) => {
        const barrel = this.barrelGroup
            .getChildren()
            .find((c) => (c as Barrel).getIndex() === payload.index) as
            Barrel | undefined;
        if (!barrel) return;
        this.destroyBarrel(barrel);
    };

    private handleTankDestroyed = (payload: TankDestroyPayload) => {
        const tank = this.tankGroup
            .getChildren()
            .find((c) => (c as Tank).getColor() === payload.color) as
            Tank | undefined;
        if (!tank) return;
        this.destroyTank(tank);
    };

    private handleProjectileFired = (payload: ProjectilePayload) => {
        this.tankRoster.get(payload.color)?.fireRemoteProjectile(payload);
    };

    private handleProjectileDestroyed = (payload: ProjectilePayload) => {
        const proj = this.projectileGroup
            .getChildren()
            .find((c) => (c as Projectile).getId() === payload.projectileId) as
            Projectile | undefined;
        if (!proj) return;
        proj.destroy();
    };

    private handleProjectilesCollided = (
        payload: ProjectilesCollidePayload,
    ) => {
        const ids = [
            payload.projectileA.projectileId,
            payload.projectileB.projectileId,
        ];

        this.projectileGroup
            .getChildren()
            .filter((c) => ids.includes((c as Projectile).getId()))
            .forEach((proj) => (proj as Projectile).destroy());
    };

    private handleMatchEnded = (payload: MatchEndedPayload) => {
        this.time.delayedCall(GAME_CONFIG.timing.matchEndOverlayDelay, () => {
            this.scene.pause();
            this.scene.launch('Overlay', payload);
        });
    };

    private handleChampionshipFinished = (
        payload: ChampionshipFinishedPayload,
    ) => {
        if (this.isShuttingDown) return;
        if (payload.roomId !== sessionConfig.roomId) return;

        this.isShuttingDown = true;
        redirectToLobby();
    };
}
