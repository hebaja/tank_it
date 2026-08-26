import { Scene } from "phaser";
import { Tank } from "../objects/Tank";
import { Color } from "../config/color";

export interface MatchPlacement {
	color: Color
	points: number
	place: number
}

export interface MatchResult {
	placements: MatchPlacement[]
}

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
		placements: MatchResult
	}) {
		this.scene.time.delayedCall(1000, () => {
			this.scene.scene.pause()
			this.scene.scene.launch('Overlay')
			console.log(data)
		})
	}

}
