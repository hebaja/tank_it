import { Scene } from "phaser"
import { GameEvent } from "../config/events"

export class Overlay extends Scene {

	private retryBtn: Phaser.GameObjects.Container
	private scorePanel: Phaser.GameObjects.Container
	private retryBtnWidth: number = 80
	private retryBtnHeight: number = 30
	private scorePanelWidth: number = 216
	private scorePanelHeight: number = 144
	private retryBtnScale: number = 3
	private scorePanelScale: number = 4
	private retryBtnScaleHover: number = 3.025
	private screenWidth!: number
	private screenHeight!: number
	private blue: string = '#419fdd'
	private red: string = '#e74c3c'
	private green: string = '#2ecc71'
	private dark: string = '#6b6960'

	constructor() {
		super('Overlay')
	}

	preload() {
		this.load.setPath('assets')
		this.load.image('retry_background', 'bars/button_background.png')
		this.load.image('score_background', 'bars/score_panel_background.png')
	}

	create() {
		const { width, height } = this.scale
		this.screenWidth = width
		this.screenHeight = height
		// this.createRetryButton()
		this.createScorePanel()
	}

	createRetryButton() {

		this.add.rectangle(0, 0, this.screenWidth, this.screenHeight, 0x000000, 0.6).setOrigin(0)
		this.retryBtn = this.add.container(this.screenWidth / 2, this.screenHeight / 2)
		const background = this.add.nineslice(0, 0, 
			'retry_background', 0, this.retryBtnWidth, this.retryBtnHeight, 
			16, 16, 16, 16)
		.setOrigin(0.5)
		
		const text = this.add.text(0, 0, 'Retry?', {
			fontFamily: 'PixelifySans-Medium',
			fontSize: '8px',
			color: '#ffffe6',
		})
		.setOrigin(0.5)
		
		this.retryBtn.setSize(this.retryBtnWidth, this.retryBtnHeight)
		this.retryBtn.setScale(this.retryBtnScale)
		
		this.retryBtn.setInteractive({ useHandCursor: true })
		
		this.retryBtn.add([background, text])

		this.retryBtn.on('pointerdown', () => {
			text.setScale(1)
			this.retryBtn.setScale(this.retryBtnScale)
			this.scene.get('Game').events.emit(GameEvent.MatchRestartRequested)
			this.retryBtn.disableInteractive()
		})
		this.retryBtn.on('pointerup', () => {
			text.setScale(1.01)
			this.retryBtn.setScale(this.retryBtnScaleHover)
		})
		this.retryBtn.on('pointerover', () => {
			text.setScale(1.01)
			this.retryBtn.setScale(this.retryBtnScaleHover)
		})
		this.retryBtn.on('pointerout', () => {
			text.setScale(1)
			this.retryBtn.setScale(this.retryBtnScale)
		})
	}

	createScorePanel() {
		this.add.rectangle(0, 0, this.screenWidth, this.screenHeight, 0x000000, 0.6).setOrigin(0)
		
		this.scorePanel = this.add.container(this.screenWidth / 2, this.screenHeight / 2)
		const background = this.add.nineslice(0, 0, 
			'score_background', 0, this.scorePanelWidth, this.scorePanelHeight, 
			16, 16, 16, 16)
		.setOrigin(0.5)
		
		const blueLabel = this.createLabel('blue', this.blue, 12, 12)
		const redLabel = this.createLabel('red', this.red, 12, 48)
		
		this.scorePanel.setSize(this.scorePanelWidth, this.scorePanelHeight)
		this.scorePanel.setScale(this.scorePanelScale)

		this.scorePanel.add([background, blueLabel, redLabel])
	}

	createLabel(text: string, color: string, x: number, y: number) {
		const label = this.add.text(0, 0, text, {
			fontFamily: 'PixelifySans-Medium',
			fontSize: '8px',
			color: color,
			shadow: {
                offsetX: 1,
                offsetY: 1,
                color: '#000000',
                blur: 0,
                fill: true,
                stroke: false
			},
		})
		.setOrigin(0, 0)
		.setPosition((-this.scorePanelWidth / 2) + x, -this.scorePanelHeight / 2 + y)
		return label
	}
}
