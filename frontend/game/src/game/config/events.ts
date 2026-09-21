export const GameEvent = {
	ProjectileFired: 'projectileFired',
	Explosion: 'explosion',
	ExplosionSmoke: 'explosion_smoke',
	TileDestroy: 'tileDestroy',
	MatchEnd: 'match_end',
  TankMove: 'tankMove',
  TankMoved: 'tankMoved',
  RoomJoined: 'roomJoined'
}

export type GameEventKey = typeof GameEvent[keyof typeof GameEvent]
