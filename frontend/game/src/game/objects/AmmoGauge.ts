import { Display, GameObjects, Scene, Scenes } from "phaser";
import { Color } from "../config/color.ts";
import { type Corner, HUD } from "../config/layout.ts";

export class AmmoGauge extends GameObjects.Container {

	private gaugeWidth: number = HUD.gaugeWidth
	private mainScene: Scene
	private fill: Phaser.GameObjects.NineSlice
	private bg: Phaser.GameObjects.Rectangle
	private alarmOn: boolean = false
	private alarmTween?: Phaser.Tweens.Tween
	private recharging: boolean = false
	private canFire: boolean = true
	private counter: number = HUD.initialAmmo
	private quantity: Phaser.GameObjects.Text
	private color: Color

	static preload(scene: Scene) {
		scene.load.image(
			'panel',
			'bars/panel.png'
		)
		scene.load.image(
			'blue_fill',
			'bars/blue_fill.png'
		)
		scene.load.image(
			'red_fill',
			'bars/red_fill.png'
		)
		scene.load.image(
			'green_fill',
			'bars/green_fill.png'
		)
		scene.load.image(
			'dark_fill',
			'bars/dark_fill.png'
		)
		scene.load.font(
			'PixelifySans-Medium',
			'fonts/PressStart2P-Regular.ttf'
		)
	}

	constructor(scene: Scene, color: Color, corner: Corner) {
		const bounds = scene.physics.world.bounds
		const topHalf = corner === 'top-left' || corner === 'top-right'
		const leftHalf = corner === 'top-left' || corner === 'bottom-left'
		const screenX = leftHalf ? -(HUD.gaugeWidth / 2) - HUD.edgeInset : scene.physics.world.bounds.width + (HUD.gaugeWidth / 2) + HUD.edgeInset
		const x = screenX
		const y = topHalf ? HUD.topMargin : bounds.height - HUD.bottomMargin

		super(scene, x, y)

		this.mainScene = scene
		this.color = color

		const frame = scene.add.nineslice(0, 0, 'panel', undefined, HUD.frameWidth, HUD.frameHeight, 6, 6, 6, 6).setDepth(HUD.depthFrame)
		const projectileIcon = scene.add.image(-HUD.iconOffsetX, HUD.iconOffsetY, `projectile_${color}`).setScale(HUD.iconScale)
		this.quantity = scene.add.text(-HUD.textOffsetX, -HUD.textOffsetY, `x${this.counter}`, {
			fontSize: '18px',
			fontFamily: 'PixelifySans-Medium'
		}).setDepth(HUD.depthFrame)
		this.bg = scene.add.rectangle(0, 0, HUD.gaugeWidth, HUD.fillHeight, 0x000000).setDepth(HUD.depthBg)
		this.fill = scene.add.nineslice(HUD.fillOffset, 0, `${color}_fill`, undefined, this.gaugeWidth, HUD.fillHeight, 3, 3, 4, 8).setDepth(HUD.depthFill)
		this.fill.setOrigin(0, 0.5)
		this.add(this.bg)
		this.add(this.fill)
		this.add(frame)
		this.add(this.quantity)
		this.add(projectileIcon)
		this.setDepth(HUD.depthFrame)
		scene.add.existing(this)
		scene.events.on(Scenes.Events.UPDATE, this.update, this)
	}

	consumeGauge() {
		if (this.recharging || this.gaugeWidth <= 0)
			return
		this.gaugeWidth -= HUD.drainPerShot
		if (this.counter > 0)
			this.quantity.setText(`x${--this.counter}`)
		this.mainScene.tweens.add({
			targets: this.fill,
			width: this.gaugeWidth,
			duration: 200,
			ease: 'Sine.easeOut'
		})
		if (this.gaugeWidth <= 0)
			this.recharge()
	}

	getCanFire(): boolean {
		return this.canFire
	}

	recharge() {
		this.recharging = true
		if (this.alarmTween) this.alarmTween.stop()
		this.alarmOn = false
		this.bg.setFillStyle(0x000000)
		this.canFire = false

		this.mainScene.tweens.add({
			targets: this,
			gaugeWidth: HUD.gaugeWidth,
			duration: HUD.rechargeMs,
			ease: 'Sine.easeOut',
			onUpdate: () => { this.fill.width = this.gaugeWidth },
			onComplete: () => {
				this.recharging = false
				this.counter = HUD.initialAmmo
				this.quantity.setText(`x${this.counter}`)
				this.canFire = true
			}
		})
	}

	update() {
		if (this.gaugeWidth <= HUD.drainPerShot && !this.alarmOn && !this.recharging) {
			const from = Display.Color.ValueToColor(0x000000)
			const to = Display.Color.ValueToColor(0xFF0000)
			this.alarmOn = true
			this.alarmTween = this.mainScene.tweens.addCounter({
				from: 0,
				to: 1,
				duration: 500,
				yoyo: true,
				repeat: -1,
				onUpdate: (counter) => {
					const c = Display.Color.Interpolate.ColorWithColor(from, to, 1, counter.getValue()!)
					this.bg.setFillStyle(c.color)
				}
			})
		}
	}
}
