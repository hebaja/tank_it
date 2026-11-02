/**
 * OAuth redirect-flow helpers.
 *
 * Flow: an OAuth button navigates the browser to GET /api/auth/oauth/{provider}
 * (see api.ts oauthStartUrl). The backend runs the provider dance and redirects
 * the user back to `redirect_uri` with the auth result as URL parameters:
 *
 *   success: ?access_token=...&refresh_token=...&expires_at=...&user_id=...&username=...
 *            (the hash variant #access_token=... is accepted too — tokens then
 *            never reach server logs)
 *   failure: ?error=access_denied  (or any provider error code / description)
 *
 * The backend endpoints are still stubbed (separate issue); this module consumes
 * that contract and cleans the URL once read so tokens don't linger in history.
 */
import type { Session } from './types';

export interface OAuthCallbackResult {
    session?: Session;
    error?: string;
}

function collectParams(): URLSearchParams {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
    if (hash.includes('=')) {
        const hashParams = new URLSearchParams(hash);
        hashParams.forEach((value, key) => {
            if (!params.has(key)) params.set(key, value);
        });
    }
    return params;
}

/** Best-effort client-side read of JWT claims (payload is not signed here — the
 * server is the source of truth; this only fills display fields after OAuth). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
    const part = token.split('.')[1];
    if (!part) return null;
    try {
        const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(base64)) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function friendlyOAuthError(code: string): string {
    switch (code) {
        case 'access_denied':
            return 'Sign-in was cancelled at the provider.';
        case 'oauth_state_mismatch':
        case 'invalid_state':
            return 'OAuth state check failed. Please try again.';
        default:
            return `OAuth sign-in failed: ${code}`;
    }
}

/** Reads a pending OAuth result from the current URL, if any. */
export function readOAuthCallback(): OAuthCallbackResult | null {
    const params = collectParams();
    const accessToken = params.get('access_token') ?? params.get('accessToken');
    const refreshToken =
        params.get('refresh_token') ?? params.get('refreshToken');
    const error = params.get('error_description') ?? params.get('error');

    if (!accessToken && !refreshToken && !error) return null;

    // Strip the credentials/error from the address bar and history.
    window.history.replaceState(null, '', window.location.pathname);

    if (error) return { error: friendlyOAuthError(error) };
    if (!accessToken || !refreshToken) {
        return {
            error: 'OAuth response was missing tokens. Please try again.',
        };
    }

    const claims = decodeJwtPayload(accessToken);
    const session: Session = {
        accessToken,
        refreshToken,
        accessTokenExpiresAt:
            params.get('expires_at') ??
            params.get('accessTokenExpiresAt') ??
            (typeof claims?.exp === 'number'
                ? new Date(claims.exp * 1000).toISOString()
                : new Date(Date.now() + 15 * 60_000).toISOString()),
        userId:
            params.get('user_id') ??
            params.get('userId') ??
            String(claims?.sub ?? ''),
        username:
            params.get('username') ?? String(claims?.unique_name ?? 'player'),
    };
    return { session };
}
