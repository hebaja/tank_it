// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createRoot, render } = vi.hoisted(() => ({
    createRoot: vi.fn(),
    render: vi.fn(),
}));

vi.mock('react-dom/client', () => ({ createRoot }));
vi.mock('./App', () => ({ default: () => null }));

describe('app entry point', () => {
    beforeEach(() => {
        vi.resetModules();
        createRoot.mockReturnValue({ render });
        createRoot.mockClear();
        render.mockClear();
        document.body.innerHTML = '<div id="root"></div>';
    });

    it('mounts the app into the root element', async () => {
        const rootElement = document.getElementById('root');

        await import('./main.tsx');

        expect(createRoot).toHaveBeenCalledWith(rootElement);
        expect(render).toHaveBeenCalledOnce();
    });
});
