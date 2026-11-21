import { Color } from '../game/config/color';

export type GameMode = 'single' | 'championship';

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
    mode: GameMode;
}

export interface PlayerJoinedPayload {
    connectionId: string;
    color: string;
    championshipId?: string;
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
}

export interface MatchStartedPayload {
    roomId: string;
    champioshipId: string;
    mode: GameMode;
    matchId: string;
    players: PlayerInfo[];
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
    mode: GameMode;
    championshipStatus: string;
    isChampionship: boolean;
    championshipId: string;
    matchId: string;
    ft: number;
    tanksScore: TankScoreInfo[];
    matchWinnerId: string;
    championshipWinnerId: string;
}

export interface TankScoreInfo {
    label: string;
    user: string;
    color: string;
    score: number;
    placement: number;
    isMatchWinner: boolean;
    isChampionshipWinner: boolean;
}

export interface ChampionshipFinishedPayload {
    roomId: string;
}
