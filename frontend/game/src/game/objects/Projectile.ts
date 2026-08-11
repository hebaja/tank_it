import { Physics, Scene } from "phaser";
import { Color } from "../config/color.ts";

export class Projectile extends Physics.Arcade.Sprite {

	static preload(scene: Scene) {
		scene.load.image(`projectile_${Color.blue}`, 'sprites/bulletBlue1_outline.png')
		scene.load.image(`projectile_${Color.red}`, 'sprites/bulletRed1_outline.png')
		scene.load.image(`projectile_${Color.green}`, 'sprites/bulletGreen1_outline.png')
		scene.load.image(`projectile_${Color.dark}`, 'sprites/bulletDark1_outline.png')
	}

	constructor(scene: Scene, x: number, y: number, angle: number, color: Color, group: Phaser.Physics.Arcade.Group) {
		super(scene, x, y, `projectile_${color}`)

		scene.add.existing(this)
		scene.physics.add.existing(this)

		group.add(this)

		this.setCollideWorldBounds(true, 0, 0, true)
		this.scene.physics.world.on('worldbounds', (body: Physics.Arcade.Body) => {
			if (body.gameObject === this)
				this.destroy()
		})

		this.angle = angle - 180;

		const velocity = this.scene.physics.velocityFromAngle(this.angle - 90, 400)
		this.setVelocity(velocity.x, velocity.y)
	}

	destroy(fromScene?: boolean): void {
		super.destroy(fromScene)
	}

	update() {

	}
}
