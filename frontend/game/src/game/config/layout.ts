import { Color } from "./color"

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export const HUD = {
	edgeInset: 18,

	gaugeWidth: 90,
	fillHeight: 24,
	fillOffset: -45,
	frameWidth: 100,
	frameHeight: 30,
	frameThickness: 6,

	iconOffsetX: 42,
	iconOffsetY: -30,
	iconScale: 1.6,
	textOffsetX: 30,
	textOffsetY: 36,

	drainPerShot: 18,
	initialAmmo: 5,
	rechargeMs: 5000,

	depthBg: 0,
	depthFill: 50,
	depthFrame: 100,

	topMargin: 64,
	bottomMargin: 32
}

export const TANK_CONFIG = {
	faceDown: 0,
	faceUp: 180
}

export const SPAWN_CORNERS: Record<Color, Corner> = {
	[Color.blue]: 'top-left',
	[Color.red]: 'bottom-left',
	[Color.green]: 'bottom-right',
	[Color.dark]: 'top-right',
}
