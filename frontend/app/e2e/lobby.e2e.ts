import { expect, test } from '@playwright/test';

const hubUrl = 'http://127.0.0.1:4173/mock-hub';
const recordSeparator = String.fromCharCode(0x1e);

test('player joins a room and enters the game when match starts', async ({
    page,
}) => {
    await page.route(`${hubUrl}/negotiate**`, async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                negotiateVersion: 1,
                connectionId: 'e2e-connection',
                connectionToken: 'e2e-token',
                availableTransports: [
                    { transport: 'WebSockets', transferFormats: ['Text'] },
                ],
            }),
        });
    });

    await page.routeWebSocket(
        `${hubUrl.replace('http:', 'ws:')}**`,
        (socket) => {
            socket.onMessage((message) => {
                const frames = String(message)
                    .split(recordSeparator)
                    .filter(Boolean);

                for (const frame of frames) {
                    const packet = JSON.parse(frame) as {
                        protocol?: string;
                        invocationId?: string;
                        target?: string;
                        arguments?: unknown[];
                        type?: number;
                    };

                    if (packet.protocol === 'json') {
                        socket.send(`{}${recordSeparator}`);
                        continue;
                    }

                    if (packet.type !== 1 || !packet.invocationId) continue;

                    if (packet.target === 'JoinRoom') {
                        const [roomId] = packet.arguments as [string, string];
                        socket.send(
                            `${JSON.stringify({
                                type: 3,
                                invocationId: packet.invocationId,
                                result: {
                                    roomId,
                                    connectionId: 'e2e-connection',
                                    roomCreatedAt: 1,
                                    players: [
                                        {
                                            connectionId: 'e2e-connection',
                                            color: 'blue',
                                        },
                                    ],
                                    randomBarrelPositions: [],
                                },
                            })}${recordSeparator}`,
                        );
                    } else if (packet.target === 'StartMatch') {
                        socket.send(
                            `${JSON.stringify({
                                type: 3,
                                invocationId: packet.invocationId,
                            })}${recordSeparator}`,
                        );
                        socket.send(
                            `${JSON.stringify({
                                type: 1,
                                target: 'MatchStarted',
                                arguments: [{ roomId: 'arena one' }],
                            })}${recordSeparator}`,
                        );
                    }
                }
            });
        },
    );

    await page.route('http://127.0.0.1:4174/**', (route) =>
        route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><title>Game E2E</title><h1>Game</h1>',
        }),
    );

    await page.goto('/');
    await page.getByLabel('Room ID:').fill('arena one');
    await page.getByRole('button', { name: 'Join' }).click();

    await expect(page.locator('#room-id-display')).toHaveText('arena one');
    await expect(page.locator('#player-list .player-name')).toHaveText('Blue');
    await page.getByRole('button', { name: 'Start Game' }).click();

    await expect(page).toHaveURL(/roomId=arena%20one&color=blue/);
    await expect(page.getByRole('heading', { name: 'Game' })).toBeVisible();
});
