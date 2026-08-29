import { Color } from './color';

export const GAME_CONFIG = {
	spawn: {
		[Color.blue]:  { x: 25, y: 25 },
		[Color.red]:   { x: 25, y: 925 },
		[Color.green]: { x: 925, y: 925 },
		[Color.dark]:  { x: 925, y: 25 },
	},

	depth: {
		background: 0,
		blocks: 10,
		dangerLayer: 20,
		projectile: 5,
		tank: 30,
		spark: 31,
		explosion: 100,
	},

	tank: {
		speed: 150,
		speedSlow: 50,
		turnSpeed: 2,
		turnSpeedSlow: 1,
	},

	projectile: {
		speed: 400,
	},

	barrel: {
		count: 10,
		excludeCorners: [
			{ tx: 0, ty: 0 },
			{ tx: 0, ty: 14 },
			{ tx: 14, ty: 0 },
			{ tx: 14, ty: 14 },
		],
	},

	timing: {
		oilSpawnDelay: 400,
		sparkLifetime: 100,
		matchEndOverlayDelay: 1000,
		deathWallStartTime: 7000,
		deathWallRingInterval: 8000,
	},
}
