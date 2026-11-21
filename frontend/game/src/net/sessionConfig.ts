import { Color } from '../game/config/color.ts';
import type { GameMode } from './contracts.ts';

export interface SessionConfig {
    roomId: string;
    localColor: Color;
    hubUrl?: string;
    champId?: string;
    mode: GameMode;
}

const params = new URLSearchParams(window.location.search);

export const sessionConfig: SessionConfig = {
    roomId: params.get('roomId') ?? 'local-dev-room',
    localColor: (params.get('color') as Color) ?? Color.blue,
    hubUrl: params.get('hubUrl') ?? undefined,
    champId: params.get('champId') ?? undefined,
    mode: params.get('mode') === 'championship' ? 'championship' : 'single'
};

export function configureSession(overrides: Partial<SessionConfig>) {
    Object.assign(sessionConfig, overrides);
}
