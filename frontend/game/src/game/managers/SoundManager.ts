import { Scene } from "phaser";
import { GameEvent } from "../config/events";

export class SoundManager {

	private scene: Scene

	static preload(scene: Scene) {
		scene.load.audio('tank-fire', [
			'sounds/sfx/tank_fire.ogg',
			'sounds/sfx/tank_fire.mp3'
		])
	}

	constructor(scene: Scene) {
		this.scene = scene
		this.scene.events.on(GameEvent.ProjectileFired, this.handleProjectileFired, this)
	}

	handleProjectileFired() {
		this.scene.sound.play('tank-fire', { volume: 0.3 })
	}
}
