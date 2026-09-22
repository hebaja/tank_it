import { Physics, Scene, Utils } from "phaser"
import { BarrelPos } from "../../net/contracts"

const BARREL_TEXTURES = [
	"barrel_black",
	"barrel_green",
	"barrel_red",
	"barrel_rust"
]

export class Barrel extends Physics.Arcade.Sprite {

	static preload(scene: Scene) {
		scene.load.image('barrel_black', 'barrels/barrel_black.png')
		scene.load.image('barrel_green', 'barrels/barrel_green.png')
		scene.load.image('barrel_red', 'barrels/barrel_red.png')
		scene.load.image('barrel_rust', 'barrels/barrel_rust.png')
	}

	static generateRandomBarrels(scene: Scene, randomPositions: BarrelPos[], map: Phaser.Tilemaps.Tilemap): Barrel[] {
		const barrels: Barrel[] = []

		for (let i = 0; i < randomPositions.length; i++) {
			const worldX = map.tileToWorldX(randomPositions[i].x)! + map.tileWidth / 2
			const worldY = map.tileToWorldY(randomPositions[i].y)! + map.tileHeight / 2

			barrels.push(new Barrel(scene, worldX, worldY))
		}
		return barrels
	}

	constructor(scene: Scene, x: number, y: number) {
		super(scene, x, y, Utils.Array.GetRandom(BARREL_TEXTURES))

		scene.add.existing(this)
		scene.physics.add.existing(this)
		this.setImmovable(true)
	}

	destroy(fromScene?: boolean): void {
		super.destroy(fromScene)
	}
}
