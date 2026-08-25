import { Physics, Scene, Tilemaps } from "phaser"

export class DeathWallManager {

	private mainScene: Scene
	private ringStart: number = 0
	private ringEnd: number = 0
	private step: number = 0
	private dangerLayer: Tilemaps.TilemapLayer | Tilemaps.TilemapGPULayer
	private effect: Phaser.Tweens.Tween[] = []
	private destroyed: Set<Tilemaps.Tile> = new Set()
	private startTime: number = 7000
	private destroyRingTime: number = 8000

	constructor(scene: Scene, map: Tilemaps.Tilemap, tankGroup: Physics.Arcade.Group) {
		this.mainScene = scene	
		const dangerTileset = map.addTilesetImage(
			'main_tileset',
			'main_tileset'
		)
		if (!dangerTileset) throw new Error("Tileset not found");
		this.dangerLayer = map.createLayer(
			'danger_layer',
			[dangerTileset]
		).setDepth(20)
		this.ringEnd = (this.dangerLayer.width / 64) - 1
		this.dangerLayer.forEachTile((tile) => tile.setAlpha(0.0))

		scene.physics.add.collider(this.dangerLayer, tankGroup)

		const deathWallTimer = scene.time.delayedCall(this.startTime, () => {
			this.start()
			scene.time.addEvent(({
				delay: this.destroyRingTime,
				loop: true,
				callback: () => {
					
					this.dangerLayer.forEachTile((tile) => {
						if (!this.destroyed.has(tile)) tile.setAlpha(0.0)
					})

					this.effect.forEach((effect) => {
						const tile = effect.targets[0] as Tilemaps.Tile

						effect.stop()
						effect.remove()
						this.effect = this.effect.filter((e) => {
							if (e === effect) return false })
						
						this.mainScene.events.emit('tileDestroy', tile)

						scene.events.emit("explosion", {
							x: tile.pixelX + tile.width / 2,
							y: tile.pixelY + tile.width / 2,
							type: "explosion",
							onComplete: () => {
								tile.index = dangerTileset.firstgid + 42
								tile.setCollision(true)
								tile.setAlpha(1.0)
								this.destroyed.add(tile)
							}
						})
					})

					this.step++
					this.start()
					if (this.step == 6)
						deathWallTimer.remove()
				}
			}))
		})
	}

	private start() {
		this.dangerLayer.forEachTile((tile) => {
			if ((tile.x == this.ringStart + this.step && tile.y >= this.step && tile.y <= this.ringEnd - this.step)
			|| (tile.y == this.ringStart + this.step && tile.x >= this.step && tile.x <= this.ringEnd - this.step))
				this.triggerDangerEffect(tile)
			if ((tile.x == this.ringEnd - this.step && tile.y >= this.step && tile.y <= this.ringEnd - this.step)
			|| tile.y == this.ringEnd - this.step && tile.x >= this.step && tile.x <= this.ringEnd - this.step)
				this.triggerDangerEffect(tile)
		})
	}
	
	private triggerDangerEffect(tile: Phaser.Tilemaps.Tile) {
		if (this.destroyed.has(tile)) return
		tile.setAlpha(0.5)
		this.effect.push(this.mainScene.tweens.add({
			targets: tile,
			alpha: 0.1,
			duration: 500,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: -1,
		}))
	}
}
