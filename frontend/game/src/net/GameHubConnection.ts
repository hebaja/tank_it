import * as signalR from '@microsoft/signalr'
import type { TankMovePayload, TankMovedPayload } from './contracts'

const DEFAULT_HUB_URL = 'http://100.65.10.225:8080/hubs/game'

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

  async joinRoom(roomId: string): Promise<void> { await this.conn.invoke('JoinRoom', roomId) }
  async leaveRoom(roomId: string): Promise<void> { await this.conn.invoke('LeaveRoom', roomId) }

  sendTankMove(payload: TankMovePayload): void {
    if (this.conn.state !== signalR.HubConnectionState.Connected) return
    this.conn.send('TankMove', payload).catch(err => console.warn('[GameHubConnection] TankMove send failed', err))
  }

  onTankMoved(cb: (p: TankMovedPayload) => void): void { this.conn.on('TankMoved', cb) }
  offTankMoved(cb: (p: TankMovedPayload) => void): void { this.conn.off('TankMoved', cb) }

  get state(): signalR.HubConnectionState { return this.conn.state }
}
