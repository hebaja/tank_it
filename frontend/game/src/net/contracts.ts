import { Color } from '../game/config/color';

export interface TankMovePayload {
    roomId: string;
    playerId: string;
    position: { x: number; y: number };
    rotation: number;
    timestamp: number;
    sequence: number;
}

export interface PlayerInfo {
    connectionId: string;
    color: string;
}

export interface RoomJoinedPayload {
    roomId: string;
    roomCreatedAt: number;
    players: PlayerInfo[];
    deathWallStep: number;
    randomBarrelPositions: Position[];
}

export type TankMovedPayload = TankMovePayload;

export interface BlockDestroyPayload {
    roomId: string;
    tileX: number;
    tileY: number;
    position: Position;
}

export type Position = {
    x: number;
    y: number;
};

export interface MatchEndPayload {
    roomId: string;
    placements: MatchPlacement[];
}

export type MatchPlacement = {
    color: Color;
    points: number;
    place: number;
    timestamp: number;
};

export interface MatchStartedPayload {
    roomId: string;
    randomBarrelPositions: Position[];
}

export interface DeathWallStepPayload {
    roomId: string;
    step: number;
}

export interface BarrelDestroyPayload {
    roomId: string;
    index: number;
}

export interface TankDestroyPayload {
    roomId: string;
    color: Color;
    x: number;
    y: number;
}

/*

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

*/
