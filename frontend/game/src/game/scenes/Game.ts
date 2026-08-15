import { Scene } from 'phaser';
import { Tank } from '../objects/Tank';
import { Projectile } from '../objects/Projectile';
import { ExplosionManager } from '../managers/ExplosionManager';
import { Barrel } from '../objects/Barrel';
import { Oil } from '../objects/Oil';
import { AmmoGauge } from '../objects/AmmoGauge';
import { Color } from '../config/color';

export class Game extends Scene {
	tanks: Tank[] = []
	oils: Oil[] = []
	barrelGroup: Phaser.Physics.Arcade.Group
	tankGroup: Phaser.Physics.Arcade.Group
	projectileGroup: Phaser.Physics.Arcade.Group

	constructor() {
		super('Game');
	}

	preload() {
		this.load.setPath('assets');
		this.load.tilemapTiledJSON('level', 'map/tanks_map.json')
		this.load.image(
			'terrain_tileset',
			'map/terrainTiles_default.png'
		)
		this.load.image(
			'corner',
			'map/corner.png'
		)
		this.load.image(
			'stone',
			'map/stone.png'
		)
		this.load.image(
			'rock',
			'map/rock.png'
		)
		this.load.image(
			'danger',
			'map/red_tile.png'
		)

		Tank.preload(this)
		Projectile.preload(this)
		ExplosionManager.preload(this)
		Barrel.preload(this)
		Oil.preload(this)
		AmmoGauge.preload(this)
	}

	create() {
		const map = this.make.tilemap({ key: 'level' })

		if (!map)
			throw new Error('Map could not be initialized')

		const HORIZONTAL_MARGIN = (this.scale.width - map.widthInPixels) / 2

		this.cameras.main.setScroll(-HORIZONTAL_MARGIN, 0)

		this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels)

		const em = new ExplosionManager(this)

		const terrainTileset = map.addTilesetImage(
			'terrain_tileset',
			'terrain_tileset'
		)
		const cornerTileset = map.addTilesetImage(
			'corner',
			'corner'
		)
		const dangerTileset = map.addTilesetImage(
			'red_tile',
			'danger'
		)
		const blocksTileset = map.addTilesetImage(
			'stone',
			'stone'
		)
		const blocksHardTileset = map.addTilesetImage(
			'rock',
			'rock'
		)

		if (!terrainTileset || !cornerTileset || !dangerTileset || !blocksTileset || !blocksHardTileset) {
			throw new Error("Tileset not found");
		}
		const backgroundLayer = map.createLayer(
			'background',
			[terrainTileset, cornerTileset]
		)
		const blocksLayer = map.createLayer(
			'blocks',
			[blocksTileset]
		)
		const blocksHardLayer = map.createLayer(
			'blocks_hard',
			[blocksHardTileset]
		)
		const dangerLayer = map.createLayer(
			'danger_layer',
			[dangerTileset]
		)

		backgroundLayer.depth = 0
		blocksLayer.depth = 10
		blocksHardLayer.depth = 10
		dangerLayer.depth = 20

		this.tankGroup = this.physics.add.group()
		this.projectileGroup = this.physics.add.group()
		this.barrelGroup = this.physics.add.group()

		new Tank(this, 25, 25, Color.blue, Tank.tankIndex++, this.tankGroup)
		new Tank(this, 25, 925, Color.red, Tank.tankIndex++, this.tankGroup)
		new Tank(this, 925, 925, Color.green, Tank.tankIndex++, this.tankGroup)
		new Tank(this, 925, 25, Color.dark, Tank.tankIndex++, this.tankGroup)

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

		var rowStart = 0
		var rowEnd = (dangerLayer.width / 64) - 1
		var count = 3

		dangerLayer.forEachTile((tile) => {
			tile.setAlpha(0.0)
		})

		dangerLayer.forEachTile((tile) => {
			if ((tile.x == rowStart + count && tile.y >= count && tile.y <= rowEnd - count)
			|| (tile.y == rowStart + count && tile.x >= count && tile.x <= rowEnd - count))
				this.triggerDangerEffect(tile)
			if ((tile.x == rowEnd - count && tile.y >= count && tile.y <= rowEnd - count)
			|| tile.y == rowEnd - count && tile.x >= count && tile.x <= rowEnd - count)
				this.triggerDangerEffect(tile)
		})

		this.events.on('projectileFired', (projectile: Projectile) => {

			this.physics.add.collider(
				projectile,
				blocksLayer,
				(p, b) => {
					const blockTile = b as Phaser.Tilemaps.Tile
					const proj = p as Projectile

					this.events.emit("explosion", {
						x: blockTile.getCenterX(),
						y: blockTile.getCenterY(),
						type: "explosion"
					})
					blocksLayer.removeTileAt(blockTile.x, blockTile.y)
					proj.destroy()
				})
			this.physics.add.collider(
				projectile,
				blocksHardLayer,
				(p) => {
					const proj = p as Projectile

					this.events.emit("explosion_smoke", {
						x: proj.x,
						y: proj.y,
						type: "explosion_smoke"
					})
					proj.destroy()
				})
			this.physics.add.collider(
				projectile,
				this.barrelGroup,
				(p, b) => {
					const proj = p as Projectile
					const barrel = b as Barrel
					const barrelX = barrel.x
					const barrelY = barrel.y

					this.events.emit("explosion", {
						x: barrelX,
						y: barrelY,
						type: "explosion"
					})
					proj.destroy()
					barrel.destroy()
					this.time.delayedCall(400, () => {
						this.oils.push(new Oil(this, barrelX, barrelY))
					})
				})
			this.physics.add.collider(
				projectile,
				this.tankGroup,
				(p, t) => {
					const proj = p as Projectile
					const tank = t as Tank

					if (tank.getProjectile() === proj) return

					this.events.emit("explosion", {
						x: tank.x,
						y: tank.y,
						type: "explosion"
					})

					proj.destroy()
					tank.destroy()
				})
			this.physics.add.collider(
				this.projectileGroup,
				this.projectileGroup,
				(p1, p2) => {
					const proj1 = p1 as Projectile
					const proj2 = p2 as Projectile

					if (!proj1.active || !proj2.active) return

					this.events.emit("explosion", {
						x: (proj1.x + proj2.x) / 2,
						y: (proj1.y + proj2.y) / 2,
						type: "explosion"
					})

					proj1.destroy()
					proj2.destroy()
				})
		})
	}

	triggerDangerEffect(tile: Phaser.Tilemaps.Tile) {
		tile.setAlpha(0.5)
		this.tweens.add({
			targets: tile,
			alpha: 0.1,
			duration: 500,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: -1,
		})
	}

	update() {
		this.tankGroup.getChildren().forEach(t => {
		let onOil = false
		const tank : Tank = t as Tank

		for (let i = 0; i < this.oils.length; i++)
			this.physics.world.overlap(tank, this.oils[i], () => onOil = true )
		tank.slowDown(onOil)
		})
	}
}
