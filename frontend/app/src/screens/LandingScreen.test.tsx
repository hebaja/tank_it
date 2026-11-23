import { describe, expect, it } from 'vitest';
import { renderApp, type RenderedApp } from '../test/appHarness';
import { seedSession } from '../test/helpers';

async function openLanding(app: RenderedApp) {
    await app.screen.findByRole('heading', { name: 'Tank It!' });
}

describe('LandingScreen', () => {
    it('shows the guest state and all action buttons', async () => {
        const app = await renderApp();
        await openLanding(app);

        expect(
            app.screen.getByRole('img', { name: /blue and red tanks/i }),
        ).toBeInTheDocument();
        expect(app.screen.getByText('Guest')).toBeInTheDocument();
        expect(
            app.screen.getByRole('button', { name: 'Login' }),
        ).toBeInTheDocument();
        expect(
            app.screen.getByRole('button', { name: 'Local Play' }),
        ).toBeInTheDocument();
        expect(
            app.screen.getByRole('button', { name: 'Online Play' }),
        ).toBeInTheDocument();
        expect(
            app.screen.getByRole('button', { name: 'Terms & Conditions' }),
        ).toBeInTheDocument();
        expect(app.screen.queryByRole('button', { name: 'Logout' })).toBeNull();
        expect(app.screen.queryByText('gabriel')).toBeNull();
    });

    it('opens the auth screen from Login', async () => {
        const app = await renderApp();
        await openLanding(app);

        await app.user.click(app.screen.getByRole('button', { name: 'Login' }));

        expect(
            await app.screen.findByRole('heading', { name: 'Welcome back' }),
        ).toBeInTheDocument();
    });

    it('opens the lobby from Online Play when logged out', async () => {
        const app = await renderApp();
        await openLanding(app);

        await app.user.click(
            app.screen.getByRole('button', { name: 'Online Play' }),
        );

        expect(
            await app.screen.findByRole('heading', { name: 'Ready to roll?' }),
        ).toBeInTheDocument();
    });

    it('does nothing for Local Play and Terms & Conditions', async () => {
        const app = await renderApp();
        await openLanding(app);

        await app.user.click(
            app.screen.getByRole('button', { name: 'Local Play' }),
        );
        await app.user.click(
            app.screen.getByRole('button', { name: 'Terms & Conditions' }),
        );

        expect(
            app.screen.getByRole('heading', { name: 'Tank It!' }),
        ).toBeInTheDocument();
    });

    it('shows the signed-in user and opens the lobby', async () => {
        seedSession();
        const app = await renderApp();
        await openLanding(app);

        expect(app.screen.getByText('gabriel')).toBeInTheDocument();
        expect(
            app.screen.getByRole('button', { name: 'Logout' }),
        ).toBeInTheDocument();
        expect(app.screen.queryByRole('button', { name: 'Login' })).toBeNull();

        await app.user.click(
            app.screen.getByRole('button', { name: 'Online Play' }),
        );

        expect(
            await app.screen.findByRole('heading', { name: 'Ready to roll?' }),
        ).toBeInTheDocument();
    });

    it('logs out back to the guest landing', async () => {
        seedSession();
        const app = await renderApp();
        await openLanding(app);

        await app.user.click(
            app.screen.getByRole('button', { name: 'Logout' }),
        );

        expect(await app.screen.findByText('Guest')).toBeInTheDocument();
        expect(localStorage.getItem('tankit.accessToken')).toBeNull();
        expect(localStorage.getItem('tankit.refreshToken')).toBeNull();
        expect(localStorage.getItem('tankit.user')).toBeNull();
    });
});
