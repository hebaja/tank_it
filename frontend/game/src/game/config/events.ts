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
	BlockDestroyed: 'block_destroyed'
}

export type GameEventKey = typeof GameEvent[keyof typeof GameEvent]
