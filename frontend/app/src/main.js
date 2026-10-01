const GAME_URL = import.meta.env.VITE_GAME_URL ?? 'http://localhost:5173';
document.querySelector('#play-btn')?.addEventListener('click', () => {
    window.location.href = GAME_URL;
});
export {};
