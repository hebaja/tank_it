/** Shared auth types mirroring backend/src/TankIt.Api/Controllers/AuthController.cs. */

/** Response body of POST /api/auth/{register,login,refresh} (camelCase JSON). */
export interface AuthResponse {
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshToken: string;
    userId: string;
    username: string;
}

/** What the SPA persists locally after any successful auth. */
export interface Session {
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshToken: string;
    userId: string;
    username: string;
}

export interface RegisterInput {
    username: string;
    email: string;
    password: string;
    displayName?: string;
}

export interface LoginInput {
    /** Username OR email, matching LoginRequest.Identifier on the backend. */
    identifier: string;
    password: string;
}

/** OAuth providers accepted by GET /api/auth/oauth/{provider}. */
export type OAuthProvider = 'google' | 'github' | 'fortytwo';

export const OAUTH_PROVIDERS: { id: OAuthProvider; label: string }[] = [
    { id: 'google', label: 'Google' },
    { id: 'github', label: 'GitHub' },
    { id: 'fortytwo', label: '42' },
];
