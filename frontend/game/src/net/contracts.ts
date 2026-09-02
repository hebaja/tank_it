export interface TankMovePayload {
  roomId: string
  playerId: string
  position: { x: number, y: number }
  rotation: number
  timestamp: number
  sequence: number
}

export type TankMovedPayload = TankMovePayload
