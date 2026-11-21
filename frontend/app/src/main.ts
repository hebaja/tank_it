import { LobbyHubConnection } from './net/LobbyHubConnection';
import type {
    GameMode,
    PlayerJoinedPayload,
    PlayerLeftPayload,
} from './net/contracts';

const HUB_URL =
    import.meta.env.VITE_HUB_URL ?? 'http://localhost:8080/hubs/game';

const joinForm = document.getElementById('join-form') as HTMLElement;
const roomBox = document.getElementById('room-box') as HTMLElement;
const roomIdInput = document.getElementById('room-id') as HTMLInputElement;
const colorSelect = document.getElementById('color') as HTMLSelectElement;
const joinBtn = document.getElementById('join-btn') as HTMLButtonElement;
const leaveBtn = document.getElementById('leave-btn') as HTMLButtonElement;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const roomIdDisplay = document.getElementById('room-id-display') as HTMLElement;
const playerList = document.getElementById('player-list') as HTMLUListElement;
const errorEl = document.getElementById('error') as HTMLElement;
const modeDisplay = document.getElementById('mode-display') as HTMLElement;

let hub: LobbyHubConnection | null = null;
let currentRoomId = '';
let currentColor = '';
const params = new URLSearchParams(window.location.search);
const initialRoomId = params.get('roomId');
const initialColor = params.get('color');

const initialMode: GameMode =
    params.get('mode') === 'championship' ? 'championship' : 'single';

let currentMode: GameMode = initialMode;

const modeInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[name="mode"]'),
);

function formatMode(mode: GameMode): string {
    return mode === 'championship' ? 'Championship' : 'Single match';
}

function setMode(mode: GameMode) {
    currentMode = mode;
    for (const input of modeInputs) {
        input.checked = input.value === mode;
    }
}

function setModeLocked(locked: boolean) {
    for (const input of modeInputs) {
        input.disabled = locked;
    }
}

setMode(initialMode);

if (initialRoomId) roomIdInput.value = initialRoomId;

if (
    initialColor &&
    Array.from(colorSelect.options).some((o) => o.value === initialColor)
)
    colorSelect.value = initialColor;

let myConnectionId = '';
let championshipId = '';

// One lobby row per color. A color can briefly have both a dying game
// connection and a new lobby connection during the redirect handoff.
const colorConnections = new Map<string, Set<string>>();
const connectionColors = new Map<string, string>();

function showError(msg: string) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
}

function clearError() {
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
}

function addPlayer(connectionId: string, color: string) {
    if (!connectionId) return;

    const previousColor = connectionColors.get(connectionId);
    if (previousColor && previousColor !== color) {
        colorConnections.get(previousColor)?.delete(connectionId);
        if (colorConnections.get(previousColor)?.size === 0) {
            colorConnections.delete(previousColor);
        }
    }

    connectionColors.set(connectionId, color);
    const connections = colorConnections.get(color) ?? new Set<string>();
    connections.add(connectionId);
    colorConnections.set(color, connections);
}

function removePlayer(connectionId: string) {
    const color = connectionColors.get(connectionId);
    if (!color) return;

    connectionColors.delete(connectionId);
    const connections = colorConnections.get(color);
    connections?.delete(connectionId);
    if (!connections || connections.size === 0) {
        colorConnections.delete(color);
    }
}

function renderPlayers() {
    playerList.innerHTML = '';
    for (const [color, connections] of colorConnections) {
        const li = document.createElement('li');
        li.dataset.color = color;
        const swatch = document.createElement('span');
        swatch.className = `color-swatch ${color}`;
        const name = document.createElement('span');
        name.className = 'player-name';
        name.textContent = color.charAt(0).toUpperCase() + color.slice(1);
        li.append(swatch, name);
        if (connections.has(myConnectionId)) {
            const you = document.createElement('span');
            you.className = 'player-you';
            you.textContent = ' (you)';
            li.append(you);
        }
        playerList.append(li);
    }
}

async function joinRoom() {
    clearError();
    const roomId = roomIdInput.value.trim() || 'local-dev-room';
    const color = colorSelect.value;
    const mode = currentMode;

    joinBtn.disabled = true;
    joinBtn.textContent = 'Joining…';

    try {
        hub = new LobbyHubConnection(HUB_URL);
        await hub.start();

        const status = await hub.joinRoom(roomId, color, mode);

        currentRoomId = roomId;
        currentColor = color;
        currentMode = status.mode;
        championshipId = status.championshipId;

        setMode(status.mode);
        setModeLocked(true);
        modeDisplay.textContent = formatMode(status.mode);

        myConnectionId =
            status.connectionId ||
            status.players.find((p) => p.color === color)?.connectionId ||
            '';

        colorConnections.clear();
        connectionColors.clear();
        for (const player of status.players) {
            addPlayer(player.connectionId, player.color);
        }

        // Subscribe to live updates
        hub.onPlayerJoined(handlePlayerJoined);
        hub.onPlayerLeft(handlePlayerLeft);
        hub.onMatchStarted(handleMatchStarted);

        // UI switch
        joinForm.classList.add('hidden');
        roomBox.classList.remove('hidden');
        startBtn.classList.remove('hidden');
        roomIdDisplay.textContent = status.roomId;
        renderPlayers();

        joinBtn.disabled = false;
        joinBtn.textContent = 'Join';
    } catch (err) {
        console.error('[Lobby] Join failed:', err);
        showError(
            `Failed to join: ${err instanceof Error ? err.message : String(err)}`,
        );
        joinBtn.disabled = false;
        joinBtn.textContent = 'Join';
        if (hub) {
            await hub.stop().catch(() => {});
            hub = null;
        }
    }
}

function handlePlayerJoined(payload: PlayerJoinedPayload) {
    addPlayer(payload.connectionId, payload.color);
    renderPlayers();
}

function handlePlayerLeft(payload: PlayerLeftPayload) {
    removePlayer(payload.connectionId);
    renderPlayers();
}

async function leaveRoom() {
    if (!hub || !currentRoomId) return;
    try {
        await hub.leaveRoom(currentRoomId, championshipId);
    } catch (err) {
        console.warn('[Lobby] Leave failed:', err);
    } finally {
        hub.offPlayerJoined(handlePlayerJoined);
        hub.offPlayerLeft(handlePlayerLeft);
        hub.offMatchStarted(handleMatchStarted);
        await hub.stop().catch(() => {});
        hub = null;
        currentRoomId = '';
        currentColor = '';
        currentMode = initialMode;
        myConnectionId = '';
        setMode(initialMode);
        setModeLocked(false);
        modeDisplay.textContent = '';
        colorConnections.clear();
        connectionColors.clear();
        roomBox.classList.add('hidden');
        startBtn.classList.add('hidden');
        joinForm.classList.remove('hidden');
        playerList.innerHTML = '';
    }
}

function startMatch() {
    if (!currentRoomId || !currentColor || !hub) return;
    hub.startMatch(currentRoomId, championshipId).catch((err) => {
        console.error('[Lobby] startGame invoke failed:', err);
        showError('Failed to start game');
    });
}

function redirectToGame() {
    if (!currentRoomId || !currentColor) return;
    const gameUrl = import.meta.env.VITE_GAME_URL ?? 'http://localhost:5173';
    const url = `${gameUrl}?roomId=${encodeURIComponent(currentRoomId)}&color=${encodeURIComponent(currentColor)}&champId=${encodeURIComponent(championshipId)}&mode=${encodeURIComponent(currentMode)}`;

    if (hub) {
        hub.offPlayerJoined(handlePlayerJoined);
        hub.offPlayerLeft(handlePlayerLeft);
        hub.offMatchStarted(handleMatchStarted);
        hub.stop().catch(() => {});
        hub = null;
    }
    window.location.href = url;
}

function handleMatchStarted() {
    redirectToGame();
}

// Event listeners
joinBtn.addEventListener('click', joinRoom);
leaveBtn.addEventListener('click', leaveRoom);
startBtn.addEventListener('click', startMatch);

for (const input of modeInputs) {
    input.addEventListener('change', () => {
        if (input.checked) currentMode = input.value as GameMode;
    });
}

// Enter key in inputs triggers join
roomIdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinRoom();
});
colorSelect.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinRoom();
});

// Returning from a finished championship: room/color came from the game URL,
// so the player only needs to press "Start Game".
if (initialRoomId) {
    void joinRoom();
}
