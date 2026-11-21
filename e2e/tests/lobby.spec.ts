import { expect, test } from '@playwright/test';
import { createAccount, freshRoomId, joinRoom, openLobby } from './helpers';

test.describe('lobby', () => {
    test('joins the default room and lists me as a player', async ({
        page,
        request,
    }) => {
        const session = await createAccount(request);
        await openLobby(page, session);

        await joinRoom(page);

        await expect(
            page.getByRole('heading', { name: 'Room: local-dev-room' }),
        ).toBeVisible();
        await expect(page.getByText('Blue', { exact: true })).toBeVisible();
        await expect(page.getByText('you', { exact: true })).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Join', exact: true }),
        ).toHaveCount(0);
        await expect(
            page.getByRole('button', { name: 'Leave room' }),
        ).toBeVisible();
    });

    test('joins a custom room with the picked tank color', async ({
        page,
        request,
    }) => {
        const session = await createAccount(request);
        const roomId = freshRoomId();
        await openLobby(page, session);

        await joinRoom(page, { roomId, color: 'Red' });

        await expect(
            page.getByRole('heading', { name: `Room: ${roomId}` }),
        ).toBeVisible();
        await expect(page.getByText('Red', { exact: true })).toBeVisible();
        await expect(page.getByText('you', { exact: true })).toBeVisible();
    });

    test('shows a second player joining and leaving the room', async ({
        browser,
        request,
    }) => {
        const roomId = freshRoomId();
        const hostSession = await createAccount(request);
        const guestSession = await createAccount(request);

        const hostContext = await browser.newContext();
        const guestContext = await browser.newContext();
        try {
            const hostPage = await hostContext.newPage();
            const guestPage = await guestContext.newPage();
            await openLobby(hostPage, hostSession);
            await openLobby(guestPage, guestSession);

            await joinRoom(hostPage, { roomId, color: 'Blue' });
            await joinRoom(guestPage, { roomId, color: 'Red' });

            // The hub broadcast is what puts the guest on the host's list.
            await expect(
                hostPage.getByText('Red', { exact: true }),
            ).toBeVisible();
            await expect(
                hostPage.getByText('Blue', { exact: true }),
            ).toBeVisible();
            await expect(
                hostPage.getByText('you', { exact: true }),
            ).toBeVisible();
            await expect(
                guestPage.getByText('Blue', { exact: true }),
            ).toBeVisible();

            await guestPage.getByRole('button', { name: 'Leave room' }).click();
            await expect(
                guestPage.getByRole('heading', { name: 'Ready to roll?' }),
            ).toBeVisible();
            await expect(
                hostPage.getByText('Red', { exact: true }),
            ).toHaveCount(0);
            await expect(
                hostPage.getByText('Blue', { exact: true }),
            ).toBeVisible();
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('leaves the room and returns to the join form', async ({
        page,
        request,
    }) => {
        const session = await createAccount(request);
        const roomId = freshRoomId();
        await openLobby(page, session);

        await joinRoom(page, { roomId });
        await expect(
            page.getByRole('heading', { name: `Room: ${roomId}` }),
        ).toBeVisible();

        await page.getByRole('button', { name: 'Leave room' }).click();

        await expect(
            page.getByRole('heading', { name: 'Ready to roll?' }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Join', exact: true }),
        ).toBeEnabled();
        await expect(page.getByText('you', { exact: true })).toHaveCount(0);
    });

    test('starts the match and hands the browser to the game', async ({
        page,
        request,
    }) => {
        const session = await createAccount(request);
        const roomId = freshRoomId();
        await openLobby(page, session);

        await joinRoom(page, { roomId });
        await expect(
            page.getByRole('heading', { name: `Room: ${roomId}` }),
        ).toBeVisible();

        await page.getByRole('button', { name: 'Start Game' }).click();

        await page.waitForURL(
            (url) => url.searchParams.get('roomId') === roomId,
        );
    });
});
