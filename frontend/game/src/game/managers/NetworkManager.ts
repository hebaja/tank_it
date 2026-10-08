import { Scene } from 'phaser'
import { GameHubConnection } from '../../net/GameHubConnection'
import { GameEvent } from '../config/events'
import { sessionConfig } from '../../net/sessionConfig'
import type { BlockDestroyPayload, DeathWallStepPayload, MatchEndPayload, MatchStartedPayload, RoomJoinedPayload, TankMovePayload, TankMovedPayload } from '../../net/contracts'

export class NetworkManager {
  private scene: Scene
  private hub: GameHubConnection
  public readonly ready: Promise<RoomJoinedPayload>

  constructor(scene: Scene) {
    this.scene = scene
    this.hub = new GameHubConnection(sessionConfig.hubUrl)
    this.hub.onTankMoved(this.handleTankMoved)
	  this.hub.onMatchStarted(this.handleMatchStarted)
	  this.hub.onDeathWallStep(this.handleDeathWallStep)
	  this.hub.onBlockDestroyed(this.handleBlockDestroyed)
    this.scene.events.on(GameEvent.TankMove, this.handleLocalTankMove, this)
	  this.scene.events.on(GameEvent.MatchEnd, this.handleMatchEnd, this)
	  this.scene.events.on(GameEvent.MatchRestartRequested, this.handleRestartRequested, this)
    this.scene.events.on(GameEvent.TankMove, this.handleLocalTankMove, this)
	  this.scene.events.on(GameEvent.BlockDestroy, this.handleBlockDestroy, this)
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
  private handleMatchStarted = (payload: MatchStartedPayload) => this.scene.events.emit(GameEvent.MatchStarted, payload)
  private handleRestartRequested = () => { this.hub.sendStartMatch(sessionConfig.roomId)}
  private handleDeathWallStep = (p: DeathWallStepPayload) => this.scene.events.emit(GameEvent.DeathWallStep, p)
  private handleBlockDestroy = (payload: BlockDestroyPayload) => this.hub.sendBlockDestroy(payload)
  private handleBlockDestroyed = (payload: BlockDestroyPayload) => this.scene.events.emit(GameEvent.BlockDestroyed, payload)

  destroy() {
	this.scene.events.off(GameEvent.TankMove, this.handleLocalTankMove, this)
    this.scene.events.off(GameEvent.MatchEnd, this.handleMatchEnd, this)
    this.scene.events.off(GameEvent.MatchRestartRequested, this.handleRestartRequested, this)
    this.hub.offTankMoved(this.handleTankMoved)
    this.hub.offMatchStarted(this.handleMatchStarted)
	  this.hub.offDeathWallStep(this.handleDeathWallStep)
    this.hub.leaveRoom(sessionConfig.roomId).catch(() => { })
    this.hub.stop().catch(() => { })
  }
}
