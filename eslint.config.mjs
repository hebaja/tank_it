import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig([
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            'frontend/**/public/assets/**',
        ],
    },
    {
        files: ['frontend/{app,game}/src/**/*.{js,jsx,ts,tsx}'],
        extends: [js.configs.recommended, tseslint.configs.recommended],
        languageOptions: {
            globals: globals.browser,
        },
    },
    {
        files: [
            'frontend/app/e2e/**/*.ts',
            'frontend/app/playwright.config.ts',
        ],
        extends: [js.configs.recommended, tseslint.configs.recommended],
        languageOptions: {
            globals: globals.node,
        },
    },
    {
        files: [
            'frontend/app/vite.config.mjs',
            'frontend/app/vite.config.e2e.mjs',
            'frontend/game/vite/**/*.mjs',
            'frontend/game/log.js',
        ],
        extends: [js.configs.recommended],
        languageOptions: {
            globals: globals.node,
        },
    },
]);
