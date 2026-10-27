import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        host: '127.0.0.1',
        port: 4173,
        proxy: {
            '/mock-hub': {
                target: 'http://127.0.0.1:18080',
                changeOrigin: true,
                ws: true,
                rewrite: (path) => path.replace(/^\/mock-hub/, '/hubs/game'),
            },
        },
    },
});
