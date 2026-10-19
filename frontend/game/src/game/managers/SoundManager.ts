import { Scene } from "phaser";
import { GameEvent } from "../config/events";

export class SoundManager {

	private scene: Scene
	private warningTimer: Phaser.Time.TimerEvent | undefined

	static preload(scene: Scene) {
		scene.load.audio('tank-fire', [
			'sounds/sfx/tank_fire.ogg',
			'sounds/sfx/tank_fire.mp3'
		])
		scene.load.audio('block-destroy', [
			'sounds/sfx/block_destroy.ogg',
			'sounds/sfx/block_destroy.mp3'
		])
		scene.load.audio('barrel-destroy', [
			'sounds/sfx/barrel_destroy.ogg',
			'sounds/sfx/barrel_destroy.mp3'
		])
		scene.load.audio('gray-explosion', [
			'sounds/sfx/gray_explosion.ogg',
			'sounds/sfx/gray_explosion.mp3'
		])
		scene.load.audio('tank-destroy', [
			'sounds/sfx/tank_destroy.ogg',
			'sounds/sfx/tank_destroy.mp3'
		])
		scene.load.audio('tank-fire-fail', [
			'sounds/sfx/tank_fire_fail.ogg',
			'sounds/sfx/tank_fire_fail.mp3'
		])
		scene.load.audio('death-wall-explode', [
			'sounds/sfx/death_wall_explode.ogg',
			'sounds/sfx/death_wall_explode.mp3'
		])
		scene.load.audio('danger-warning', [
			'sounds/sfx/danger_warning.ogg',
			'sounds/sfx/danger_warning.mp3'
		])
		scene.load.audio('option-select', [
			'sounds/sfx/option_select.ogg',
			'sounds/sfx/option_select.mp3'
		])
		scene.load.audio('ammo-bar-complete', [
			'sounds/sfx/ammo_bar_complete.ogg',
			'sounds/sfx/ammo_bar_complete.mp3'
		])
	}

	constructor(scene: Scene) {
		this.scene = scene
		this.scene.events.on(GameEvent.ProjectileFired, this.handleProjectileFired, this)
		this.scene.events.on(GameEvent.BlockDestroy, this.handleBlockDestroy, this)
		this.scene.events.on(GameEvent.BarrelDestroy, this.handleBarrelDestroy, this)
		this.scene.events.on(GameEvent.ExplosionSmoke, this.handleGrayExplosion, this)
		this.scene.events.on(GameEvent.TankDestroy, this.handleTankDestroy, this)
		this.scene.events.on(GameEvent.ProjectileFireFail, this.handleProjectileFireFail, this)
		this.scene.events.on(GameEvent.DeathWallExplode, this.handleDeathWallDestroy, this)
		this.scene.events.on(GameEvent.DangerWarning, this.handleDangerWarning, this)
		this.scene.events.on(GameEvent.DangerWarningFinish, this.handleDangerWarningFinish, this)
		this.scene.events.on(GameEvent.OptionSelect, this.handleOptionSelect, this)
		this.scene.events.on(GameEvent.AmmoBarComplete, this.handleAmmoBarComplete, this)
	}

	handleProjectileFired() {
		this.scene.sound.play('tank-fire', { volume: 0.4 })
	}

	handleBlockDestroy() {
		this.scene.sound.play('block-destroy', { volume: 0.4 })
	}

	handleBarrelDestroy() {
		this.scene.sound.play('barrel-destroy', { volume: 0.4 })
	}

	handleGrayExplosion() {
		this.scene.sound.play('gray-explosion', { volume: 0.4 })
	}

	handleTankDestroy() {
		this.scene.sound.play('tank-destroy', { volume: 0.4 })
	}
	
	handleProjectileFireFail() {
		this.scene.sound.play('tank-fire-fail', { volume: 0.1 })
	}

	handleDeathWallDestroy() {
		this.scene.sound.play('death-wall-explode', { volume: 0.4 })
	}
	
	handleOptionSelect() {
		this.scene.sound.play('option-select', { volume: 0.4 })
	}
	
	handleAmmoBarComplete() {
		this.scene.sound.play('ammo-bar-complete', { volume: 0.4 })
	}

	handleDangerWarning() {
		const warning = this.scene.sound.add('danger-warning', { volume: 0.2 })

		this.warningTimer = this.scene.time.addEvent({
			delay: 1500,
			callback: () => warning.play(),
			loop: true
		})
	}

	handleDangerWarningFinish() {
		this.warningTimer?.remove()
		this.warningTimer = undefined
	}

	destroy() {
		this.scene.events.off(GameEvent.ProjectileFired, this.handleProjectileFired, this)
		this.scene.events.off(GameEvent.BlockDestroy, this.handleBlockDestroy, this)
		this.scene.events.off(GameEvent.BarrelDestroy, this.handleBarrelDestroy, this)
		this.scene.events.off(GameEvent.ExplosionSmoke, this.handleGrayExplosion, this)
		this.scene.events.off(GameEvent.TankDestroy, this.handleTankDestroy, this)
		this.scene.events.off(GameEvent.ProjectileFireFail, this.handleProjectileFireFail, this)
		this.scene.events.off(GameEvent.DeathWallExplode, this.handleDeathWallDestroy, this)
		this.scene.events.off(GameEvent.DangerWarning, this.handleDangerWarning, this)
		this.scene.events.off(GameEvent.DangerWarningFinish, this.handleDangerWarningFinish, this)
		this.scene.events.off(GameEvent.OptionSelect, this.handleOptionSelect, this)
		this.scene.events.off(GameEvent.AmmoBarComplete, this.handleAmmoBarComplete, this)
	}
}
