import { Scene, Scenes } from 'phaser';
import { Tank } from '../objects/Tank';
import { Oil } from '../objects/Oil';

export class SpeedSystem {
	private scene: Scene;
	private tankGroup: Phaser.Physics.Arcade.Group;
	private oilGroup: Phaser.Physics.Arcade.Group;
	private updateCallback: () => void;

	static preload(scene: Scene) {
		Oil.preload(scene);
	}

	constructor(scene: Scene, tankGroup: Phaser.Physics.Arcade.Group) {
		this.scene = scene;
		this.tankGroup = tankGroup;
		this.oilGroup = scene.physics.add.group();

		this.updateCallback = () => {
			tankGroup.getChildren().forEach(t => (t as Tank).setSlow(false));
		};
		scene.events.on(Scenes.Events.UPDATE, this.updateCallback);

		scene.physics.add.overlap(tankGroup, this.oilGroup, (t) => {
			(t as Tank).setSlow(true);
		});
	}

	addOil(x: number, y: number) {
		const oil = new Oil(this.scene, x, y);
		this.oilGroup.add(oil);
	}

	destroy(): void {
		this.scene.events.off(Scenes.Events.UPDATE, this.updateCallback);
		this.oilGroup.destroy(true);
	}
}
