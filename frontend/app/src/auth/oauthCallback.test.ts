import { describe, expect, it } from 'vitest';
import { readOAuthCallback } from './oauthCallback';
import { fakeJwt } from '../test/helpers';

function goTo(query = '', hash = ''): void {
    window.history.replaceState(null, '', `/${query}${hash}`);
}

const expiresAt = '2030-01-01T00:15:00.000Z';

describe('readOAuthCallback — success', () => {
    it('reads tokens from the query string and cleans the URL', () => {
        goTo(
            `?access_token=at&refresh_token=rt&expires_at=${encodeURIComponent(
                expiresAt,
            )}&user_id=guid-1&username=pilot42`,
        );

        expect(readOAuthCallback()).toEqual({
            session: {
                accessToken: 'at',
                refreshToken: 'rt',
                accessTokenExpiresAt: expiresAt,
                userId: 'guid-1',
                username: 'pilot42',
            },
        });
        // Credentials must not linger in the address bar or history.
        expect(window.location.search).toBe('');
        expect(window.location.hash).toBe('');
        expect(window.location.pathname).toBe('/');
    });

    it('reads tokens from the fragment (never sent to server logs)', () => {
        goTo(
            '',
            '#access_token=at&refresh_token=rt&user_id=guid-2&username=pilot',
        );

        const result = readOAuthCallback();

        expect(result?.session?.accessToken).toBe('at');
        expect(result?.session?.refreshToken).toBe('rt');
        expect(result?.session?.username).toBe('pilot');
        expect(window.location.hash).toBe('');
    });

    it('prefers query values over fragment values', () => {
        goTo(
            '?username=from-query',
            '#username=from-fragment&access_token=at&refresh_token=rt',
        );

        expect(readOAuthCallback()?.session?.username).toBe('from-query');
    });

    it('falls back to JWT claims for the display fields', () => {
        const token = fakeJwt({
            sub: 'guid-from-claim',
            unique_name: 'claim-pilot',
            exp: Math.floor(Date.parse(expiresAt) / 1000),
        });
        goTo(`?access_token=${token}&refresh_token=rt`);

        const session = readOAuthCallback()?.session;

        expect(session?.userId).toBe('guid-from-claim');
        expect(session?.username).toBe('claim-pilot');
        expect(session?.accessTokenExpiresAt).toBe(expiresAt);
    });

    it('defaults the expiry to 15 minutes when nothing is known', () => {
        const before = Date.now();
        goTo('?access_token=opaque&refresh_token=rt');

        const session = readOAuthCallback()?.session;
        const expiresAtMs = Date.parse(session?.accessTokenExpiresAt ?? '');

        expect(session?.username).toBe('player');
        expect(session?.userId).toBe('');
        expect(expiresAtMs).toBeGreaterThanOrEqual(before + 14 * 60_000);
        expect(expiresAtMs).toBeLessThanOrEqual(Date.now() + 16 * 60_000);
    });
});

describe('readOAuthCallback — failures', () => {
    it('ignores a URL without any auth result', () => {
        goTo('?view=login');

        expect(readOAuthCallback()).toBeNull();
        // Nothing was read, so the URL stays untouched.
        expect(window.location.search).toBe('?view=login');
    });

    it('translates access_denied into a friendly message', () => {
        goTo('?error=access_denied');

        expect(readOAuthCallback()).toEqual({
            error: 'Sign-in was cancelled at the provider.',
        });
        expect(window.location.search).toBe('');
    });

    it('translates a state mismatch into a retryable message', () => {
        goTo('?error=oauth_state_mismatch');

        expect(readOAuthCallback()?.error).toBe(
            'OAuth state check failed. Please try again.',
        );
    });

    it('prefers error_description over the error code', () => {
        goTo('?error=access_denied&error_description=Provider+said+no');

        expect(readOAuthCallback()?.error).toBe(
            'OAuth sign-in failed: Provider said no',
        );
    });

    it('reports a response that is missing a token', () => {
        goTo('?access_token=at-no-refresh');

        expect(readOAuthCallback()?.error).toBe(
            'OAuth response was missing tokens. Please try again.',
        );
        expect(window.location.search).toBe('');
    });
});
