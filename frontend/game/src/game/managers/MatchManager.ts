import { Scene } from "phaser";
import { Color } from "../config/color";
import { GameEvent } from "../config/events";

export interface MatchPlacement {
	color: Color
	points: number
	place: number
	timestamp: number
}

export interface MatchResult {
	placements: MatchPlacement[]
}

export class MatchManager {

	private scene: Scene

	constructor(scene: Scene) {
		this.scene = scene

		this.scene.events.once(
			GameEvent.MatchEnd,
			this.handleMatchEnd,
			this
		)
	}

	handleMatchEnd(data : {
		placements: MatchResult
	}) {
		this.scene.time.delayedCall(1000, () => {
			this.scene.scene.pause()
			this.scene.scene.launch('Overlay')
			console.log(data)
		})
	}

}
