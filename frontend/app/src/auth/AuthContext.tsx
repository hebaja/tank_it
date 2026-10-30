import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import {
    login as loginApi,
    refresh as refreshApi,
    register as registerApi,
} from './api';
import { readOAuthCallback } from './oauthCallback';
import {
    clearSession,
    isExpiringSoon,
    loadSession,
    saveSession,
} from './tokenStore';
import type { LoginInput, RegisterInput, Session } from './types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
    status: AuthStatus;
    session: Session | null;
    /** One-shot message to surface on the auth screens (e.g. OAuth failure). */
    notice: string | null;
    dismissNotice: () => void;
    login: (input: LoginInput) => Promise<void>;
    register: (input: RegisterInput) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Resolves the session once at app start: pending OAuth redirect first, then
 * the persisted session (refreshing it if the access token is about to expire).
 * Guarded so React StrictMode's double-mount can't fire a duplicate refresh
 * (the backend rotates refresh tokens — a second concurrent call would 401).
 */
interface BootResult {
    session: Session | null;
    error?: string;
}

let bootPromise: Promise<BootResult> | null = null;

function boot(): Promise<BootResult> {
    if (!bootPromise) {
        bootPromise = (async () => {
            const oauth = readOAuthCallback();
            if (oauth?.session) {
                saveSession(oauth.session);
                return { session: oauth.session };
            }
            if (oauth?.error) return { session: null, error: oauth.error };

            const stored = loadSession();
            if (!stored) return { session: null };
            if (!isExpiringSoon(stored)) return { session: stored };

            try {
                const fresh = await refreshApi(stored.refreshToken);
                saveSession(fresh);
                return { session: { ...fresh } };
            } catch {
                clearSession();
                return { session: null };
            }
        })();
    }
    return bootPromise;
}

/** Called after login/register/logout so a later mount re-reads storage
 *  instead of replaying the cached boot result. */
function invalidateBoot(): void {
    bootPromise = null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<AuthStatus>('loading');
    const [session, setSession] = useState<Session | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        boot().then((result) => {
            if (!mounted.current) return;
            setSession(result.session);
            setNotice(result.error ?? null);
            setStatus(result.session ? 'authenticated' : 'anonymous');
        });
        return () => {
            mounted.current = false;
        };
    }, []);

    const login = useCallback(async (input: LoginInput) => {
        const result = await loginApi(input);
        const next: Session = { ...result };
        saveSession(next);
        invalidateBoot();
        setSession(next);
        setNotice(null);
        setStatus('authenticated');
    }, []);

    const register = useCallback(async (input: RegisterInput) => {
        const result = await registerApi(input);
        const next: Session = { ...result };
        saveSession(next);
        invalidateBoot();
        setSession(next);
        setNotice(null);
        setStatus('authenticated');
    }, []);

    const logout = useCallback(() => {
        clearSession();
        invalidateBoot();
        setSession(null);
        setNotice(null);
        setStatus('anonymous');
    }, []);

    const dismissNotice = useCallback(() => setNotice(null), []);

    const value = useMemo<AuthContextValue>(
        () => ({
            status,
            session,
            notice,
            dismissNotice,
            login,
            register,
            logout,
        }),
        [status, session, notice, dismissNotice, login, register, logout],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}
