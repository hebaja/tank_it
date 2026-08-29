import { Scene, Tilemaps } from 'phaser';
import { Tank } from '../objects/Tank';
import { Projectile } from '../objects/Projectile';
import { ExplosionManager } from '../managers/ExplosionManager';
import { Barrel } from '../objects/Barrel';
import { AmmoGauge } from '../objects/AmmoGauge';
import { Color } from '../config/color';
import { DeathWallManager } from '../managers/DeathWallManager';
import { MatchManager } from '../managers/MatchManager';
import { SpeedSystem } from '../systems/SpeedSystem';
import { GAME_CONFIG } from '../config/game';
import { GameEvent } from '../config/events';

type MapLayers = {
	blocksLayer: Tilemaps.TilemapLayer | Tilemaps.TilemapGPULayer;
	blocksHardLayer: Tilemaps.TilemapLayer | Tilemaps.TilemapGPULayer;
}

export class Game extends Scene {
	barrelGroup: Phaser.Physics.Arcade.Group;
	tankGroup: Phaser.Physics.Arcade.Group;
	projectileGroup: Phaser.Physics.Arcade.Group;
	matchManager: MatchManager;
	speedSystem: SpeedSystem;

	constructor() {
		super('Game');
	}

	preload() {
		this.load.setPath('assets');
		this.load.tilemapTiledJSON('level', 'map/tanks_map.json');
		this.load.image('main_tileset', 'map/main_tileset.png');

		Tank.preload(this);
		Projectile.preload(this);
		ExplosionManager.preload(this);
		Barrel.preload(this);
		SpeedSystem.preload(this);
		AmmoGauge.preload(this);
	}

	create() {
		const map = this.createMap();
		this.createGroups();
		this.initTanks();
		this.createManagers(map);
		this.createBarrels(map);
		this.createCollisions(map.blocksLayer, map.blocksHardLayer);
		this.registerSceneEvents();
	}

	private createMap(): Tilemaps.Tilemap & MapLayers {
		const map = this.make.tilemap({ key: 'level' });

		if (!map)
			throw new Error('Map could not be initialized');

		const HORIZONTAL_MARGIN = (this.scale.width - map.widthInPixels) / 2;

		this.cameras.main.setScroll(-HORIZONTAL_MARGIN, 0);
		this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

		const terrainTileset = map.addTilesetImage('main_tileset', 'main_tileset');
		const blocksTileset = map.addTilesetImage('main_tileset', 'main_tileset');
		const blocksHardTileset = map.addTilesetImage('main_tileset', 'main_tileset');

		if (!terrainTileset || !blocksTileset || !blocksHardTileset)
			throw new Error("Tileset not found");

		const backgroundLayer = map.createLayer('background', [terrainTileset]);
		const blocksLayer = map.createLayer('blocks', [blocksTileset]);
		const blocksHardLayer = map.createLayer('blocks_hard', [blocksHardTileset]);

		backgroundLayer.depth = GAME_CONFIG.depth.background;
		blocksLayer.depth = GAME_CONFIG.depth.blocks;
		blocksHardLayer.depth = GAME_CONFIG.depth.blocks;

		blocksLayer.setCollisionByExclusion([-1]);
		blocksHardLayer.setCollisionByExclusion([-1]);

		return Object.assign(map, { blocksLayer, blocksHardLayer });
	}

	private createGroups() {
		this.projectileGroup = this.physics.add.group();
		this.barrelGroup = this.physics.add.group();
	}

	private createManagers(map: Tilemaps.Tilemap) {
		this.matchManager = new MatchManager(this);
		this.matchManager.reset();
		new ExplosionManager(this);
		new DeathWallManager(this, map, this.tankGroup);
		this.speedSystem = new SpeedSystem(this, this.tankGroup);
	}

	private createBarrels(map: Tilemaps.Tilemap & MapLayers) {
		const randomPos = Barrel.generateRandomPositions(
			map.width, map.height, GAME_CONFIG.barrel.count,
			map.blocksLayer, map.blocksHardLayer,
		);
		const barrels = Barrel.generateRandomBarrels(this, randomPos, map);
		for (let i = 0; i < barrels.length; i++)
			this.barrelGroup.add(barrels[i]);

		this.barrelGroup.children.forEach((child) => (child as Barrel).setImmovable(true));
	}

	private createCollisions(
		blocksLayer: Tilemaps.TilemapLayer | Tilemaps.TilemapGPULayer,
		blocksHardLayer: Tilemaps.TilemapLayer | Tilemaps.TilemapGPULayer,
	) {
		this.registerPassiveColliders(blocksLayer, blocksHardLayer);
		this.registerActiveColliders(blocksLayer, blocksHardLayer);
	}

	private registerPassiveColliders(
		blocksLayer: Tilemaps.TilemapLayer | Tilemaps.TilemapGPULayer,
		blocksHardLayer: Tilemaps.TilemapLayer | Tilemaps.TilemapGPULayer,
	) {
		this.physics.add.collider(this.tankGroup, blocksLayer);
		this.physics.add.collider(this.tankGroup, blocksHardLayer);
		this.physics.add.collider(this.tankGroup, this.tankGroup);
		this.physics.add.collider(this.tankGroup, this.barrelGroup);
	}

	private registerActiveColliders(
		blocksLayer: Tilemaps.TilemapLayer | Tilemaps.TilemapGPULayer,
		blocksHardLayer: Tilemaps.TilemapLayer | Tilemaps.TilemapGPULayer,
	) {
		this.physics.add.collider(this.projectileGroup, blocksLayer,
			(p, b) => {
				const proj = p as Projectile;
				const tile = b as Phaser.Tilemaps.Tile;
				this.events.emit(GameEvent.Explosion, {
					x: tile.getCenterX(),
					y: tile.getCenterY(),
					type: 'explosion',
				});
				blocksLayer.removeTileAt(tile.x, tile.y);
				proj.destroy();
			});

		this.physics.add.collider(this.projectileGroup, blocksHardLayer,
			(p) => {
				const proj = p as Projectile;
				this.events.emit(GameEvent.ExplosionSmoke, {
					x: proj.x,
					y: proj.y,
					type: 'explosion_smoke',
				});
				proj.destroy();
			});

		this.physics.add.collider(this.projectileGroup, this.barrelGroup,
			(p, b) => {
				const proj = p as Projectile;
				const barrel = b as Barrel;
				const bx = barrel.x;
				const by = barrel.y;
				this.events.emit(GameEvent.Explosion, {
					x: bx,
					y: by,
					type: 'explosion',
				});
				proj.destroy();
				barrel.destroy();
				this.time.delayedCall(GAME_CONFIG.timing.oilSpawnDelay, () => {
					this.speedSystem.addOil(bx, by);
				});
			});

		this.physics.add.collider(this.projectileGroup, this.tankGroup,
			(p, t) => {
				const proj = p as Projectile;
				const tank = t as Tank;
				if (proj.owner === tank) return;
				this.events.emit(GameEvent.Explosion, {
					x: tank.x,
					y: tank.y,
					type: 'explosion',
				});
				this.matchManager.recordPlacement(tank);
				proj.destroy();
				tank.destroy();
			});

		this.physics.add.collider(this.projectileGroup, this.projectileGroup,
			(p1, p2) => {
				const proj1 = p1 as Projectile;
				const proj2 = p2 as Projectile;
				if (!proj1.active || !proj2.active) return;
				this.events.emit(GameEvent.Explosion, {
					x: (proj1.x + proj2.x) / 2,
					y: (proj1.y + proj2.y) / 2,
					type: 'explosion',
				});
				proj1.destroy();
				proj2.destroy();
			});
	}

	private registerSceneEvents() {
		this.events.on(GameEvent.TileDestroy, (tile: Tilemaps.Tile) => {
			this.tankGroup.getChildren().forEach(t => {
				const tank: Tank = t as Tank;
				const body = tank.body;
				if (!body) return;
				if (tile.intersects(body.left, body.top, body.right, body.bottom))
				{
					this.events.emit(GameEvent.Explosion, {
						x: tank.x,
						y: tank.y,
						type: GameEvent.Explosion,
					});
					this.matchManager.recordPlacement(tank);
					tank.destroy();
				}
			});
		});
	}

	update() {
		const winner = this.tankGroup.getLength() === 1
			? this.tankGroup.getChildren().find(t => (t as Tank).getColor()) as Tank | undefined
			: undefined;

		this.matchManager.checkEnd(this.tankGroup.getLength(), winner);
	}
	
	initTanks() {
		this.tankGroup = this.physics.add.group();
		const spawns = GAME_CONFIG.spawn;
		new Tank(this, spawns[Color.blue].x, spawns[Color.blue].y, Color.blue, 0, this.tankGroup, this.projectileGroup);
		new Tank(this, spawns[Color.red].x, spawns[Color.red].y, Color.red, 1, this.tankGroup, this.projectileGroup);
		new Tank(this, spawns[Color.green].x, spawns[Color.green].y, Color.green, 2, this.tankGroup, this.projectileGroup);
		new Tank(this, spawns[Color.dark].x, spawns[Color.dark].y, Color.dark, 3, this.tankGroup, this.projectileGroup);
	}
}
