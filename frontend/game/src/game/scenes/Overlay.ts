import { Scene } from "phaser"
import { GameEvent } from "../config/events"

interface TankScoreInfo {
	label: string,
	user: string,
	color: string,
	score: number
	isWinner: boolean
}

interface MatchInfo {
	roomId: string,
	isChampionship: boolean,
	ft: number,
	tanks: TankScoreInfo[]
}

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
	private LABEL_OFFSET: number = 30
	private CONTENT_OFFSET: number = 12
	private matchInfo: MatchInfo = {
		roomId: 'local-dev-room',
		isChampionship: true,
		ft: 10,
		tanks: [
			{ label: 'blue', user: '(asdrubal)', color: '#419fdd', score: 10, isWinner: true },
			{ label: 'red', user: '(gertrudes)', color: '#e74c3c', score: 7, isWinner: false },
			{ label: 'green', user: '(cremilda)', color: '#2ecc71', score: 2, isWinner: false },
			{ label: 'dark', user: '(robisberto)', color: '#6b6960', score: 4, isWinner: false }
		]
	}

	constructor() {
		super('Overlay')
	}

	preload() {
		this.load.setPath('assets')
		this.load.image('retry_background', 'bars/button_background.png')
		this.load.image('score_background', 'bars/score_panel_background.png')
		this.load.image('token_blue', 'bars/token_blue.png')
		this.load.image('token_red', 'bars/token_red.png')
		this.load.image('token_green', 'bars/token_green.png')
		this.load.image('token_dark', 'bars/token_dark.png')
		this.load.font('pixelify-sans-regular','fonts/Silkscreen-Regular.ttf')
		this.load.spritesheet('crown', 'sprites/crown.png', {
			frameWidth: 32,
			frameHeight: 32
		})
	}

	create() {
		this.children.removeAll()
		const { width, height } = this.scale
		this.screenWidth = width
		this.screenHeight = height
		if (!this.anims.exists('crown_rotate')) {
			this.anims.create({
				key: 'crown_rotate',
				frames: this.anims.generateFrameNumbers('crown', { frames: [0, 1, 2, 3, 4, 5, 6, 7] }),
				frameRate: 8,
				repeat: -1
			})
		}
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
			this.scene.get('Game').events.emit(GameEvent.OptionSelect)
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
		const labels = []

		this.add.rectangle(0, 0, this.screenWidth, this.screenHeight, 0x000000, 0.6).setOrigin(0)
		
		this.scorePanel = this.add.container(this.screenWidth / 2, this.screenHeight / 2)
		const background = this.add.nineslice(0, 0, 
			'score_background', 0, this.scorePanelWidth, this.scorePanelHeight, 
			16, 16, 16, 16)
		.setOrigin(0.5)

		for (let i = 0; i < this.matchInfo.tanks.length; i++) {
			labels.push(
				this.createTankScore(
					this.matchInfo.tanks[i].label,
					this.matchInfo.tanks[i].user,
					this.matchInfo.tanks[i].color,
					this.CONTENT_OFFSET,
					this.CONTENT_OFFSET + (this.LABEL_OFFSET * i),
					this.matchInfo.tanks[i].score,
					this.matchInfo.tanks[i].isWinner
				)
			)
		}
		
		this.scorePanel.setSize(this.scorePanelWidth, this.scorePanelHeight)
		this.scorePanel.setScale(this.scorePanelScale)

		this.scorePanel.add([background, ...labels])
	}

	createTankScore(tankText: string, userText: string, color: string, x: number, y: number, score: number, isWinner: boolean) {
		const tokens = []
		const tankLabel = this.createTankLabel(tankText, color)
		const userLabel = this.createUserLabel(userText)
		let extra = 0

		if (score > this.matchInfo.ft) {
			extra = score - this.matchInfo.ft
			score = this.matchInfo.ft
		}
		for (let i = 0; i < score; i++) {
			const image = this.add.image(0, 0,`token_${tankText}`).setScale(0.5)
			image.setX((image.width / 2) * i)
			tokens.push(image)
			if (i == this.matchInfo.ft - 1 && extra) {
				tokens.push(
					this.add.text(
						(image.displayWidth * score) - (this.CONTENT_OFFSET - 4),
						-image.displayHeight / 3,
						`+${extra}`, {
					fontFamily: 'pixelify-sans-regular',
					fontSize: '8px',
				}))
			}
		}
		const tokensContainer = this.add.container(7, tankLabel.height + 10, [...tokens])
		userLabel.setPosition(tankLabel.width + 4, tankLabel.height - userLabel.height)
		const labelContainer = this.add.container(0, 0, [tankLabel, userLabel])
		if (isWinner)
			labelContainer.add(
				this.add.sprite(
					tankLabel.width + userLabel.width + this.CONTENT_OFFSET,
					userLabel.height/3,
					'crown')
				.setScale(0.5)
				.play('crown_rotate'))
		
		return this.add.container(
			(-this.scorePanelWidth / 2) + x,
			(-this.scorePanelHeight / 2) + y, 
			[labelContainer, tokensContainer]
		)
	}

	createTankLabel(text: string, color: string) {
		return this.add.text(0, 0, text.toUpperCase(), {
			fontFamily: 'press-start-2P-regular',
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
	}

	createUserLabel(text: string) {
		return this.add.text(0, 0, text, {
			fontFamily: 'pixelify-sans-regular',
			fontSize: '8px',
			color: '#FFFFFF',
			shadow: {
				offsetX: 1,
				offsetY: 1,
				color: '#000000',
				blur: 0,
				fill: true,
				stroke: false
			},
		})
	}
}
