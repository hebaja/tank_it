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
    connectionId: string;
    roomId: string;
    roomCreatedAt: number;
    players: PlayerInfo[];
    deathWallStep: number;
    randomBarrelPositions: Position[];
    championshipId: string;
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
    championshipId: string;
    placements: MatchPlacement[];
}

export type MatchPlacement = {
    color: Color;
    points: number;
    placement: number;
    timestamp: number;
    isWinner: boolean;
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
    championshipId: string;
    color: Color;
    x: number;
    y: number;
    matchPlacement: MatchPlacement;
}

export interface ProjectilePayload {
    roomId: string;
    ownerId: string;
    projectileId: string;
    origin: Position;
    angle: number;
    color: string;
    timestamp: number;
    sequence: number;
}

export interface ProjectilesCollidePayload {
    projectileA: ProjectilePayload;
    projectileB: ProjectilePayload;
    timestamp: number;
}

export interface MatchEndedPayload {
    roomId: string;
    ft: number;
    tanksScore: TankScoreInfo[];
    championshipStatus: string;
    winnerId: string;
}

export interface TankScoreInfo {
    label: string;
    user: string;
    color: string;
    score: number;
}
