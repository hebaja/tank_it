import { Scene } from 'phaser'
import { GameHubConnection } from '../../net/GameHubConnection'
import { GameEvent } from '../config/events'
import { sessionConfig } from '../../net/sessionConfig'
import type { MatchEndPayload, RoomJoinedPayload, TankMovePayload, TankMovedPayload } from '../../net/contracts'

export class NetworkManager {
  private scene: Scene
  private hub: GameHubConnection
  public readonly ready: Promise<RoomJoinedPayload>

  constructor(scene: Scene) {
    this.scene = scene
    this.hub = new GameHubConnection(sessionConfig.hubUrl)
    this.hub.onTankMoved(this.handleTankMoved)
    this.scene.events.on(GameEvent.TankMove, this.handleLocalTankMove, this)
	this.scene.events.on(GameEvent.MatchEnd, this.handleMatchEnd, this)
    this.ready = this.hub.start()
	  .then(() => this.hub.joinRoom(sessionConfig.roomId, sessionConfig.localColor))
	  .then(dto => {
	    this.scene.events.emit(GameEvent.RoomJoined, dto)
	    return dto
	  })
	  .catch((err): never => { 
		console.warn('[NetworkManager] connect/join failed', err);
		throw err
	  })
  }

  private handleLocalTankMove = (payload: TankMovePayload) => this.hub.sendTankMove(payload)
  private handleTankMoved = (payload: TankMovedPayload) => this.scene.events.emit(GameEvent.TankMoved, payload)
  private handleMatchEnd = (payload: MatchEndPayload) => this.hub.sendMatchEnd(payload)

  destroy() {
    this.scene.events.off(GameEvent.TankMove, this.handleLocalTankMove, this)
    this.hub.offTankMoved(this.handleTankMoved)
    this.hub.leaveRoom(sessionConfig.roomId).catch(() => { })
    this.hub.stop().catch(() => { })
  }
}
