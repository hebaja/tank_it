import { vi } from 'vitest';
import type { AuthResponse, Session } from '../auth/types';

/** Backend origin the app talks to when VITE_API_URL is not configured. */
export const API_ORIGIN = 'http://localhost:8080';

/** A successful POST /api/auth/{register,login,refresh} payload. */
export function makeAuthResponse(
    overrides: Partial<AuthResponse> = {},
): AuthResponse {
    return {
        accessToken: 'access-token',
        accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        refreshToken: 'refresh-token',
        userId: '11111111-2222-3333-4444-555555555555',
        username: 'gabriel',
        ...overrides,
    };
}

/**
 * Writes a persisted session to localStorage with the exact same keys
 * tokenStore.saveSession uses (so the app reads it back unchanged).
 */
export function seedSession(overrides: Partial<Session> = {}): Session {
    const session: Session = {
        accessToken: 'stored-access-token',
        accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        refreshToken: 'stored-refresh-token',
        userId: '11111111-2222-3333-4444-555555555555',
        username: 'gabriel',
        ...overrides,
    };
    localStorage.setItem('tankit.accessToken', session.accessToken);
    localStorage.setItem('tankit.refreshToken', session.refreshToken);
    localStorage.setItem(
        'tankit.accessTokenExpiresAt',
        session.accessTokenExpiresAt,
    );
    localStorage.setItem(
        'tankit.user',
        JSON.stringify({ id: session.userId, username: session.username }),
    );
    return session;
}

/** The slice of `Response` the auth client actually consumes. */
export interface FakeResponse {
    ok: boolean;
    status: number;
    text: () => Promise<string>;
}

export function textResponse(text: string, status = 200): FakeResponse {
    return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => text,
    };
}

export function jsonResponse(body: unknown, status = 200): FakeResponse {
    return textResponse(JSON.stringify(body), status);
}

export type FetchStub = ReturnType<typeof stubFetch>;

/**
 * Replaces the global `fetch` with a stub (restored automatically after the
 * test — see `unstubGlobals` in vite.config.mjs).
 */
export function stubFetch(
    responder: (
        url: string,
        init?: RequestInit,
    ) => FakeResponse | Promise<FakeResponse>,
) {
    const mock = vi.fn(async (input: unknown, init?: RequestInit) =>
        responder(String(input), init),
    );
    vi.stubGlobal('fetch', mock);
    return mock;
}

/** URLs the stub received, in call order. */
export function fetchUrls(mock: { mock: { calls: unknown[][] } }): string[] {
    return mock.mock.calls.map((call) => String(call[0]));
}

/** JSON body a stubbed POST sent, parsed back. */
export function requestBody(call: unknown[]): unknown {
    const init = call[1] as RequestInit | undefined;
    if (init?.body === undefined || init.body === null) return undefined;
    return JSON.parse(String(init.body));
}

/**
 * Unsigned JWT carrying the given claims — enough for the client-side claim
 * reader in auth/oauthCallback.ts (the server stays the source of truth).
 */
export function fakeJwt(claims: Record<string, unknown>): string {
    const encode = (value: unknown) =>
        btoa(JSON.stringify(value))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    return [
        encode({ alg: 'none', typ: 'JWT' }),
        encode(claims),
        'not-a-real-signature',
    ].join('.');
}
