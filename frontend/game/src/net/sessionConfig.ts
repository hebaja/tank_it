import { Color } from '../game/config/color.ts';

export interface SessionConfig {
    roomId: string;
    localColor: Color;
    hubUrl?: string;
    isChamp: boolean;
}

const params = new URLSearchParams(window.location.search);

export const sessionConfig: SessionConfig = {
    roomId: params.get('roomId') ?? 'local-dev-room',
    localColor: (params.get('color') as Color) ?? Color.blue,
    hubUrl: params.get('hubUrl') ?? undefined,
    isChamp: false,
};

export function configureSession(overrides: Partial<SessionConfig>) {
    Object.assign(sessionConfig, overrides);
}
