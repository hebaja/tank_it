import { describe, expect, it } from 'vitest';
import { renderApp, type RenderedApp } from '../test/appHarness';
import {
    fetchUrls,
    jsonResponse,
    makeAuthResponse,
    requestBody,
    stubFetch,
} from '../test/helpers';

async function fillCredentials(
    app: RenderedApp,
    identifier: string,
    password: string,
) {
    await app.user.type(app.screen.getByLabelText(/^Username/), identifier);
    await app.user.type(app.screen.getByLabelText(/^Password/), password);
}

describe('LoginScreen', () => {
    it('shows inline validation and stays signed out on an empty submit', async () => {
        // Hang the request so the in-flight validation state stays observable.
        stubFetch(() => new Promise(() => {}));
        const app = await renderApp();

        await app.user.click(
            app.screen.getByRole('button', { name: 'Sign in' }),
        );

        expect(
            await app.screen.findByText('Enter your username or email.'),
        ).toBeInTheDocument();
        expect(
            app.screen.getByText('Enter your password.'),
        ).toBeInTheDocument();
        expect(
            app.screen.getByRole('heading', { name: 'Welcome back' }),
        ).toBeInTheDocument();
        expect(localStorage.getItem('tankit.accessToken')).toBeNull();
        expect(localStorage.getItem('tankit.refreshToken')).toBeNull();
        expect(localStorage.getItem('tankit.user')).toBeNull();
    });

    it('signs in and lands in the lobby', async () => {
        const fetchMock = stubFetch((url) => {
            if (url.endsWith('/api/auth/login')) {
                return jsonResponse(makeAuthResponse({ username: 'gabriel' }));
            }
            throw new Error(`unexpected request: ${url}`);
        });
        const app = await renderApp();
        await fillCredentials(app, 'gabriel', 'correct-horse-battery');

        await app.user.click(
            app.screen.getByRole('button', { name: 'Sign in' }),
        );

        expect(
            await app.screen.findByRole('heading', { name: 'Ready to roll?' }),
        ).toBeInTheDocument();
        expect(fetchUrls(fetchMock)).toEqual([
            'http://localhost:8080/api/auth/login',
        ]);
        expect(requestBody(fetchMock.mock.calls[0])).toEqual({
            identifier: 'gabriel',
            password: 'correct-horse-battery',
        });
        expect(localStorage.getItem('tankit.accessToken')).toBe('access-token');
        expect(
            JSON.parse(localStorage.getItem('tankit.user') ?? '{}'),
        ).toMatchObject({ username: 'gabriel' });
        expect(document.title).toBe('Tank It! — Lobby');
    });

    it('shows the backend message when the password is wrong', async () => {
        stubFetch((url) => {
            if (url.endsWith('/api/auth/login')) {
                return jsonResponse({ error: 'Invalid credentials.' }, 401);
            }
            throw new Error(`unexpected request: ${url}`);
        });
        const app = await renderApp();
        await fillCredentials(app, 'gabriel', 'wrong-password');

        await app.user.click(
            app.screen.getByRole('button', { name: 'Sign in' }),
        );

        expect(
            await app.screen.findByText('Invalid credentials.'),
        ).toBeInTheDocument();
        expect(
            app.screen.getByRole('heading', { name: 'Welcome back' }),
        ).toBeInTheDocument();
        expect(localStorage.getItem('tankit.accessToken')).toBeNull();
    });

    it('shows an actionable message when the backend is unreachable', async () => {
        stubFetch(() => {
            throw new TypeError('Failed to fetch');
        });
        const app = await renderApp();
        await fillCredentials(app, 'gabriel', 'correct-horse-battery');

        await app.user.click(
            app.screen.getByRole('button', { name: 'Sign in' }),
        );

        expect(
            await app.screen.findByText(
                'Could not reach the server. Is the backend running?',
            ),
        ).toBeInTheDocument();
        expect(
            app.screen.getByRole('heading', { name: 'Welcome back' }),
        ).toBeInTheDocument();
    });

    it('switches to the registration screen', async () => {
        const app = await renderApp();

        await app.user.click(
            app.screen.getByRole('button', { name: 'Create an account' }),
        );

        expect(
            await app.screen.findByRole('heading', {
                name: 'Create your account',
            }),
        ).toBeInTheDocument();
    });
});
