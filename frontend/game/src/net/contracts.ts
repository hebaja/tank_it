import { Color } from "../game/config/color"

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
	deathWallStep: number
}

export type TankMovedPayload = TankMovePayload

export type BarrelPos = {
	x: number,
	y: number
}

export interface MatchEndPayload {
	roomId: string
	placements: MatchPlacement[]
}

export type MatchPlacement = {
	color: Color
	points: number
	place: number
	timestamp: number
}

export interface MatchStartedPayload {
	roomId: string
	randomBarrelPositions: BarrelPos[]
}

export interface DeathWallStepPayload {
	roomId: string
	step: number
}

export interface TankDestroyPayload {
	roomId: string
	color: Color
	x: number
	y: number
}
