import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { cleanupApp } from './appHarness';

/**
 * The auth/lobby screens surface every failure as UI state instead of console
 * output (see frontend/app/README.md), so anything logged while a test runs
 * means something leaked — fail the test on it.
 */
let consoleErrors: unknown[][] = [];
let consoleWarnings: unknown[][] = [];

beforeEach(() => {
    consoleErrors = [];
    consoleWarnings = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
        consoleErrors.push(args);
    });
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
        consoleWarnings.push(args);
    });
});

afterEach(() => {
    cleanupApp();
    const errors = consoleErrors;
    const warnings = consoleWarnings;
    vi.restoreAllMocks();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    expect(errors, 'console.error was called while the test ran').toEqual([]);
    expect(warnings, 'console.warn was called while the test ran').toEqual([]);
});
