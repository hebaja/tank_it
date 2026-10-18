import { Scene } from "phaser";
import { GameEvent } from "../config/events";

export class SoundManager {

	private scene: Scene

	static preload(scene: Scene) {
		scene.load.audio('tank-fire', [
			'sounds/sfx/tank_fire.ogg',
			'sounds/sfx/tank_fire.mp3'
		])
		scene.load.audio('block-destroy', [
			'sounds/sfx/block_destroy.ogg',
			'sounds/sfx/block_destroy.mp3'
		])
		scene.load.audio('barrel-destroy', [
			'sounds/sfx/barrel_destroy.ogg',
			'sounds/sfx/barrel_destroy.mp3'
		])
		scene.load.audio('gray-explosion', [
			'sounds/sfx/gray_explosion.ogg',
			'sounds/sfx/gray_explosion.mp3'
		])
	
	}

	constructor(scene: Scene) {
		this.scene = scene
		this.scene.events.on(GameEvent.ProjectileFired, this.handleProjectileFired, this)
		this.scene.events.on(GameEvent.BlockDestroy, this.handleBlockDestroy, this)
		this.scene.events.on(GameEvent.BarrelDestroy, this.handleBarrelDestroy, this)
		this.scene.events.on(GameEvent.ExplosionSmoke, this.handleGrayExplosion, this)
	}

	handleProjectileFired() {
		this.scene.sound.play('tank-fire', { volume: 0.4 })
	}

	handleBlockDestroy() {
		this.scene.sound.play('block-destroy', { volume: 0.4 })
	}

	handleBarrelDestroy() {
		this.scene.sound.play('barrel-destroy', { volume: 0.4 })
	}

	handleGrayExplosion() {
		this.scene.sound.play('gray-explosion', { volume: 0.4 })
	}

}
