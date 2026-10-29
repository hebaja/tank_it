import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    testMatch: '**/*.e2e.ts',
    fullyParallel: true,
    reporter: 'list',
    use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4173',
    },
    webServer: [
        {
            command:
                'dotnet run --project backend/src/TankIt.Api/TankIt.Api.csproj --no-launch-profile',
            cwd: '../..',
            url: 'http://127.0.0.1:18080/health',
            reuseExistingServer: false,
            timeout: 120_000,
            env: {
                ASPNETCORE_ENVIRONMENT: 'Development',
                ASPNETCORE_URLS: 'http://127.0.0.1:18080',
                JWT_SIGNING_KEY:
                    'tankit-e2e-signing-key-that-is-at-least-32-bytes',
                ConnectionStrings__Default:
                    'Host=localhost;Port=5432;Database=tankit;Username=tankit;Password=tankit_dev',
                FrontendOrigin: 'http://127.0.0.1:4173,http://127.0.0.1:4174',
                Logging__LogLevel__Default: 'Warning',
            },
        },
        {
            command: 'yarn vite --config vite.config.e2e.mjs',
            cwd: '.',
            url: 'http://127.0.0.1:4173',
            reuseExistingServer: false,
            env: {
                VITE_HUB_URL: 'http://127.0.0.1:4173/mock-hub',
                VITE_GAME_URL: 'http://127.0.0.1:4174',
            },
        },
        {
            command:
                'yarn vite --config vite/config.dev.mjs --host 127.0.0.1 --port 4174',
            cwd: '../game',
            url: 'http://127.0.0.1:4174',
            reuseExistingServer: false,
            env: {
                VITE_HUB_URL: 'http://127.0.0.1:18080/hubs/game',
            },
        },
    ],
});
