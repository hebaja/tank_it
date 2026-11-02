import type { RenderResult } from '@testing-library/react';
import { vi } from 'vitest';

type ReactTestingLibrary = typeof import('@testing-library/react');
type UserEventModule = typeof import('@testing-library/user-event');

export interface RenderedApp extends RenderResult {
    screen: ReactTestingLibrary['screen'];
    waitFor: ReactTestingLibrary['waitFor'];
    act: ReactTestingLibrary['act'];
    user: ReturnType<UserEventModule['default']['setup']>;
}

let mounted: (() => void) | null = null;

/** Unmounts the app a previous `renderApp` call left behind. */
export function cleanupApp(): void {
    mounted?.();
    mounted = null;
}

/**
 * Renders the SPA exactly like src/main.tsx (React StrictMode included) and
 * lets the auth boot settle before returning.
 *
 * Every call starts from a freshly imported module graph: AuthContext caches
 * its boot result (session restore / token refresh) in module scope, so reusing
 * the module would leak one test's boot outcome into the next. React is
 * re-imported together with the app — otherwise testing-library and the app
 * would run on two different React copies.
 */
export async function renderApp(): Promise<RenderedApp> {
    cleanupApp();
    vi.resetModules();

    const rtl: ReactTestingLibrary = await import('@testing-library/react');
    const userEvent: UserEventModule =
        await import('@testing-library/user-event');
    const [app, react] = await Promise.all([import('../App'), import('react')]);

    const view = rtl.render(
        react.createElement(
            react.StrictMode,
            null,
            react.createElement(app.default),
        ),
    );
    mounted = rtl.cleanup;

    // Drain the boot promise (session restore / token refresh) inside act so
    // React does not warn about state updates happening outside of it.
    await rtl.act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });

    return {
        ...view,
        screen: rtl.screen,
        waitFor: rtl.waitFor,
        act: rtl.act,
        user: userEvent.default.setup(),
    };
}
