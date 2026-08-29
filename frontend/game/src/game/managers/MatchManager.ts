import { Scene } from "phaser";
import { Tank } from "../objects/Tank";
import { Color } from "../config/color";
import { GAME_CONFIG } from "../config/game";
import { GameEvent } from "../config/events";

export interface MatchPlacement {
	color: Color;
	points: number;
	place: number;
	timestamp: number;
}

export interface MatchResult {
	placements: MatchPlacement[];
}

export class MatchManager {

	private scene: Scene;
	private placements: MatchPlacement[] = [];
	private place: number = 3;
	private points: number = 0;

	constructor(scene: Scene) {
		this.scene = scene;

		this.scene.events.once(
			GameEvent.MatchEnd,
			this.handleMatchEnd,
			this,
		);
	}

	reset() {
		this.place = 3;
		this.points = 0;
		this.placements = [];
	}

	destroy() {
		this.scene.events.off(GameEvent.MatchEnd, this.handleMatchEnd, this);
	}

	recordPlacement(tank: Tank) {
		if (tank.active) {
			this.placements.push({
				color: tank.getColor(),
				points: this.points++,
				place: this.place--,
				timestamp: Date.now(),
			});
		}

		if (this.placements.length >= 1) {
			for (let i = this.placements.length - 1; i > 0; i--) {
				if (i - 1 === -1) break;
				if (Math.abs(this.placements[i - 1].timestamp - this.placements[i].timestamp) <= 1)
					this.placements[i - 1].points = this.placements[i].points;
			}
		}
	}

	checkEnd(tankCount: number, winner: Tank | undefined) {
		if (tankCount === 1 && winner) {
			if (this.placements.length < 4) {
				this.recordPlacement(winner);
				this.scene.events.emit(GameEvent.MatchEnd, {
					placements: this.placements,
				});
			}
		} else if (tankCount === 0) {
			this.scene.events.emit(GameEvent.MatchEnd, {
				placements: this.placements,
			});
		}
	}

	private handleMatchEnd(data: MatchResult): void {
		this.scene.time.delayedCall(GAME_CONFIG.timing.matchEndOverlayDelay, () => {
			this.scene.scene.pause();
			this.scene.scene.launch('Overlay');
			console.log(data);
		});
	}

}
