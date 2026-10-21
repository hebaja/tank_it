import type { AuthResponse, Session } from './types';

const ACCESS_KEY = 'tankit.accessToken';
const REFRESH_KEY = 'tankit.refreshToken';
const EXPIRES_KEY = 'tankit.accessTokenExpiresAt';
const USER_KEY = 'tankit.user';

/** Refresh slightly before expiry so we never race an in-flight request. */
const EXPIRY_SKEW_MS = 30_000;

interface StoredUser {
    id: string;
    username: string;
}

export function saveSession(res: AuthResponse): void {
    try {
        const user: StoredUser = { id: res.userId, username: res.username };
        localStorage.setItem(ACCESS_KEY, res.accessToken);
        localStorage.setItem(REFRESH_KEY, res.refreshToken);
        localStorage.setItem(EXPIRES_KEY, res.accessTokenExpiresAt);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
        // Storage unavailable (private mode/quota) — session just won't persist.
    }
}

export function loadSession(): Session | null {
    try {
        const accessToken = localStorage.getItem(ACCESS_KEY);
        const refreshToken = localStorage.getItem(REFRESH_KEY);
        const accessTokenExpiresAt = localStorage.getItem(EXPIRES_KEY);
        const rawUser = localStorage.getItem(USER_KEY);
        if (!accessToken || !refreshToken || !accessTokenExpiresAt || !rawUser)
            return null;

        const user = JSON.parse(rawUser) as StoredUser;
        if (!user?.id || !user?.username) return null;
        return {
            accessToken,
            refreshToken,
            accessTokenExpiresAt,
            userId: user.id,
            username: user.username,
        };
    } catch {
        return null;
    }
}

export function clearSession(): void {
    try {
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(EXPIRES_KEY);
        localStorage.removeItem(USER_KEY);
    } catch {
        // Nothing to clean up if storage is unavailable.
    }
}

export function isExpiringSoon(
    session: Session,
    now: number = Date.now(),
): boolean {
    const expiresAt = Date.parse(session.accessTokenExpiresAt);
    if (Number.isNaN(expiresAt)) return true;
    return expiresAt - now <= EXPIRY_SKEW_MS;
}
