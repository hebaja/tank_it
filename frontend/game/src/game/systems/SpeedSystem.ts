import { Scene, Scenes } from 'phaser';
import { Tank } from '../objects/Tank';
import { Oil } from '../objects/Oil';

export class SpeedSystem {
	private scene: Scene;
	private oilGroup: Phaser.Physics.Arcade.Group;

	static preload(scene: Scene) {
		Oil.preload(scene);
	}

	constructor(scene: Scene, tankGroup: Phaser.Physics.Arcade.Group) {
		this.scene = scene;
		this.oilGroup = scene.physics.add.group();

		scene.events.on(Scenes.Events.UPDATE, () => {
			tankGroup.getChildren().forEach(t => (t as Tank).setSlow(false));
		});

		scene.physics.add.overlap(tankGroup, this.oilGroup, (t) => {
			(t as Tank).setSlow(true);
		});
	}

	addOil(x: number, y: number) {
		const oil = new Oil(this.scene, x, y);
		this.oilGroup.add(oil);
	}
}
