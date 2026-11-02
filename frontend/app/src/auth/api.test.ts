import { describe, expect, it, vi } from 'vitest';
import {
    ApiError,
    API_BASE,
    login,
    oauthStartUrl,
    refresh,
    register,
} from './api';
import {
    fetchUrls,
    jsonResponse,
    makeAuthResponse,
    requestBody,
    stubFetch,
    textResponse,
} from '../test/helpers';

async function catchError(promise: Promise<unknown>): Promise<ApiError> {
    try {
        await promise;
    } catch (error) {
        if (error instanceof ApiError) return error;
        throw error;
    }
    throw new Error('expected the request to fail');
}

describe('API_BASE', () => {
    it('defaults to localhost:8080', () => {
        expect(API_BASE).toBe('http://localhost:8080');
    });

    it('comes from VITE_API_URL without trailing slashes', async () => {
        vi.stubEnv('VITE_API_URL', 'https://api.example.test///');
        vi.resetModules();

        const fresh = await import('./api');

        expect(fresh.API_BASE).toBe('https://api.example.test');
        expect(fresh.oauthStartUrl('github')).toBe(
            `https://api.example.test/api/auth/oauth/github?redirect_uri=${encodeURIComponent(
                `${window.location.origin}${window.location.pathname}`,
            )}`,
        );
    });
});

describe('auth client requests', () => {
    it('POSTs register input as JSON and parses the response', async () => {
        const body = makeAuthResponse({ username: 'pilot42' });
        const fetchMock = stubFetch(() => jsonResponse(body));

        const result = await register({
            username: 'pilot42',
            email: 'pilot42@example.com',
            password: 'long-enough',
        });

        expect(result).toEqual(body);
        expect(fetchUrls(fetchMock)).toEqual([`${API_BASE}/api/auth/register`]);
        expect(requestBody(fetchMock.mock.calls[0])).toEqual({
            username: 'pilot42',
            email: 'pilot42@example.com',
            password: 'long-enough',
        });
        const init = fetchMock.mock.calls[0][1] as RequestInit | undefined;
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
            'Content-Type': 'application/json',
        });
    });

    it('POSTs login credentials', async () => {
        const fetchMock = stubFetch(() => jsonResponse(makeAuthResponse()));

        await login({ identifier: 'gabriel@example.com', password: 'hunter2' });

        expect(fetchUrls(fetchMock)).toEqual([`${API_BASE}/api/auth/login`]);
        expect(requestBody(fetchMock.mock.calls[0])).toEqual({
            identifier: 'gabriel@example.com',
            password: 'hunter2',
        });
    });

    it('POSTs the refresh token', async () => {
        const fetchMock = stubFetch(() => jsonResponse(makeAuthResponse()));

        await refresh('refresh-token');

        expect(fetchUrls(fetchMock)).toEqual([`${API_BASE}/api/auth/refresh`]);
        expect(requestBody(fetchMock.mock.calls[0])).toEqual({
            refreshToken: 'refresh-token',
        });
    });
});

describe('auth client error mapping', () => {
    it('surfaces a backend error message on 401', async () => {
        stubFetch(() => jsonResponse({ error: 'Invalid credentials.' }, 401));

        const error = await catchError(
            login({ identifier: 'gabriel', password: 'wrong' }),
        );

        expect(error.message).toBe('Invalid credentials.');
        expect(error.status).toBe(401);
    });

    it('falls back to the default message when a 401 has no body', async () => {
        stubFetch(() => textResponse('', 401));

        const error = await catchError(
            login({ identifier: 'gabriel', password: 'wrong' }),
        );

        expect(error.message).toBe('Invalid credentials.');
    });

    it('maps an empty 409 to the duplicate-account message', async () => {
        stubFetch(() => textResponse('', 409));

        const error = await catchError(
            register({
                username: 'gabriel',
                email: 'gabriel@example.com',
                password: 'long-enough',
            }),
        );

        expect(error.message).toBe('Username or email already taken.');
        expect(error.status).toBe(409);
    });

    it('joins ASP.NET validation errors into one readable message', async () => {
        stubFetch(() =>
            jsonResponse(
                {
                    title: 'One or more validation errors occurred.',
                    errors: { Password: ['Too short.'], Email: ['Invalid.'] },
                },
                400,
            ),
        );

        const error = await catchError(
            register({
                username: 'ab',
                email: 'nope',
                password: 'short',
            }),
        );

        expect(error.message).toBe('Too short. Invalid.');
        expect(error.status).toBe(400);
    });

    it('uses the problem-details title when there is no field detail', async () => {
        stubFetch(() => jsonResponse({ title: 'Something went wrong.' }, 500));

        const error = await catchError(
            login({ identifier: 'gabriel', password: 'hunter2' }),
        );

        expect(error.message).toBe('Something went wrong.');
    });

    it('falls back to a status-code message for unknown payloads', async () => {
        stubFetch(() => jsonResponse({ detail: 'hidden' }, 503));

        const error = await catchError(
            login({ identifier: 'gabriel', password: 'hunter2' }),
        );

        expect(error.message).toBe('Request failed (503).');
        expect(error.status).toBe(503);
    });

    it('turns a network failure into an actionable message', async () => {
        stubFetch(() => {
            throw new TypeError('Failed to fetch');
        });

        const error = await catchError(
            login({ identifier: 'gabriel', password: 'hunter2' }),
        );

        expect(error.message).toBe(
            'Could not reach the server. Is the backend running?',
        );
        expect(error.status).toBe(0);
    });

    it('rejects a success response that is not JSON', async () => {
        stubFetch(() => textResponse('<html>oops</html>', 200));

        const error = await catchError(
            login({ identifier: 'gabriel', password: 'hunter2' }),
        );

        expect(error.message).toBe('Unexpected response from server.');
    });
});

describe('oauthStartUrl', () => {
    it('encodes the current page as the redirect target', () => {
        const url = new URL(oauthStartUrl('fortytwo'));

        expect(`${url.origin}${url.pathname}`).toBe(
            `${API_BASE}/api/auth/oauth/fortytwo`,
        );
        expect(url.searchParams.get('redirect_uri')).toBe(
            `${window.location.origin}${window.location.pathname}`,
        );
    });
});
