/**
 * OAuth redirect-flow helpers.
 *
 * Flow: an OAuth button navigates the browser to GET /api/auth/{provider}. The
 * backend runs the provider dance and redirects to /auth/callback?code=... —
 * never with a JWT. This module reads that single-use code, strips it from the
 * address bar immediately, and AuthContext exchanges it for the app's JWT.
 */

export interface OAuthCallbackParams {
    code?: string;
    error?: string;
    linked?: boolean;
}

export function isOAuthCallbackPath(): boolean {
    return window.location.pathname.replace(/\/+$/, '') === '/auth/callback';
}

/**
 * Reads callback parameters and removes them from the URL right away. The path
 * is kept during the exchange so the UI can render a progress screen.
 */
export function readOAuthCallbackParams(): OAuthCallbackParams | null {
    if (!isOAuthCallbackPath()) return null;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') ?? undefined;
    const error = params.get('error') ?? undefined;
    const linked = params.get('linked') === '1';

    // Credentials/error details must not linger in history or referrers.
    window.history.replaceState(null, '', '/auth/callback');

    return { code, error, linked };
}

/** Returns the browser to the app's main page once boot has settled. */
export function finishOAuthCallback(): void {
    if (isOAuthCallbackPath()) {
        window.history.replaceState(null, '', '/');
    }
}

export function friendlyOAuthError(code: string): string {
    switch (code) {
        case 'access_denied':
            return 'Sign-in was cancelled at the provider.';
        case 'oauth_state_mismatch':
        case 'invalid_state':
            return 'OAuth state check failed. Please try again.';
        case 'account_link_required':
            return 'An account with this email already exists. Sign in with your existing method first, then link this provider from the lobby.';
        case 'email_required':
            return 'This provider did not share a usable email address. Add one to your provider account and try again.';
        case 'link_failed':
            return 'Could not link this provider. Please try again.';
        case 'oauth_failed':
            return 'Sign-in could not be completed. Please try again.';
        default:
            return 'Sign-in could not be completed. Please try again.';
    }
}
