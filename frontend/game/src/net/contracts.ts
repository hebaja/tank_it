export interface TankMovePayload {
  roomId: string
  playerId: string
  position: { x: number, y: number }
  rotation: number
  timestamp: number
  sequence: number
}

export interface PlayerInfo {
  connectionId: string
  color: string
}

export interface RoomJoinedPayload {
  roomId: string
  randomBarrelPositions: BarrelPos[]
  roomCreatedAt: number
  players: PlayerInfo[]
}

export type TankMovedPayload = TankMovePayload

export type BarrelPos = {
	x: number,
	y: number
}
