import { GameObjects, Scene } from "phaser"

export class Oil extends GameObjects.Sprite {

	static preload(scene: Scene) {
		scene.load.image('oil', 'barrels/oil_spill.png')
	}

	constructor(scene: Scene, x: number, y: number) {
		super(scene, x, y, 'oil')

		scene.add.existing(this)
		scene.physics.add.existing(this)

		const body = this.body as Phaser.Physics.Arcade.Body
		body.setSize(this.width * 0.5, this.height * 0.5)
		body.setOffset(this.width * 0.25, this.height * 0.25)
	}
}
