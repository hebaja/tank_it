import { Color } from '../game/config/color.ts';

export interface SessionConfig {
    roomId: string;
    localColor: Color;
    hubUrl?: string;
    champId: string;
}

const params = new URLSearchParams(window.location.search);
const champId = '80391777-4e65-4f49-8eea-97ad1941998a';

export const sessionConfig: SessionConfig = {
    roomId: params.get('roomId') ?? 'local-dev-room',
    localColor: (params.get('color') as Color) ?? Color.blue,
    hubUrl: params.get('hubUrl') ?? undefined,
    champId: champId,
};

export function configureSession(overrides: Partial<SessionConfig>) {
    Object.assign(sessionConfig, overrides);
}
