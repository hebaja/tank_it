import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/appHarness';
import {
    API_ORIGIN,
    fakeJwt,
    fetchUrls,
    jsonResponse,
    makeAuthResponse,
    requestBody,
    seedSession,
    stubFetch,
} from '../test/helpers';

function unexpectedFetch(url: string): never {
    throw new Error(`unexpected request: ${url}`);
}

describe('AuthContext boot', () => {
    it('starts anonymous when nothing is stored', async () => {
        const fetchMock = stubFetch(unexpectedFetch);
        const app = await renderApp();

        expect(
            await app.screen.findByRole('heading', { name: 'Welcome back' }),
        ).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(document.title).toBe('Tank It! — Sign in');
    });

    it('restores a persisted session without touching the API', async () => {
        seedSession();
        const fetchMock = stubFetch(unexpectedFetch);

        const app = await renderApp();

        expect(
            await app.screen.findByRole('heading', { name: 'Ready to roll?' }),
        ).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(app.screen.getByText('gabriel')).toBeInTheDocument();
    });

    it('refreshes an expiring token exactly once (StrictMode double mount)', async () => {
        const stored = seedSession({
            accessTokenExpiresAt: new Date(Date.now() + 10_000).toISOString(),
        });
        const rotated = makeAuthResponse({
            accessToken: 'rotated-access',
            refreshToken: 'rotated-refresh',
            accessTokenExpiresAt: new Date(
                Date.now() + 15 * 60_000,
            ).toISOString(),
        });
        const fetchMock = stubFetch((url) => {
            if (url.endsWith('/api/auth/refresh')) return jsonResponse(rotated);
            return unexpectedFetch(url);
        });

        const app = await renderApp();

        expect(
            await app.screen.findByRole('heading', { name: 'Ready to roll?' }),
        ).toBeInTheDocument();
        // The backend rotates refresh tokens — a second call would 401.
        expect(fetchUrls(fetchMock)).toEqual([
            `${API_ORIGIN}/api/auth/refresh`,
        ]);
        expect(requestBody(fetchMock.mock.calls[0])).toEqual({
            refreshToken: stored.refreshToken,
        });
        expect(localStorage.getItem('tankit.accessToken')).toBe(
            'rotated-access',
        );
        expect(localStorage.getItem('tankit.refreshToken')).toBe(
            'rotated-refresh',
        );
    });

    it('drops the stored session when the refresh is rejected', async () => {
        seedSession({
            accessTokenExpiresAt: new Date(Date.now() + 10_000).toISOString(),
        });
        stubFetch((url) => {
            if (url.endsWith('/api/auth/refresh')) {
                return jsonResponse(
                    { error: 'Invalid or expired refresh token.' },
                    401,
                );
            }
            return unexpectedFetch(url);
        });

        const app = await renderApp();

        expect(
            await app.screen.findByRole('heading', { name: 'Welcome back' }),
        ).toBeInTheDocument();
        expect(localStorage.getItem('tankit.accessToken')).toBeNull();
        expect(localStorage.getItem('tankit.refreshToken')).toBeNull();
        expect(localStorage.getItem('tankit.user')).toBeNull();
    });

    it('shows an OAuth failure as a dismissible notice', async () => {
        window.history.replaceState(null, '', '/?error=access_denied');
        const fetchMock = stubFetch(unexpectedFetch);

        const app = await renderApp();

        expect(
            await app.screen.findByText(
                'Sign-in was cancelled at the provider.',
            ),
        ).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(window.location.search).toBe('');

        // MUI's Alert close button is labelled by `closeText` ("Close").
        await app.user.click(app.screen.getByRole('button', { name: 'Close' }));
        expect(
            app.screen.queryByText('Sign-in was cancelled at the provider.'),
        ).toBeNull();
    });

    it('ingests OAuth callback tokens and strips them from the URL', async () => {
        const accessToken = fakeJwt({
            sub: '22222222-3333-4444-5555-666666666666',
            unique_name: 'oauth-pilot',
            exp: Math.floor(Date.now() / 1000) + 900,
        });
        const params = new URLSearchParams({
            access_token: accessToken,
            refresh_token: 'oauth-refresh',
            user_id: '22222222-3333-4444-5555-666666666666',
            username: 'oauth-pilot',
        });
        window.history.replaceState(null, '', `/?${params.toString()}`);
        const fetchMock = stubFetch(unexpectedFetch);

        const app = await renderApp();

        expect(
            await app.screen.findByRole('heading', { name: 'Ready to roll?' }),
        ).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(localStorage.getItem('tankit.accessToken')).toBe(accessToken);
        expect(localStorage.getItem('tankit.refreshToken')).toBe(
            'oauth-refresh',
        );
        expect(window.location.search).toBe('');
        expect(app.screen.getByText('oauth-pilot')).toBeInTheDocument();
    });

    it('signs out back to the sign-in screen and clears storage', async () => {
        seedSession();
        stubFetch(unexpectedFetch);

        const app = await renderApp();
        await app.screen.findByRole('heading', { name: 'Ready to roll?' });

        // The shell keeps a labelled button for desktop and a tooltip-labelled
        // icon button for mobile; both sign out, so click the first one.
        const [signOut] = app.screen.getAllByRole('button', {
            name: 'Sign out',
        });
        await app.user.click(signOut);

        expect(
            await app.screen.findByRole('heading', { name: 'Welcome back' }),
        ).toBeInTheDocument();
        expect(localStorage.getItem('tankit.accessToken')).toBeNull();
        expect(localStorage.getItem('tankit.refreshToken')).toBeNull();
        expect(localStorage.getItem('tankit.user')).toBeNull();
        expect(document.title).toBe('Tank It! — Sign in');
    });
});
