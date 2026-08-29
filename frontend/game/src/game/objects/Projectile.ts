import { Physics, Scene } from "phaser";
import { Color } from "../config/color.ts";
import { GAME_CONFIG } from "../config/game";
import type { Tank } from "./Tank"

export class Projectile extends Physics.Arcade.Sprite {

	owner: Tank | null = null

	static preload(scene: Scene) {
		scene.load.image(`projectile_${Color.blue}`, 'sprites/bullet_blue_outline.png')
		scene.load.image(`projectile_${Color.red}`, 'sprites/bullet_red_outline.png')
		scene.load.image(`projectile_${Color.green}`, 'sprites/bullet_green_outline.png')
		scene.load.image(`projectile_${Color.dark}`, 'sprites/bullet_dark_outline.png')
	}

	constructor(scene: Scene, x: number, y: number, angle: number, color: Color, group: Phaser.Physics.Arcade.Group, owner: Tank | null = null) {
		super(scene, x, y, `projectile_${color}`)

		scene.add.existing(this)
		scene.physics.add.existing(this)

		group.add(this)

		this.owner = owner
		this.setCollideWorldBounds(true, 0, 0, true)
		this.scene.physics.world.on('worldbounds', (body: Physics.Arcade.Body) => {
			if (body.gameObject === this)
				this.destroy()
		})

		this.angle = angle - 180;

		const velocity = this.scene.physics.velocityFromAngle(this.angle - 90, GAME_CONFIG.projectile.speed)
		this.setVelocity(velocity.x, velocity.y)
	}

	destroy(fromScene?: boolean): void {
		super.destroy(fromScene)
	}

	update() {

	}
}
