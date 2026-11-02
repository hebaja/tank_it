import { beforeEach, describe, expect, it } from 'vitest';
import {
    clearSession,
    isExpiringSoon,
    loadSession,
    saveSession,
} from './tokenStore';
import type { AuthResponse, Session } from './types';

const response: AuthResponse = {
    accessToken: 'access-token',
    accessTokenExpiresAt: '2030-01-01T00:00:00.000Z',
    refreshToken: 'refresh-token',
    userId: '11111111-2222-3333-4444-555555555555',
    username: 'gabriel',
};

function storedSession(overrides: Partial<Session> = {}): Session {
    const session: Session = { ...response, ...overrides };
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

describe('tokenStore persistence', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('round-trips a session through localStorage', () => {
        saveSession(response);

        expect(loadSession()).toEqual(response);
    });

    it('returns null when any part of the session is missing', () => {
        const keys = [
            'tankit.accessToken',
            'tankit.refreshToken',
            'tankit.accessTokenExpiresAt',
            'tankit.user',
        ];

        saveSession(response);
        for (const key of keys) {
            localStorage.removeItem(key);
            expect(loadSession()).toBeNull();
            saveSession(response);
        }
    });

    it('returns null when the stored user is unusable', () => {
        saveSession(response);

        localStorage.setItem('tankit.user', 'not json');
        expect(loadSession()).toBeNull();

        localStorage.setItem('tankit.user', JSON.stringify({ id: 'only-id' }));
        expect(loadSession()).toBeNull();
    });

    it('clearSession removes every stored key', () => {
        const session = storedSession();

        clearSession();

        expect(loadSession()).toBeNull();
        expect(localStorage.getItem('tankit.accessToken')).toBeNull();
        expect(localStorage.getItem('tankit.refreshToken')).toBeNull();
        expect(localStorage.getItem('tankit.accessTokenExpiresAt')).toBeNull();
        expect(session.username).toBe('gabriel');
    });
});

describe('isExpiringSoon', () => {
    const now = Date.parse('2030-06-01T12:00:00.000Z');

    function session(expiresAt: string): Session {
        return { ...response, accessTokenExpiresAt: expiresAt };
    }

    it('treats a token expiring beyond the 30s skew as fresh', () => {
        expect(isExpiringSoon(session('2030-06-01T12:10:00.000Z'), now)).toBe(
            false,
        );
    });

    it('refreshes within the 30s skew window (boundary included)', () => {
        expect(isExpiringSoon(session('2030-06-01T12:00:30.000Z'), now)).toBe(
            true,
        );
        expect(isExpiringSoon(session('2030-06-01T12:00:00.000Z'), now)).toBe(
            true,
        );
    });

    it('treats an already-expired token as expiring', () => {
        expect(isExpiringSoon(session('2030-06-01T11:59:59.000Z'), now)).toBe(
            true,
        );
    });

    it('never trusts an unparseable expiry', () => {
        expect(isExpiringSoon(session('tomorrow-ish'), now)).toBe(true);
    });
});
