import * as signalR from '@microsoft/signalr'
import { GameStartedPayload, PlayerJoinedPayload, PlayerLeftPayload, RoomStatusPayload } from './contracts'

const DEFAULT_HUB_URL = 'http://localhost:8080/hubs/game'

export class LobbyHubConnection {
	private conn: signalR.HubConnection
	private started: Promise<void> | null = null

	constructor(hubUrl: string = DEFAULT_HUB_URL) {
		this.conn = new signalR.HubConnectionBuilder()
			.withUrl(hubUrl)
			.withAutomaticReconnect()
			.build()
	}

	async start(): Promise<void> {
		if (!this.started) this.started = this.conn.start();
		return this.started;
	}

	async stop(): Promise<void> {
		this.started = null;
		await this.conn.stop();
	}

	async joinRoom(roomId: string, color: string): Promise<RoomStatusPayload> {
		return await this.conn.invoke<RoomStatusPayload>('JoinRoom', roomId, color);
	}

	async leaveRoom(roomId: string): Promise<void> {
		await this.conn.invoke('LeaveRoom', roomId);
	}

	async startGame(roomId: string): Promise<void> {
		await this.conn.invoke('StartGame', roomId)
	}

	onPlayerJoined(cb: (p: PlayerJoinedPayload) => void): void {
		this.conn.on('PlayerJoined', cb)
	}

	offPlayerJoined(cb: (p: PlayerJoinedPayload) => void): void {
		this.conn.off('PlayerJoined', cb)
	}

	onPlayerLeft(cb: (p: PlayerLeftPayload) => void): void {
		this.conn.on('PlayerLeft', cb)
	}

	offPlayerLeft(cb: (p: PlayerLeftPayload) => void): void {
		this.conn.off('PlayerLeft', cb)
	}

	onGameStarted(cb: (p: GameStartedPayload) => void): void {
		this.conn.on('GameStarted', cb)
	}

	offGameStarted(cb: (p: GameStartedPayload) => void): void {
		this.conn.off('GameStarted', cb)
	}

	get state(): signalR.HubConnectionState {
		return this.conn.state;
	}
}
