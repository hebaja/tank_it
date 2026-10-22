import { expect, test } from '@playwright/test';
import { freshIdentity, registerThroughUi, signIn, signOut } from './helpers';

test.describe('authentication', () => {
    test('registers a player and lands in the lobby', async ({ page }) => {
        const identity = freshIdentity();

        await registerThroughUi(page, identity);

        await expect(page).toHaveTitle('Tank It! — Lobby');
        await expect(
            page.getByRole('heading', { name: 'Tank It!' }),
        ).toBeVisible();
        await expect(
            page.getByText(identity.username, { exact: true }),
        ).toBeVisible();
        const accessToken = await page.evaluate(() =>
            window.localStorage.getItem('tankit.accessToken'),
        );
        expect(accessToken).toBeTruthy();

        // The session survives a reload without asking for credentials again.
        await page.reload();
        await expect(
            page.getByRole('heading', { name: 'Ready to roll?' }),
        ).toBeVisible();
    });

    test('signs out and signs back in with the same credentials', async ({
        page,
    }) => {
        const identity = freshIdentity();
        await registerThroughUi(page, identity);

        await signOut(page);
        expect(
            await page.evaluate(() =>
                window.localStorage.getItem('tankit.accessToken'),
            ),
        ).toBeNull();
        expect(
            await page.evaluate(() =>
                window.localStorage.getItem('tankit.user'),
            ),
        ).toBeNull();

        await signIn(page, identity.username, identity.password);
        await expect(
            page.getByRole('heading', { name: 'Ready to roll?' }),
        ).toBeVisible();
        await expect(
            page.getByText(identity.username, { exact: true }),
        ).toBeVisible();
    });

    test('rejects a wrong password with the backend message', async ({
        page,
    }) => {
        const identity = freshIdentity();
        await registerThroughUi(page, identity);
        await signOut(page);

        await signIn(page, identity.username, 'not-the-password');

        await expect(page.getByText('Invalid credentials.')).toBeVisible();
        await expect(
            page.getByRole('heading', { name: 'Welcome back' }),
        ).toBeVisible();
        expect(
            await page.evaluate(() =>
                window.localStorage.getItem('tankit.accessToken'),
            ),
        ).toBeNull();
    });

    test('blocks account creation until the terms are accepted', async ({
        page,
    }) => {
        const identity = freshIdentity();
        await page.goto('/');
        await page
            .getByRole('button', { name: 'Create an account', exact: true })
            .click();

        await page.locator('#username').fill(identity.username);
        await page.locator('#email').fill(identity.email);
        await page.locator('#password').fill(identity.password);
        await page.locator('#confirmPassword').fill(identity.password);

        await page
            .getByRole('button', { name: 'Create account', exact: true })
            .click();

        await expect(
            page.getByText(
                'You must accept the Terms & Conditions to register.',
            ),
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { name: 'Create your account' }),
        ).toBeVisible();
        expect(
            await page.evaluate(() =>
                window.localStorage.getItem('tankit.accessToken'),
            ),
        ).toBeNull();
    });

    test('shows an OAuth failure as a dismissible notice', async ({ page }) => {
        await page.goto('/?error=access_denied');

        const notice = page.getByText('Sign-in was cancelled at the provider.');
        await expect(notice).toBeVisible();
        // The callback parameters must not linger in the address bar.
        await expect(page).toHaveURL(/^[^?]*$/);

        await page.getByRole('button', { name: 'Close', exact: true }).click();
        await expect(notice).toHaveCount(0);
    });
});
