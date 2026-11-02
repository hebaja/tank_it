import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        host: true,
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        restoreMocks: true,
        unstubGlobals: true,
        unstubEnvs: true,
        // First render per worker pays for jsdom + module transforms and can
        // take seconds on a cold cache; the 5s default flakes on busy runners.
        testTimeout: 20_000,
        hookTimeout: 20_000,
    },
});
