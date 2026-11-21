import type {
    AuthResponse,
    LoginInput,
    OAuthProvider,
    RegisterInput,
} from './types';

/** Backend origin; browser calls it directly (CORS allows the dev origins). */
export const API_BASE = String(
    import.meta.env.VITE_API_URL ?? 'http://localhost:8080',
).replace(/\/+$/, '');

/** Any non-2xx response — carries a message ready to show in the UI. */
export class ApiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

/** Pull a human-readable message out of ASP.NET error payloads. */
function messageFrom(data: unknown, status: number): string {
    if (data && typeof data === 'object') {
        const body = data as Record<string, unknown>;
        if (typeof body.error === 'string' && body.error.trim())
            return body.error;
        if (typeof body.title === 'string' && body.title.trim() && !body.errors)
            return body.title;
        if (body.errors && typeof body.errors === 'object') {
            const parts = Object.values(body.errors as Record<string, unknown>)
                .flatMap((v) => (Array.isArray(v) ? v : [v]))
                .map((v) => String(v))
                .filter(Boolean);
            if (parts.length) return parts.join(' ');
        }
    }
    if (status === 401) return 'Invalid credentials.';
    if (status === 409) return 'Username or email already taken.';
    if (status === 0)
        return 'Could not reach the server. Is the backend running?';
    return `Request failed (${status}).`;
}

async function post<T>(
    path: string,
    body: unknown,
    accessToken?: string,
): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    let res: Response;
    try {
        res = await fetch(`${API_BASE}${path}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
    } catch {
        // Network-level failure: surface it in the UI, never via console.
        throw new ApiError(
            'Could not reach the server. Is the backend running?',
            0,
        );
    }

    let data: unknown = null;
    const text = await res.text();
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = null;
        }
    }

    if (!res.ok) throw new ApiError(messageFrom(data, res.status), res.status);
    if (!data || typeof data !== 'object')
        throw new ApiError('Unexpected response from server.', res.status);
    return data as T;
}

export function register(input: RegisterInput): Promise<AuthResponse> {
    return post<AuthResponse>('/api/auth/register', input);
}

export function login(input: LoginInput): Promise<AuthResponse> {
    return post<AuthResponse>('/api/auth/login', input);
}

export function refresh(refreshToken: string): Promise<AuthResponse> {
    return post<AuthResponse>('/api/auth/refresh', { refreshToken });
}

/**
 * Entry point of the provider redirect flow: the browser navigates here and the
 * backend takes over (state, provider redirect, callback), finally sending the
 * user back to `redirect_uri` with tokens (or an error) as URL parameters.
 */
export function oauthStartUrl(provider: OAuthProvider): string {
    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    return `${API_BASE}/api/auth/oauth/${provider}?redirect_uri=${encodeURIComponent(redirectUri)}`;
}
