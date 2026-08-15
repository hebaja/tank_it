import { Scene, Tilemaps } from "phaser"

export class DeathWallManager {

	private mainScene: Scene

	static preload(scene: Scene) {
		scene.load.image(
			'danger',
			'map/red_tile.png'
		)
	}

	constructor(scene: Scene, map: Tilemaps.Tilemap) {
		this.mainScene = scene	
		const dangerTileset = map.addTilesetImage(
			'red_tile',
			'danger'
		)
		if (!dangerTileset) throw new Error("Tileset not found");
		const dangerLayer = map.createLayer(
			'danger_layer',
			[dangerTileset]
		).setDepth(20)

		dangerLayer.forEachTile((tile) => {
			tile.setAlpha(0.0)
		})
		
		var rowStart = 0
		var rowEnd = (dangerLayer.width / 64) - 1
		var count = 6

		dangerLayer.forEachTile((tile) => {
			if ((tile.x == rowStart + count && tile.y >= count && tile.y <= rowEnd - count)
			|| (tile.y == rowStart + count && tile.x >= count && tile.x <= rowEnd - count))
				this.triggerDangerEffect(tile)
			if ((tile.x == rowEnd - count && tile.y >= count && tile.y <= rowEnd - count)
			|| tile.y == rowEnd - count && tile.x >= count && tile.x <= rowEnd - count)
				this.triggerDangerEffect(tile)
		})
		
	}
	
	triggerDangerEffect(tile: Phaser.Tilemaps.Tile) {
		tile.setAlpha(0.5)
		this.mainScene.tweens.add({
			targets: tile,
			alpha: 0.1,
			duration: 500,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: -1,
		})
	}

}
