import { Physics, Scene, Tilemaps } from "phaser"
import { GAME_CONFIG } from "../config/game"
import { GameEvent } from "../config/events"

const DEATH_WALL_RINGS = 6 // must match DeathWallTimer.MaxStep on backend

export class DeathWallManager {

	private scene: Scene
	private ringEnd: number = 0
	private step: number = -1
	private destroyedIndex: number
	private dangerLayer: Tilemaps.TilemapLayer | Tilemaps.TilemapGPULayer
	private effect: Phaser.Tweens.Tween[] = []
	private destroyed: Set<Tilemaps.Tile> = new Set()

	// initialStep: server step at join time (-1 = wall not started yet)
	constructor(scene: Scene, map: Tilemaps.Tilemap, tankGroup: Physics.Arcade.Group, initialStep: number = -1) {
		this.scene = scene
		const dangerTileset = map.addTilesetImage('main_tileset','main_tileset')
		if (!dangerTileset) throw new Error("Tileset not found")
		this.destroyedIndex = dangerTileset.firstgid + 45
		this.dangerLayer = map.createLayer('danger_layer', [dangerTileset]).setDepth(GAME_CONFIG.depth.dangerLayer)
		this.ringEnd = (this.dangerLayer.width / 64) - 1
		this.dangerLayer.forEachTile((tile) => tile.setAlpha(0.0))

		scene.physics.add.collider(this.dangerLayer, tankGroup)

		if (initialStep >= 0) this.catchUp(initialStep)
	}

	// Called on each server DeathWallStep event.
	applyStep(step: number): void {
		if (step <= this.step) return // ignore duplicate/stale
		this.explodeWarned()
		this.step = step
		if (step < DEATH_WALL_RINGS)
			this.forEachRingTile(step, (tile) => this.triggerDangerEffect(tile))
	}

	destroy(): void {
		this.effect.forEach(e => { e.stop(); e.remove() })
		this.effect = []
	}

	// Late join: rings before `step` already exploded -> place walls silently.
	private catchUp(step: number) {
		for (let ring = 0; ring < Math.min(step, DEATH_WALL_RINGS); ring++)
			this.forEachRingTile(ring, (tile) => this.markDestroyed(tile))
		this.step = step
		if (step < DEATH_WALL_RINGS)
			this.forEachRingTile(step, (tile) => this.triggerDangerEffect(tile))
	}

	private explodeWarned() {
		const tweens = this.effect
		this.effect = []
		tweens.forEach((effect) => {
			const tile = effect.targets[0] as Tilemaps.Tile
			effect.stop()
			effect.remove()
			tile.setAlpha(0.0)

			this.scene.events.emit(GameEvent.TileDestroy, tile)
			this.scene.events.emit(GameEvent.Explosion, {
				x: tile.pixelX + tile.width / 2,
				y: tile.pixelY + tile.width / 2,
				type: GameEvent.Explosion,
				onComplete: () => this.markDestroyed(tile)
			})
		})
	}

	private markDestroyed(tile: Tilemaps.Tile) {
		tile.index = this.destroyedIndex
		tile.setCollision(true)
		tile.setAlpha(1.0)
		this.destroyed.add(tile)
	}

	// Same selection as the old start(): border of square [ring, ringEnd - ring].
	private forEachRingTile(ring: number, fn: (tile: Tilemaps.Tile) => void)
	{
		const min = ring
		const max = this.ringEnd - ring
		this.dangerLayer.forEachTile((tile) => {
			const inside = tile.x >= min && tile.x <= max && tile.y >= min && tile.y <= max
			const onEdge = tile.x === min || tile.x === max || tile.y === min || tile.y === max
			if (inside && onEdge) fn(tile)
		})
	}

	private triggerDangerEffect(tile: Tilemaps.Tile) {
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
