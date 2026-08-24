import { Scene } from "phaser";
import { Tank } from "../objects/Tank";

export class MatchManager {

	private scene: Scene

	constructor(scene: Scene) {
		this.scene = scene

		this.scene.events.once(
			'match_end',
			this.handleMatchEnd,
			this
		)
	}

	handleMatchEnd(data : {
		deathOrder: Tank[],
		winner: Tank
	}) {
		this.scene.time.delayedCall(1000, () => {
			this.scene.scene.pause()
			this.scene.scene.launch('Overlay')
			console.log(data.deathOrder)
			console.log(data.winner)
		})
	}

}
