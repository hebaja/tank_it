export const GameEvent = {
	ProjectileFired: 'projectileFired',
	Explosion: 'explosion',
	ExplosionSmoke: 'explosion_smoke',
	TileDestroy: 'tileDestroy',
	MatchStarted: 'match_started',
	MatchRestartRequested: 'match_restart_requested',
	MatchEnd: 'match_end',
	TankMove: 'tankMove',
	TankMoved: 'tankMoved',
	RoomJoined: 'roomJoined',
	DeathWallStep: 'death_wall_step',
	BlockDestroy: 'block_destroy',
	BlockDestroyed: 'block_destroyed',
	BarrelDestroy: 'barrel_destroy',
	BarrelDestroyed: 'barrel_destroyed',
	TankDestroy: 'tank_destroy',
	TankDestroyed: 'tank_destroyed',
	ProjectileFireFail: 'project_fire_fail',
	DeathWallExplode: 'death_wall_explode',
	DangerWarning: 'danger_warning',
	DangerWarningFinish: 'danger_warning_finish'
}

export type GameEventKey = typeof GameEvent[keyof typeof GameEvent]
