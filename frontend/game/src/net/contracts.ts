export interface TankMovePayload {
  roomId: string
  playerId: string
  position: { x: number, y: number }
  rotation: number
  timestamp: number
  sequence: number
}

export interface RoomJoinedPayload {
  roomId: string
  randomBarrelPositions: BarrelPos[]
}

export type TankMovedPayload = TankMovePayload

export type BarrelPos = {
	x: number,
	y: number
}

export type HitType = 'block' | 'blockHard' | 'barrel' | 'tank' | 'projectile' | 'bounds'

export interface FireProjectilePayload {
  roomId: string
  ownerId: string
  projectileId: string
  origin: { x: number, y: number }
  angle: number
  timestamp: number
  sequence: number
}

export interface ProjectileSpawnedPayload {
  roomId: string
  projectileId: string
  ownerId: string
  position: { x: number, y: number }
  angle: number
  timestamp: number
}

export interface HitInfo { 
  type: HitType
  targetId?: string
  targetPosition?: { x: number, y: number } 
}

export interface ProjectileHitPayload {
  roomId: string
  projectileId: string
  hit: HitInfo
  position: { x: number, y: number }
  timestamp: number
  sequence: number
}

export type ProjectileDestroyedPayload = Omit<ProjectileHitPayload, 'roomId' | 'sequence'>