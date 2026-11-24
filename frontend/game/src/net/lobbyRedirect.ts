import { sessionConfig } from './sessionConfig';

const DEV_LOBBY_URL = 'http://localhost:3000';

/**
 * Resolve the lobby URL.
 *
 * Vite bakes env vars at build time, so a missing VITE_LOBBY_URL in production
 * must not fall back to localhost. Shared-domain deployments resolve to the
 * current origin instead, while local dev keeps the separate lobby server.
 */
export function resolveLobbyUrl(
    configuredUrl: string | undefined = import.meta.env.VITE_LOBBY_URL,
    isDev = import.meta.env.DEV,
    origin = window.location.origin,
): URL {
    if (configuredUrl) {
        // Relative values such as "/" resolve against the deployed origin.
        return new URL(configuredUrl, origin);
    }

    return new URL(isDev ? DEV_LOBBY_URL : '/', origin);
}

export function buildLobbyUrl(): URL {
    const url = resolveLobbyUrl();
    url.searchParams.set('roomId', sessionConfig.roomId);
    url.searchParams.set('color', sessionConfig.localColor);
    url.searchParams.set('mode', sessionConfig.mode);
    return url;
}

export function redirectToLobby(): void {
    window.location.assign(buildLobbyUrl().toString());
}
