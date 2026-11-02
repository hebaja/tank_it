import { describe, expect, it } from 'vitest';
import { renderApp, type RenderedApp } from '../test/appHarness';
import {
    fetchUrls,
    jsonResponse,
    makeAuthResponse,
    requestBody,
    stubFetch,
} from '../test/helpers';

const valid = {
    username: 'pilot42',
    email: 'pilot42@example.com',
    password: 'long-enough-password',
};

async function openRegister(app: RenderedApp) {
    await app.user.click(
        app.screen.getByRole('button', { name: 'Create an account' }),
    );
    await app.screen.findByRole('heading', { name: 'Create your account' });
}

async function fillForm(
    app: RenderedApp,
    values: {
        username: string;
        email: string;
        password: string;
        confirm?: string;
        displayName?: string;
    },
) {
    await app.user.type(
        app.screen.getByLabelText(/^Username/),
        values.username,
    );
    await app.user.type(app.screen.getByLabelText(/^Email/), values.email);
    if (values.displayName) {
        await app.user.type(
            app.screen.getByLabelText(/^Display name/),
            values.displayName,
        );
    }
    await app.user.type(
        app.screen.getByLabelText(/^Password/),
        values.password,
    );
    await app.user.type(
        app.screen.getByLabelText(/^Confirm password/),
        values.confirm ?? values.password,
    );
}

async function acceptTerms(app: RenderedApp) {
    await app.user.click(app.screen.getByRole('checkbox'));
}

describe('RegisterScreen', () => {
    it('mirrors the backend validation rules client-side', async () => {
        const fetchMock = stubFetch(() => {
            throw new Error('the API must not be called');
        });
        const app = await renderApp();
        await openRegister(app);

        await app.user.click(
            app.screen.getByRole('button', { name: 'Create account' }),
        );

        expect(
            await app.screen.findByText(
                'Username must be at least 3 characters.',
            ),
        ).toBeInTheDocument();
        expect(
            app.screen.getByText('Enter a valid email address.'),
        ).toBeInTheDocument();
        expect(
            app.screen.getByText('Password must be at least 8 characters.'),
        ).toBeInTheDocument();
        expect(
            app.screen.getByText(
                'You must accept the Terms & Conditions to register.',
            ),
        ).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports mismatched passwords without calling the API', async () => {
        const fetchMock = stubFetch(() => {
            throw new Error('the API must not be called');
        });
        const app = await renderApp();
        await openRegister(app);
        await fillForm(app, { ...valid, confirm: 'different-password' });
        await acceptTerms(app);

        await app.user.click(
            app.screen.getByRole('button', { name: 'Create account' }),
        );

        expect(
            await app.screen.findByText('Passwords do not match.'),
        ).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('creates the account once the terms are accepted', async () => {
        const fetchMock = stubFetch((url) => {
            if (url.endsWith('/api/auth/register')) {
                return jsonResponse(
                    makeAuthResponse({ username: valid.username }),
                );
            }
            throw new Error(`unexpected request: ${url}`);
        });
        const app = await renderApp();
        await openRegister(app);
        await fillForm(app, valid);
        await acceptTerms(app);

        await app.user.click(
            app.screen.getByRole('button', { name: 'Create account' }),
        );

        expect(
            await app.screen.findByRole('heading', { name: 'Ready to roll?' }),
        ).toBeInTheDocument();
        expect(fetchUrls(fetchMock)).toEqual([
            'http://localhost:8080/api/auth/register',
        ]);
        expect(requestBody(fetchMock.mock.calls[0])).toEqual(valid);
        expect(localStorage.getItem('tankit.accessToken')).toBe('access-token');
        expect(document.title).toBe('Tank It! — Lobby');
    });

    it('only sends the display name when one was typed', async () => {
        const fetchMock = stubFetch(() => jsonResponse(makeAuthResponse()));
        const app = await renderApp();
        await openRegister(app);
        await fillForm(app, { ...valid, displayName: '  Gabs  ' });
        await acceptTerms(app);

        await app.user.click(
            app.screen.getByRole('button', { name: 'Create account' }),
        );

        await app.screen.findByRole('heading', { name: 'Ready to roll?' });
        expect(requestBody(fetchMock.mock.calls[0])).toEqual({
            ...valid,
            displayName: 'Gabs',
        });
    });

    it('shows the duplicate-account conflict from the backend', async () => {
        stubFetch(() =>
            jsonResponse({ error: 'Username or email already taken.' }, 409),
        );
        const app = await renderApp();
        await openRegister(app);
        await fillForm(app, valid);
        await acceptTerms(app);

        await app.user.click(
            app.screen.getByRole('button', { name: 'Create account' }),
        );

        expect(
            await app.screen.findByText('Username or email already taken.'),
        ).toBeInTheDocument();
        expect(
            app.screen.getByRole('heading', { name: 'Create your account' }),
        ).toBeInTheDocument();
    });

    it('switches back to the sign-in screen', async () => {
        const app = await renderApp();
        await openRegister(app);

        await app.user.click(
            app.screen.getByRole('button', { name: 'Sign in' }),
        );

        expect(
            await app.screen.findByRole('heading', { name: 'Welcome back' }),
        ).toBeInTheDocument();
    });
});
