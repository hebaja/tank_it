import { Scene } from "phaser";

export class Overlay extends Scene {
	
	constructor() {
		super('Overlay')
	}

	create() {
		const { width, height } = this.scale
		console.log(this.scale)
		this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0)
		this.add.text(width / 2, height / 2, 'Retry?', {
			fontFamily: 'PixelifySans-Medium',
			fontSize: '32px',
			color: '#ffffff'
		}).setOrigin(0.5)
	}

}
