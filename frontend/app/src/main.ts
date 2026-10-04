import { LobbyHubConnection } from './net/LobbyHubConnection'
import type { GameStartedPayload, PlayerJoinedPayload, PlayerLeftPayload, PlayerInfo } from './net/contracts'

const HUB_URL = import.meta.env.VITE_HUB_URL ?? 'http://localhost:8080/hubs/game'

const joinForm = document.getElementById('join-form') as HTMLElement
const roomBox = document.getElementById('room-box') as HTMLElement
const roomIdInput = document.getElementById('room-id') as HTMLInputElement
const colorSelect = document.getElementById('color') as HTMLSelectElement
const joinBtn = document.getElementById('join-btn') as HTMLButtonElement
const leaveBtn = document.getElementById('leave-btn') as HTMLButtonElement
const startBtn = document.getElementById('start-btn') as HTMLButtonElement
const roomIdDisplay = document.getElementById('room-id-display') as HTMLElement
const playerList = document.getElementById('player-list') as HTMLUListElement
const errorEl = document.getElementById('error') as HTMLElement

let hub: LobbyHubConnection | null = null;
let currentRoomId = ''
let currentColor = ''
let myConnectionId = ''

function showError(msg: string) {
    errorEl.textContent = msg
    errorEl.classList.remove('hidden')
}

function clearError() {
    errorEl.classList.add('hidden')
    errorEl.textContent = ''
}

function renderPlayers(players: PlayerInfo[], meId: string) {
    playerList.innerHTML = ''
    for (const p of players) {
        const li = document.createElement('li')
        const swatch = document.createElement('span')
        swatch.className = `color-swatch ${p.color}`
        const name = document.createElement('span')
        name.className = 'player-name'
        name.textContent = p.color.charAt(0).toUpperCase() + p.color.slice(1)
        li.append(swatch, name)
        if (p.connectionId === meId) {
            const you = document.createElement('span')
            you.className = 'player-you'
            you.textContent = ' (you)'
            li.append(you)
        }
        playerList.append(li)
    }
}

async function joinRoom() {
    clearError();
    const roomId = roomIdInput.value.trim() || 'local-dev-room'
    const color = colorSelect.value

    joinBtn.disabled = true
    joinBtn.textContent = 'Joining…'

    try {
        hub = new LobbyHubConnection(HUB_URL)
        await hub.start()

        const status = await hub.joinRoom(roomId, color)

        currentRoomId = roomId
        currentColor = color
        myConnectionId = status.players.find(p => p.color === color && p.connectionId)?.connectionId ?? ''

        // Store connectionId from the returned players list (the one matching our color)
        // If not found (race), fallback: we'll get it from PlayerJoined event
        if (!myConnectionId && status.players.length > 0) {
            // The last added is likely us
            myConnectionId = status.players[status.players.length - 1].connectionId;
        }

        // Subscribe to live updates
        hub.onPlayerJoined(handlePlayerJoined)
        hub.onPlayerLeft(handlePlayerLeft)
		hub.onGameStarted(handleGameStarted)

        // UI switch
        joinForm.classList.add('hidden')
        roomBox.classList.remove('hidden')
		startBtn.classList.remove('hidden')
        roomIdDisplay.textContent = status.roomId
        renderPlayers(status.players, myConnectionId)

        joinBtn.disabled = false
        joinBtn.textContent = 'Join'
    } catch (err) {
        console.error('[Lobby] Join failed:', err)
        showError(`Failed to join: ${err instanceof Error ? err.message : String(err)}`)
        joinBtn.disabled = false;
        joinBtn.textContent = 'Join'
        if (hub) { await hub.stop().catch(() => {}); hub = null }
    }
}

function handlePlayerJoined(payload: PlayerJoinedPayload) {
    const existing = playerList.querySelector(`li[data-conn="${payload.connectionId}"]`)
    if (!existing) {
        const li = document.createElement('li')
        li.dataset.conn = payload.connectionId
        const swatch = document.createElement('span')
        swatch.className = `color-swatch ${payload.color}`
        const name = document.createElement('span')
        name.className = 'player-name'
        name.textContent = payload.color.charAt(0).toUpperCase() + payload.color.slice(1)
        li.append(swatch, name)
        if (payload.connectionId === myConnectionId) {
            const you = document.createElement('span')
            you.className = 'player-you'
            you.textContent = ' (you)'
            li.append(you)
        }
        playerList.append(li)
    }
}

function handlePlayerLeft(payload: PlayerLeftPayload) {
    const li = playerList.querySelector(`li[data-conn="${payload.connectionId}"]`)
    if (li) li.remove()
}

async function leaveRoom() {
    if (!hub || !currentRoomId) return
    try {
        await hub.leaveRoom(currentRoomId)
    } catch (err) {
        console.warn('[Lobby] Leave failed:', err)
    } finally {
        hub.offPlayerJoined(handlePlayerJoined)
        hub.offPlayerLeft(handlePlayerLeft)
		hub.offGameStarted(handleGameStarted)
        await hub.stop().catch(() => {})
        hub = null
        currentRoomId = ''
        currentColor = ''
        myConnectionId = ''
        roomBox.classList.add('hidden')
		startBtn.classList.add('hidden')
        joinForm.classList.remove('hidden')
        playerList.innerHTML = ''
    }
}

function startGame() {
	if (!currentRoomId || !currentColor || !hub) return
	hub.startGame(currentRoomId).catch(err => {
		console.error('[Lobby] startGame invoke failed:', err)
		showError('Failed to start game')
	})
}

function redirectToGame() {
	if (!currentRoomId || !currentColor) return
	const gameUrl = import.meta.env.VITE_GAME_URL ?? 'http://localhost:5173'
	const url = `${gameUrl}?roomId=${encodeURIComponent(currentRoomId)}&color=${encodeURIComponent(currentColor)}`
	
	if (hub) {
		hub.offPlayerJoined(handlePlayerJoined)
		hub.offPlayerLeft(handlePlayerLeft)
		hub.offGameStarted(handleGameStarted)
		hub.stop().catch(() => {})
		hub = null
	}
	window.location.href = url
}

function handleGameStarted(_payload: GameStartedPayload) {
	redirectToGame()
}

// Event listeners
joinBtn.addEventListener('click', joinRoom)
leaveBtn.addEventListener('click', leaveRoom)
startBtn.addEventListener('click', startGame)

// Enter key in inputs triggers join
roomIdInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });
colorSelect.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });
