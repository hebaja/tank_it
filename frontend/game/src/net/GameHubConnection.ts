import * as signalR from '@microsoft/signalr'
import type { BlockDestroyPayload, DeathWallStepPayload, MatchEndPayload, MatchStartedPayload, RoomJoinedPayload, TankMovePayload, TankMovedPayload } from './contracts'

const DEFAULT_HUB_URL = 'http://localhost:8080/hubs/game'

export class GameHubConnection {
  private conn: signalR.HubConnection
  private started: Promise<void> | null = null

  constructor(hubUrl: string = DEFAULT_HUB_URL) {
    this.conn = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect()
      .build()
  }

  async start(): Promise<void> {
    if (!this.started) this.started = this.conn.start()
    return this.started
  }

  async stop(): Promise<void> {
    this.started = null
    await this.conn.stop()
  }

  async joinRoom(roomId: string, color: string): Promise<RoomJoinedPayload> {
	  return await this.conn.invoke<RoomJoinedPayload>('JoinRoom', roomId, color)
	}
  async leaveRoom(roomId: string): Promise<void> { await this.conn.invoke('LeaveRoom', roomId) }

  sendTankMove(payload: TankMovePayload): void {
    if (this.conn.state !== signalR.HubConnectionState.Connected) return
    this.conn.send('TankMove', payload).catch(err => console.warn('[GameHubConnection] TankMove send failed', err))
  }

  sendMatchEnd(payload: MatchEndPayload): void {
	if (this.conn.state !== signalR.HubConnectionState.Connected) return
	this.conn.send('MatchEnd', payload).catch(err => console.warn('[GameHubConnectio] MatchEnd send failed', err))
  }

  sendStartMatch(roomId: string): void {
    if (this.conn.state !== signalR.HubConnectionState.Connected) return
	  this.conn.send('StartMatch', roomId).catch(err => console.warn('[GameHubConnection] StartMatch send failed', err))
  }

  sendBlockDestroy(payload: BlockDestroyPayload): void {
	  if (this.conn.state !== signalR.HubConnectionState.Connected) return
	  this.conn.send('BlockDestroy', payload).catch(err => console.warn('[GameHubConnection] BlockDestroyed send failed', err))
  }

  onTankMoved(cb: (p: TankMovedPayload) => void): void { this.conn.on('TankMoved', cb) }
  offTankMoved(cb: (p: TankMovedPayload) => void): void { this.conn.off('TankMoved', cb) }
  onMatchStarted(cb: (p: MatchStartedPayload) => void): void { this.conn.on('MatchStarted', cb) }
  offMatchStarted(cb: (p: MatchStartedPayload) => void): void { this.conn.off('MatchStarted', cb) }
  onDeathWallStep(cb: (p: DeathWallStepPayload) => void): void { this.conn.on('DeathWallStep', cb) }
  offDeathWallStep(cb: (p: DeathWallStepPayload) => void): void { this.conn.off('DeathWallStep', cb) }
  onBlockDestroyed(cb: (p: BlockDestroyPayload) => void): void { this.conn.on('BlockDestroyed', cb) }
  offBlockDestroyed(cb: (p: BlockDestroyPayload) => void): void { this.conn.off('BlockDestroyed', cb) }

  get state(): signalR.HubConnectionState { return this.conn.state }
}
