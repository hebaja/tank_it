import { Physics, Scene, Tilemaps } from "phaser"
import { GAME_CONFIG } from "../config/game"
import { GameEvent } from "../config/events"

export class DeathWallManager {

	private scene: Scene
	private ringStart: number = 0
	private ringEnd: number = 0
	private step: number = 0
	private dangerLayer: Tilemaps.TilemapLayer | Tilemaps.TilemapGPULayer
	private effect: Phaser.Tweens.Tween[] = []
	private destroyed: Set<Tilemaps.Tile> = new Set()

	constructor(scene: Scene, map: Tilemaps.Tilemap, tankGroup: Physics.Arcade.Group) {
		this.scene = scene
		const dangerTileset = map.addTilesetImage(
			'main_tileset',
			'main_tileset'
		)
		if (!dangerTileset) throw new Error("Tileset not found");
		this.dangerLayer = map.createLayer(
			'danger_layer',
			[dangerTileset]
		).setDepth(GAME_CONFIG.depth.dangerLayer)
		this.ringEnd = (this.dangerLayer.width / 64) - 1
		this.dangerLayer.forEachTile((tile) => tile.setAlpha(0.0))

		scene.physics.add.collider(this.dangerLayer, tankGroup)

		const deathWallTimer = scene.time.delayedCall(GAME_CONFIG.timing.deathWallStartTime, () => {
			this.start()
			scene.time.addEvent(({
				delay: GAME_CONFIG.timing.deathWallRingInterval,
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
						
						this.scene.events.emit(GameEvent.TileDestroy, tile)

						scene.events.emit(GameEvent.Explosion, {
							x: tile.pixelX + tile.width / 2,
							y: tile.pixelY + tile.width / 2,
							type: GameEvent.Explosion,
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
		this.effect.push(this.scene.tweens.add({
			targets: tile,
			alpha: 0.1,
			duration: 500,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: -1,
		}))
	}
}
