export const GameEvent = {
	ProjectileFired: 'projectileFired',
	Explosion: 'explosion',
	ExplosionSmoke: 'explosion_smoke',
	TileDestroy: 'tileDestroy',
	MatchEnd: 'match_end',
}

export type GameEventKey = typeof GameEvent[keyof typeof GameEvent]
