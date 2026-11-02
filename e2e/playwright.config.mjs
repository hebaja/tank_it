import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const FRONTEND_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8080';
const GAME_URL = process.env.E2E_GAME_URL ?? 'http://localhost:5173';

/**
 * Local-only suite: `make test-e2e` brings the compose dev stack up first and
 * these web servers only start when nothing is listening on the URL yet, so an
 * already running stack (or a natively started one) is simply reused.
 */
export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: 0,
    reporter: [['list'], ['html', { open: 'never' }]],
    expect: {
        timeout: 10_000,
    },
    use: {
        baseURL: FRONTEND_URL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: [
        {
            command: 'yarn dev',
            cwd: `${repoRoot}/frontend/app`,
            url: FRONTEND_URL,
            reuseExistingServer: true,
            timeout: 120_000,
        },
        {
            command: `dotnet run --project "${repoRoot}/backend/src/TankIt.Api" --configuration Release`,
            url: `${API_URL}/health`,
            reuseExistingServer: true,
            timeout: 180_000,
            env: {
                ...process.env,
                ASPNETCORE_ENVIRONMENT: 'Development',
                ConnectionStrings__Default:
                    process.env.ConnectionStrings__Default ??
                    'Host=localhost;Port=5432;Database=tankit;Username=tankit;Password=tankit_dev',
                JWT_SIGNING_KEY:
                    process.env.JWT_SIGNING_KEY ??
                    'local-e2e-only-signing-key-0123456789abcdef',
            },
        },
        {
            command: 'yarn dev-nolog --port 5173 --strictPort',
            cwd: `${repoRoot}/frontend/game`,
            url: GAME_URL,
            reuseExistingServer: true,
            timeout: 120_000,
        },
    ],
});
