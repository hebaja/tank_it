import { Physics, Scene, Utils } from "phaser";
import { GAME_CONFIG } from "../config/game";

const BARREL_TEXTURES = [
	"barrel_black",
	"barrel_green",
	"barrel_red",
	"barrel_rust"
];

type BarrelPos = {
	x: number,
	y: number
}

export class Barrel extends Physics.Arcade.Sprite {

	static preload(scene: Scene) {
		scene.load.image('barrel_black', 'barrels/barrel_black.png')
		scene.load.image('barrel_green', 'barrels/barrel_green.png')
		scene.load.image('barrel_red', 'barrels/barrel_red.png')
		scene.load.image('barrel_rust', 'barrels/barrel_rust.png')
	}

	static generateRandomPositions(
		mapWidth: number,
		mapHeight: number,
		quantity: number,
		blocksLayer: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer,
		blocksHardLayer: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer): BarrelPos[] {

		const validPositions: BarrelPos[] = []
		const randomPositions: BarrelPos[] = []
		const exclude = GAME_CONFIG.barrel.excludeCorners

		for (let ty = 0; ty < mapHeight; ty++) {
			for (let tx = 0; tx < mapWidth; tx++) {
				if (blocksLayer.getTileAt(tx, ty) || blocksHardLayer.getTileAt(tx, ty)
					|| exclude.some(e => e.tx === tx && e.ty === ty))
					continue
				validPositions.push({ x: tx, y: ty })
			}
		}

		for (let i = 0; i < quantity; i++) {
			const randomIndex = Math.floor(Math.random() * validPositions.length)
			randomPositions.push(validPositions[randomIndex])
			validPositions.splice(randomIndex, 1)
		}
		return randomPositions
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
