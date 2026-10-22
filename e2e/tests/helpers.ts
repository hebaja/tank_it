import { expect, type APIRequestContext, type Page } from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8080';

export interface Identity {
    username: string;
    email: string;
    password: string;
}

/** POST /api/auth/register payload — also what tokenStore persists. */
export interface SeededSession {
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshToken: string;
    userId: string;
    username: string;
}

/** Unique per call, so reruns never collide with accounts already in the DB. */
export function freshIdentity(): Identity {
    const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    return {
        username: `e2e${stamp}`,
        email: `e2e${stamp}@example.com`,
        password: 'e2e-password-1',
    };
}

/** Full sign-up through the UI — the auth flow itself is under test. */
export async function registerThroughUi(
    page: Page,
    identity: Identity,
): Promise<void> {
    await page.goto('/');
    await page
        .getByRole('button', { name: 'Create an account', exact: true })
        .click();
    await expect(
        page.getByRole('heading', { name: 'Create your account' }),
    ).toBeVisible();

    await page.locator('#username').fill(identity.username);
    await page.locator('#email').fill(identity.email);
    await page.locator('#password').fill(identity.password);
    await page.locator('#confirmPassword').fill(identity.password);
    await page.getByRole('checkbox').check();

    await page
        .getByRole('button', { name: 'Create account', exact: true })
        .click();
    await expect(
        page.getByRole('heading', { name: 'Ready to roll?' }),
    ).toBeVisible();
}

export async function signOut(page: Page): Promise<void> {
    // The shell keeps a labelled button for desktop and an icon button for
    // mobile — both are in the DOM, so take the first one.
    await page.getByRole('button', { name: 'Sign out' }).first().click();
    await expect(
        page.getByRole('heading', { name: 'Welcome back' }),
    ).toBeVisible();
}

export async function signIn(
    page: Page,
    identifier: string,
    password: string,
): Promise<void> {
    await page.locator('#identifier').fill(identifier);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

/**
 * Registers through the real API instead of the sign-up UI, so lobby tests
 * start on a session that already exists in the dev database.
 */
export async function createAccount(
    request: APIRequestContext,
): Promise<SeededSession> {
    const identity = freshIdentity();
    const response = await request.post(`${API_URL}/api/auth/register`, {
        data: {
            username: identity.username,
            email: identity.email,
            password: identity.password,
        },
    });
    if (!response.ok()) {
        throw new Error(
            `register failed: ${response.status()} ${await response.text()}`,
        );
    }
    return (await response.json()) as SeededSession;
}

/** Stores the session the way src/auth/tokenStore.ts does, then opens the app. */
export async function openLobby(
    page: Page,
    session: SeededSession,
): Promise<void> {
    await page.addInitScript((stored) => {
        window.localStorage.setItem('tankit.accessToken', stored.accessToken);
        window.localStorage.setItem(
            'tankit.accessTokenExpiresAt',
            stored.accessTokenExpiresAt,
        );
        window.localStorage.setItem('tankit.refreshToken', stored.refreshToken);
        window.localStorage.setItem(
            'tankit.user',
            JSON.stringify({ id: stored.userId, username: stored.username }),
        );
    }, session);

    await page.goto('/');
    await expect(
        page.getByRole('heading', { name: 'Ready to roll?' }),
    ).toBeVisible();
}

export async function joinRoom(
    page: Page,
    options: { roomId?: string; color?: string } = {},
): Promise<void> {
    if (options.roomId !== undefined) {
        await page.locator('#room-id').fill(options.roomId);
    }
    if (options.color !== undefined) {
        await page.getByRole('combobox', { name: 'Tank color' }).click();
        await page
            .getByRole('option', { name: options.color, exact: true })
            .click();
    }
    await page.getByRole('button', { name: 'Join', exact: true }).click();
}

/** Room IDs are unique per test so parallel workers never share a room. */
export function freshRoomId(): string {
    return `e2e-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
