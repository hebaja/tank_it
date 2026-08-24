import { Scene } from "phaser";

export class Overlay extends Scene {

	constructor() {
		super('Overlay')
	}

	preload() {
		this.load.setPath('assets')
		this.load.image('background', 'bars/button_background.png')
	}

	create() {
		const { width, height } = this.scale
		const btn_width: number = 80
		const btn_height: number = 30
		const btn_scale: number = 3
		const btn_scale_hover: number = 3.025

		this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0)
		const container = this.add.container(width / 2, height / 2)
		const background = this.add.nineslice(0, 0, 
			'background', 0, btn_width, btn_height, 
			16, 16, 16, 16)
		.setOrigin(0.5)

		const text = this.add.text(0, 0, 'Retry?', {
			fontFamily: 'PixelifySans-Medium',
			fontSize: '8px',
			color: '#ffffe6',
		})
		.setOrigin(0.5)

		container.setSize(btn_width, btn_height)
		container.setScale(btn_scale)
		
		container.setInteractive({ useHandCursor: true })
		
		container.add([background, text])

		container.on('pointerdown', () => {
			text.setScale(1)
			container.setScale(btn_scale)
			this.scene.start('Game')
			this.scene.stop()
		})
		container.on('pointerup', () => {
			text.setScale(1.01)
			container.setScale(btn_scale_hover)
		})
		container.on('pointerover', () => {
			text.setScale(1.01)
			container.setScale(btn_scale_hover)
		})
		container.on('pointerout', () => {
			text.setScale(1)
			container.setScale(btn_scale)
		})
	}
}
