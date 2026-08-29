import { Scene, Tilemaps } from 'phaser';
import { Tank } from '../objects/Tank';
import { Projectile } from '../objects/Projectile';
import { ExplosionManager } from '../managers/ExplosionManager';
import { Barrel } from '../objects/Barrel';
import { Oil } from '../objects/Oil';
import { AmmoGauge } from '../objects/AmmoGauge';
import { Color } from '../config/color';
import { DeathWallManager } from '../managers/DeathWallManager';
import { MatchManager, MatchPlacement } from '../managers/MatchManager';
import { GameEvent } from '../config/events';

export class Game extends Scene {
	oils: Oil[] = []
	barrelGroup: Phaser.Physics.Arcade.Group
	tankGroup: Phaser.Physics.Arcade.Group
	projectileGroup: Phaser.Physics.Arcade.Group
	matchManager: MatchManager
	matchPlacements: MatchPlacement[] = []
	matchPlace: number = 3
	matchPoints: number = 0

	constructor() {
		super('Game');
	}

	preload() {
		this.load.setPath('assets');
		this.load.tilemapTiledJSON('level', 'map/tanks_map.json')
		this.load.image(
			'main_tileset',
			'map/main_tileset.png'
		)

		Tank.preload(this)
		Projectile.preload(this)
		ExplosionManager.preload(this)
		Barrel.preload(this)
		Oil.preload(this)
		AmmoGauge.preload(this)
	}

	create() {
		this.matchPlace = 3
		this.matchPoints = 0
		this.matchPlacements = []
		const map = this.make.tilemap({ key: 'level' })
		const HORIZONTAL_MARGIN = (this.scale.width - map.widthInPixels) / 2

		if (!map)
			throw new Error('Map could not be initialized')

		this.cameras.main.setScroll(-HORIZONTAL_MARGIN, 0)
		this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels)
		this.matchManager = new MatchManager(this)
		const em = new ExplosionManager(this)

		const terrainTileset = map.addTilesetImage(
			'main_tileset',
			'main_tileset'
		)
		const blocksTileset = map.addTilesetImage(
			'main_tileset',
			'main_tileset'
		)
		const blocksHardTileset = map.addTilesetImage(
			'main_tileset',
			'main_tileset'
		)

		if (!terrainTileset || !blocksTileset || !blocksHardTileset) {
			throw new Error("Tileset not found");
		}
		const backgroundLayer = map.createLayer(
			'background',
			[terrainTileset]
		)
		const blocksLayer = map.createLayer(
			'blocks',
			[blocksTileset]
		)
		const blocksHardLayer = map.createLayer(
			'blocks_hard',
			[blocksHardTileset]
		)

		backgroundLayer.depth = 0
		blocksLayer.depth = 10
		blocksHardLayer.depth = 10

		this.projectileGroup = this.physics.add.group()
		this.barrelGroup = this.physics.add.group()
		this.initTanks()
		const dwm = new DeathWallManager(this, map, this.tankGroup)

		blocksLayer.setCollisionByExclusion([-1]);
		blocksHardLayer.setCollisionByExclusion([-1]);

		this.physics.add.collider(this.tankGroup, blocksLayer)
		this.physics.add.collider(this.tankGroup, blocksHardLayer)

		this.physics.add.collider(this.tankGroup, this.tankGroup)
		const randomPos = Barrel.generateRandomPositions(map.width, map.height, 10, blocksLayer, blocksHardLayer)
		const barrels = Barrel.generateRandomBarrels(this, randomPos, map)

		for (let i = 0; i < barrels.length; i++) this.barrelGroup.add(barrels[i])

		this.barrelGroup.children.forEach((child) => (child as Barrel).setImmovable(true))

		this.physics.add.collider(this.tankGroup, this.barrelGroup)

		this.physics.add.collider(this.projectileGroup, blocksLayer,
			(p, b) => {
				const proj = p as Projectile
				const tile = b as Phaser.Tilemaps.Tile
				this.events.emit(GameEvent.Explosion, {
					x: tile.getCenterX(),
					y: tile.getCenterY(),
					type: 'explosion',
				})
				blocksLayer.removeTileAt(tile.x, tile.y)
				proj.destroy()
			})

		this.physics.add.collider(this.projectileGroup, blocksHardLayer,
			(p) => {
				const proj = p as Projectile
				this.events.emit(GameEvent.ExplosionSmoke, {
					x: proj.x,
					y: proj.y,
					type: 'explosion_smoke',
				})
				proj.destroy()
			})

		this.physics.add.collider(this.projectileGroup, this.barrelGroup,
			(p, b) => {
				const proj = p as Projectile
				const barrel = b as Barrel
				const bx = barrel.x
				const by = barrel.y
				this.events.emit(GameEvent.Explosion, {
					x: bx,
					y: by,
					type: 'explosion',
				})
				proj.destroy()
				barrel.destroy()
				this.time.delayedCall(400, () => {
					this.oils.push(new Oil(this, bx, by))
				})
			})

		this.physics.add.collider(this.projectileGroup, this.tankGroup,
			(p, t) => {
				const proj = p as Projectile
				const tank = t as Tank
				if (proj.owner === tank) return
				this.events.emit(GameEvent.Explosion, {
					x: tank.x,
					y: tank.y,
					type: 'explosion',
				})
				this.placeTankInMatch(tank)
				proj.destroy()
				tank.destroy()
			})

		this.physics.add.collider(this.projectileGroup, this.projectileGroup,
			(p1, p2) => {
				const proj1 = p1 as Projectile
				const proj2 = p2 as Projectile
				if (!proj1.active || !proj2.active) return
				this.events.emit(GameEvent.Explosion, {
					x: (proj1.x + proj2.x) / 2,
					y: (proj1.y + proj2.y) / 2,
					type: 'explosion',
				})
				proj1.destroy()
				proj2.destroy()
			})
		this.events.on(GameEvent.TileDestroy, (tile: Tilemaps.Tile) => {
			this.tankGroup.getChildren().forEach(t => {
				const tank: Tank = t as Tank
				const body = tank.body
				if (!body) return
				if (tile.intersects(body.left, body.top, body.right, body.bottom))
				{
					this.events.emit(GameEvent.Explosion, {
						x: tank.x,
						y: tank.y,
						type: GameEvent.Explosion
					})
					this.placeTankInMatch(tank)
					tank.destroy()
				}
			})
		})
	}

	update() {
		this.tankGroup.getChildren().forEach(t => {
		let onOil = false
		const tank: Tank = t as Tank

		for (let i = 0; i < this.oils.length; i++)
			this.physics.world.overlap(tank, this.oils[i], () => onOil = true )
			tank.slowDown(onOil)
		})

		if(this.tankGroup.getLength() == 1) {
			const winner = this.tankGroup.getChildren().find(t => {
				const tank = t as Tank
				return tank.getColor()
			}) as Tank | undefined
			
			if (winner) {
				if (this.matchPlacements.length < 4)
				{
					this.matchPlacements.push({
						color: winner.getColor(),
						points: this.matchPoints++,
						place: this.matchPlace--,
						timestamp: Date.now()
					})
					this.events.emit(GameEvent.MatchEnd, {
						placements: this.matchPlacements,
					})
				}
			}
		}
		if (this.tankGroup.getLength() == 0) {
				this.events.emit(GameEvent.MatchEnd, {
					placements: this.matchPlacements,
				})
		}
	}
	
	initTanks() {
		Tank.tankIndex = 0
		this.tankGroup = this.physics.add.group()
		// 25, 25, Color.blue
		// 25, 925, Color.red
		// 925, 925, Color.green
		// 925, 25, Color.dark
		new Tank(this, 25, 25, Color.blue, Tank.tankIndex++, this.tankGroup)
		new Tank(this, 25, 925, Color.red, Tank.tankIndex++, this.tankGroup)
		new Tank(this, 925, 925, Color.green, Tank.tankIndex++, this.tankGroup)
		new Tank(this, 925, 25, Color.dark, Tank.tankIndex++, this.tankGroup)
	}

	placeTankInMatch(tank: Tank) {
		if (tank.active) this.matchPlacements.push({
			color: tank.getColor(),
			points: this.matchPoints++,
			place: this.matchPlace--,
			timestamp: Date.now()
		})
		if (this.matchPlacements.length >= 1)
			for (let index = this.matchPlacements.length - 1; index > 0; index--) {
				if (index - 1 == -1) break
				if (Math.abs(this.matchPlacements[index - 1].timestamp - this.matchPlacements[index].timestamp) <= 1)
					this.matchPlacements[index - 1].points = this.matchPlacements[index].points
			}
	}
}
