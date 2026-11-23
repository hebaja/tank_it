import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGIN = 'https://tank-it-f8dfda805723.herokuapp.com';

function stubWindow(search = '') {
    const assign = vi.fn();
    vi.stubGlobal('window', {
        location: { origin: ORIGIN, search, assign },
    });
    return assign;
}

async function loadLobbyRedirect() {
    return import('./lobbyRedirect');
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
});

describe('resolveLobbyUrl', () => {
    it('keeps localhost for local dev when no override is configured', async () => {
        stubWindow();
        const { resolveLobbyUrl } = await loadLobbyRedirect();

        expect(resolveLobbyUrl(undefined, true).toString()).toBe(
            'http://localhost:3000/',
        );
    });

    it('uses the deployed origin in production when no override is configured', async () => {
        stubWindow();
        const { resolveLobbyUrl } = await loadLobbyRedirect();

        expect(resolveLobbyUrl(undefined, false).toString()).toBe(`${ORIGIN}/`);
    });

    it('resolves a relative override against the deployed origin', async () => {
        stubWindow();
        const { resolveLobbyUrl } = await loadLobbyRedirect();

        expect(resolveLobbyUrl('/', false).toString()).toBe(`${ORIGIN}/`);
    });

    it('keeps an absolute override', async () => {
        stubWindow();
        const { resolveLobbyUrl } = await loadLobbyRedirect();

        expect(
            resolveLobbyUrl('https://lobby.example.com', false).toString(),
        ).toBe('https://lobby.example.com/');
    });
});

describe('redirectToLobby', () => {
    it('redirects to the lobby with the session parameters', async () => {
        const assign = stubWindow('?roomId=room-1&color=red&mode=championship');
        vi.stubEnv('VITE_LOBBY_URL', '/');
        const { redirectToLobby } = await loadLobbyRedirect();

        redirectToLobby();

        expect(assign).toHaveBeenCalledWith(
            `${ORIGIN}/?roomId=room-1&color=red&mode=championship`,
        );
    });
});
