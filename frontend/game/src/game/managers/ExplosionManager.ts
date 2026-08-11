import { Scene } from "phaser"

export class ExplosionManager {

	private scene: Scene

	static preload(scene: Scene) {
		scene.load.image('explosion_1', 'sprites/explosion1.png')
		scene.load.image('explosion_2', 'sprites/explosion2.png')
		scene.load.image('explosion_3', 'sprites/explosion3.png')
		scene.load.image('explosion_4', 'sprites/explosion4.png')
		scene.load.image('explosion_5', 'sprites/explosion5.png')

		scene.load.image('explosion_smoke_1', 'sprites/explosionSmoke1.png')
		scene.load.image('explosion_smoke_2', 'sprites/explosionSmoke2.png')
		scene.load.image('explosion_smoke_3', 'sprites/explosionSmoke3.png')
		scene.load.image('explosion_smoke_4', 'sprites/explosionSmoke4.png')
		scene.load.image('explosion_smoke_5', 'sprites/explosionSmoke5.png')
	}

	constructor(scene: Scene) {
		this.scene = scene
		this.createAnims()
		this.registerEvent()
	}

	private registerEvent(): void {
		this.scene.events.on(
			"explosion",
			this.handleExplosion,
			this
		)
		this.scene.events.on(
			"explosion_smoke",
			this.handleExplosion,
			this
		)
		this.scene.events.on(
			"explosion_barrel",
			this.handleExplosion,
			this
		)
	}

	createAnims() {
		this.scene.anims.create({
			key: 'explosion',
			frames: [
				{ key: 'explosion_1' },
				{ key: 'explosion_2' },
				{ key: 'explosion_3' },
				{ key: 'explosion_4' },
				{ key: 'explosion_5' },
			],
			frameRate: 10,
			repeat: 0
		});
		this.scene.anims.create({
			key: 'explosion_smoke',
			frames: [
				{ key: 'explosion_smoke_1' },
				{ key: 'explosion_smoke_2' },
				{ key: 'explosion_smoke_3' },
				{ key: 'explosion_smoke_4' },
				{ key: 'explosion_smoke_5' },
			],
			frameRate: 10,
			repeat: 0
		});
	}

	private handleExplosion(data: {
		x: number,
		y: number,
		type: string
	}): void {

		var sprite: Phaser.GameObjects.Sprite

		switch (data.type) {
			case 'explosion':
				sprite = this.scene.add.sprite(data.x, data.y, 'explosion_1')
				sprite.depth = 100
				sprite.play("explosion")
				sprite.once('animationcomplete-explosion', () => {
					sprite.destroy()
				})
				break
			case 'explosion_smoke':
				sprite = this.scene.add.sprite(data.x, data.y, 'explosion_smoke_1')
				sprite.depth = 100
				sprite.play("explosion_smoke")
				sprite.once('animationcomplete-explosion_smoke', () => {
					sprite.destroy()
				})
				break
			default:
				console.log('explosion event unknown')
		}
	}
} 
