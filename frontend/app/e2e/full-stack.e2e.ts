import { expect, test } from '@playwright/test';

function roomId() {
    return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test('real lobby starts the backend match and loads the Phaser game', async ({
    page,
}) => {
    const room = roomId();
    const healthResponse = await page.request.get(
        'http://127.0.0.1:18080/api/health',
    );

    expect(healthResponse.ok()).toBe(true);
    expect(await healthResponse.json()).toMatchObject({
        status: 'ok',
        database: 'connected',
    });

    await page.goto('/');
    await page.getByLabel('Room ID:').fill(room);
    await page.getByRole('button', { name: 'Join' }).click();
    await expect(page.locator('#room-id-display')).toHaveText(room);
    await expect(page.locator('#player-list .player-name')).toHaveText('Blue');

    const gameHubNegotiation = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
            url.hostname === '127.0.0.1' &&
            url.pathname === '/hubs/game/negotiate'
        );
    });
    await page.getByRole('button', { name: 'Start Game' }).click();

    await expect(page).toHaveURL(
        new RegExp(`127\\.0\\.0\\.1:4174/\\?roomId=${room}&color=blue`),
    );
    expect((await gameHubNegotiation).ok()).toBe(true);
    await expect(page.locator('#game-container canvas')).toBeVisible({
        timeout: 30_000,
    });
});

test('real lobby reflects another player joining and leaving', async ({
    context,
}) => {
    const room = roomId();
    const blue = await context.newPage();
    const green = await context.newPage();

    await blue.goto('/');
    await blue.getByLabel('Room ID:').fill(room);
    await blue.getByRole('button', { name: 'Join' }).click();
    await expect(blue.locator('#room-id-display')).toHaveText(room);

    await green.goto('/');
    await green.getByLabel('Room ID:').fill(room);
    await green.getByLabel('Tank Color:').selectOption('green');
    await green.getByRole('button', { name: 'Join' }).click();

    await expect(blue.locator('#player-list .player-name')).toHaveText([
        'Blue',
        'Green',
    ]);
    await expect(green.locator('#player-list .player-name')).toHaveText([
        'Blue',
        'Green',
    ]);

    await green.getByRole('button', { name: 'Leave' }).click();
    await expect(blue.locator('#player-list .player-name')).toHaveText([
        'Blue',
    ]);
    await expect(green.locator('#join-form')).toBeVisible();
    await blue.getByRole('button', { name: 'Leave' }).click();
});
