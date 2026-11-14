import { describe, expect, it } from 'vitest';
import {
    finishOAuthCallback,
    friendlyOAuthError,
    isOAuthCallbackPath,
    readOAuthCallbackParams,
} from './oauthCallback';

function goTo(path: string, query = ''): void {
    window.history.replaceState(null, '', `${path}${query}`);
}

describe('OAuth callback URL handling', () => {
    it('only treats /auth/callback as the callback route', () => {
        goTo('/');
        expect(isOAuthCallbackPath()).toBe(false);

        goTo('/auth/callback');
        expect(isOAuthCallbackPath()).toBe(true);
    });

    it('reads the code and removes it from the URL immediately', () => {
        goTo('/auth/callback', '?code=single-use-code');

        expect(readOAuthCallbackParams()).toEqual({
            code: 'single-use-code',
            error: undefined,
            linked: false,
        });
        expect(window.location.pathname).toBe('/auth/callback');
        expect(window.location.search).toBe('');
    });

    it('reads provider errors and strips them too', () => {
        goTo('/auth/callback', '?error=access_denied');

        expect(readOAuthCallbackParams()).toEqual({
            code: undefined,
            error: 'access_denied',
            linked: false,
        });
        expect(window.location.search).toBe('');
    });

    it('reports an empty callback when neither code nor error is present', () => {
        goTo('/auth/callback');

        expect(readOAuthCallbackParams()).toEqual({
            code: undefined,
            error: undefined,
            linked: false,
        });
    });

    it('ignores query parameters outside the callback route', () => {
        goTo('/', '?code=not-ours');

        expect(readOAuthCallbackParams()).toBeNull();
        expect(window.location.search).toBe('?code=not-ours');
    });

    it('returns to the main page after the exchange settles', () => {
        goTo('/auth/callback', '?code=abc');
        readOAuthCallbackParams();

        finishOAuthCallback();

        expect(window.location.pathname).toBe('/');
        expect(window.location.search).toBe('');
    });
});

describe('friendlyOAuthError', () => {
    it('translates cancellation and state failures', () => {
        expect(friendlyOAuthError('access_denied')).toBe(
            'Sign-in was cancelled at the provider.',
        );
        expect(friendlyOAuthError('oauth_state_mismatch')).toBe(
            'OAuth state check failed. Please try again.',
        );
    });

    it('explains explicit account linking', () => {
        expect(friendlyOAuthError('account_link_required')).toContain(
            'already exists',
        );
    });

    it('does not leak unknown internal codes', () => {
        expect(friendlyOAuthError('some_internal_code')).toBe(
            'Sign-in could not be completed. Please try again.',
        );
    });
});
