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
	roomCreatedAt: number
	players: PlayerInfo[]
	deathWallStep: number
	randomBarrelPositions: Position[]
}

export type TankMovedPayload = TankMovePayload

export interface BlockDestroyPayload {
	roomId: string,
	tileX: number,
	tileY: number,
	position: Position
}

export type Position = {
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
	randomBarrelPositions: Position[]
}

export interface DeathWallStepPayload { 
	roomId: string; 
	step: number;
}
