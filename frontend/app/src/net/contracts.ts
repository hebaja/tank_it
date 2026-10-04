export interface PlayerInfo {
	connectionId: string
	color: string
}

export interface RoomStatusPayload {
	roomId: string
	players: PlayerInfo[]
	randomBarrelPositions: BarrelPos[]
	roomCreatedAt: number
}

export interface PlayerJoinedPayload {
	connectionId: string
	color: string
}

export interface PlayerLeftPayload {
	connectionId: string
}

export type BarrelPos = {
	x: number
	y: number
}

export interface GameStartedPayload {
	roomId: string
}
