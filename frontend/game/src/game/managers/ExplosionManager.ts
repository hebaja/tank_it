import { Scene } from "phaser"
import { GAME_CONFIG } from "../config/game"
import { GameEvent } from "../config/events"

export class ExplosionManager {

	private scene: Scene

	static preload(scene: Scene) {
		scene.load.image('explosion_1', 'sprites/explosion_1.png')
		scene.load.image('explosion_2', 'sprites/explosion_2.png')
		scene.load.image('explosion_3', 'sprites/explosion_3.png')
		scene.load.image('explosion_4', 'sprites/explosion_4.png')
		scene.load.image('explosion_5', 'sprites/explosion_5.png')

		scene.load.image('explosion_smoke_1', 'sprites/explosion_smoke_1.png')
		scene.load.image('explosion_smoke_2', 'sprites/explosion_smoke_2.png')
		scene.load.image('explosion_smoke_3', 'sprites/explosion_smoke_3.png')
		scene.load.image('explosion_smoke_4', 'sprites/explosion_smoke_4.png')
		scene.load.image('explosion_smoke_5', 'sprites/explosion_smoke_5.png')
	}

	constructor(scene: Scene) {
		this.scene = scene
		this.createAnims()
		this.registerEvent()
	}

	private registerEvent(): void {
		this.scene.events.on(
			GameEvent.Explosion,
			this.handleExplosion,
			this
		)
		this.scene.events.on(
			GameEvent.ExplosionSmoke,
			this.handleExplosion,
			this
		)
	}

	createAnims() {
		if (!this.scene.anims.exists(GameEvent.Explosion)) {
			this.scene.anims.create({
				key: GameEvent.Explosion,
				frames: [
					{ key: 'explosion_1' },
					{ key: 'explosion_2' },
					{ key: 'explosion_3' },
					{ key: 'explosion_4' },
					{ key: 'explosion_5' },
				],
				frameRate: 10,
				repeat: 0
			})
		}
		if (!this.scene.anims.exists(GameEvent.ExplosionSmoke)) {
			this.scene.anims.create({
				key: GameEvent.ExplosionSmoke,
				frames: [
					{ key: 'explosion_smoke_1' },
					{ key: 'explosion_smoke_2' },
					{ key: 'explosion_smoke_3' },
					{ key: 'explosion_smoke_4' },
					{ key: 'explosion_smoke_5' },
				],
				frameRate: 10,
				repeat: 0
			})
		}
	}

	private handleExplosion(data: {
		x: number,
		y: number,
		type: string,
		onComplete?: () => void
	}): void {

		var sprite: Phaser.GameObjects.Sprite

		switch (data.type) {
			case GameEvent.Explosion:
				sprite = this.scene.add.sprite(data.x, data.y, 'explosion_1')
				sprite.depth = GAME_CONFIG.depth.explosion
				sprite.play(GameEvent.Explosion)
				sprite.once('animationcomplete-explosion', () => {
					sprite.destroy()
					data.onComplete?.()
				})
				break
			case 'explosion_smoke':
				sprite = this.scene.add.sprite(data.x, data.y, 'explosion_smoke_1')
				sprite.depth = GAME_CONFIG.depth.explosion
				sprite.play(GameEvent.ExplosionSmoke)
				sprite.once('animationcomplete-explosion_smoke', () => {
					sprite.destroy()
					data.onComplete?.()
				})
				break
			default:
				console.log('explosion event unknown')
		}
	}
} 
