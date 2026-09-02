import { Scene } from 'phaser'
import { GameHubConnection } from '../../net/GameHubConnection'
import { GameEvent } from '../config/events'
import { sessionConfig } from '../../net/sessionConfig'
import type { TankMovePayload, TankMovedPayload } from '../../net/contracts'

export class NetworkManager {
  private scene: Scene
  private hub: GameHubConnection

  constructor(scene: Scene) {
    this.scene = scene
    this.hub = new GameHubConnection(sessionConfig.hubUrl)
    this.hub.onTankMoved(this.handleTankMoved)
    this.scene.events.on(GameEvent.TankMove, this.handleLocalTankMove, this)
    this.hub.start().then(() => this.hub.joinRoom(sessionConfig.roomId))
      .catch(err => console.warn('[NetworkManager] connect/join failed', err))
  }

  private handleLocalTankMove = (payload: TankMovePayload) => this.hub.sendTankMove(payload)
  private handleTankMoved = (payload: TankMovedPayload) => this.scene.events.emit(GameEvent.TankMoved, payload)

  destroy() {
    this.scene.events.off(GameEvent.TankMove, this.handleLocalTankMove, this)
    this.hub.offTankMoved(this.handleTankMoved)
    this.hub.leaveRoom(sessionConfig.roomId).catch(() => { })
    this.hub.stop().catch(() => { })
  }
}
