export const GameEvent = {
	ProjectileFired: 'projectileFired',
	Explosion: 'explosion',
	ExplosionSmoke: 'explosion_smoke',
	TileDestroy: 'tileDestroy',
	MatchEnd: 'match_end',
  TankMove: 'tankMove',
  TankMoved: 'tankMoved',
}

export type GameEventKey = typeof GameEvent[keyof typeof GameEvent]
