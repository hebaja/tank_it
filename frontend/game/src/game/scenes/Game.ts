import { Scene, Scenes, Tilemaps } from 'phaser'
import { Tank } from '../objects/Tank'
import { Projectile } from '../objects/Projectile'
import { ExplosionManager } from '../managers/ExplosionManager'
import { Barrel } from '../objects/Barrel'
import { AmmoGauge } from '../objects/AmmoGauge'
import { DeathWallManager } from '../managers/DeathWallManager'
import { MatchManager } from '../managers/MatchManager'
import { SpeedSystem } from '../systems/SpeedSystem'
import { GAME_CONFIG } from '../config/game'
import { GameEvent } from '../config/events'
import { NetworkManager } from '../managers/NetworkManager'
import { sessionConfig } from '../../net/sessionConfig'
import type { Position, BlockDestroyPayload, RoomJoinedPayload, TankMovedPayload, DeathWallStepPayload, BarrelDestroyPayload, TankDestroyPayload } from '../../net/contracts'
import { SoundManager } from '../managers/SoundManager'

export class Game extends Scene {
  barrelGroup: Phaser.Physics.Arcade.Group
  tankGroup: Phaser.Physics.Arcade.Group
  projectileGroup: Phaser.Physics.Arcade.Group
  matchManager: MatchManager
  speedSystem: SpeedSystem
  private explosionManager: ExplosionManager
  private deathWallManager: DeathWallManager
  private networkManager: NetworkManager
  private soundManager: SoundManager
  private tankRoster: Map<string, Tank>
  private roomId: string
  private roomCreatedAt: number
  private barrelPos: Position[] = []
  private map: Tilemaps.Tilemap
  private blocksLayer: Tilemaps.TilemapLayer | Tilemaps.TilemapGPULayer
  private blocksHardLayer: Tilemaps.TilemapLayer | Tilemaps.TilemapGPULayer
  private isShuttingDown: boolean = false
  private matchStartedAt?: number

  constructor() {
    super('Game')
  }

  init(data: { matchStartedAt?: number}) {
	  this.matchStartedAt = data?.matchStartedAt
	  this.isShuttingDown = false
  }

  preload() {
    this.load.setPath('assets')
    this.load.tilemapTiledJSON('level', 'map/tanks_map.json')
    this.load.image('main_tileset', 'map/main_tileset.png')
	this.load.font('press-start-2p-regular','fonts/PressStart2P-Regular.ttf')

    Tank.preload(this)
    Projectile.preload(this)
    ExplosionManager.preload(this)
    Barrel.preload(this)
    SpeedSystem.preload(this)
    AmmoGauge.preload(this)
	SoundManager.preload(this)
  }

  create() {
    const { map, tanksSpawnLayer } = this.createMap()
	this.map = map
	this.createGroups()
    this.initTanks(tanksSpawnLayer)
    this.createManagers()
    this.createCollisions()
    this.registerSceneEvents()

    this.events.on(GameEvent.TankMoved, this.handleTankMoved, this)
	this.events.on(GameEvent.RoomJoined, this.handleRoomJoined, this)
	this.events.on(GameEvent.MatchStarted, this.handleMatchStarted, this)
	this.events.on(GameEvent.DeathWallStep, this.handleDeathWallStep, this)
	this.events.on(GameEvent.BlockDestroyed, this.handleBlockDestroyed, this)
	this.events.on(GameEvent.BarrelDestroyed, this.handleBarrelDestroyed, this)
	this.events.on(GameEvent.TankDestroyed, this.handleTankDestroyed, this)
    this.networkManager = new NetworkManager(this)

	//TODO remove it at the end of championship ui implementation
	this.scene.launch('Overlay')
  }

  private createMap() {
    const map = this.make.tilemap({ key: 'level' })

    if (!map)
      throw new Error('Map could not be initialized')

    const HORIZONTAL_MARGIN = (this.scale.width - map.widthInPixels) / 2

    this.cameras.main.setScroll(-HORIZONTAL_MARGIN, 0)
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels)

    const terrainTileset = map.addTilesetImage('main_tileset', 'main_tileset')
    const blocksTileset = map.addTilesetImage('main_tileset', 'main_tileset')
    const blocksHardTileset = map.addTilesetImage('main_tileset', 'main_tileset')

    if (!terrainTileset || !blocksTileset || !blocksHardTileset)
      throw new Error("Tileset not found")

    const backgroundLayer = map.createLayer('background', [terrainTileset])
    this.blocksLayer = map.createLayer('blocks', [blocksTileset])
    this.blocksHardLayer = map.createLayer('blocks_hard', [blocksHardTileset])
	const tanksSpawnLayer = map.getObjectLayer('tanks_spawn')

    backgroundLayer.depth = GAME_CONFIG.depth.background
    this.blocksLayer.depth = GAME_CONFIG.depth.blocks
    this.blocksHardLayer.depth = GAME_CONFIG.depth.blocks

    this.blocksLayer.setCollisionByExclusion([-1])
    this.blocksHardLayer.setCollisionByExclusion([-1])

    return { map, tanksSpawnLayer }
  }

  private createManagers() {
    this.matchManager = new MatchManager(this)
    this.matchManager.reset()
    this.explosionManager = new ExplosionManager(this)
    this.speedSystem = new SpeedSystem(this, this.tankGroup)
	this.soundManager = new SoundManager(this)
  }

  private createBarrels(map: Tilemaps.Tilemap) {
	this.barrelGroup.clear(true, true)

    const barrels = Barrel.generateRandomBarrels(this, this.barrelPos, map)
    for (let i = 0; i < barrels.length; i++)
      this.barrelGroup.add(barrels[i])

    this.barrelGroup.children.forEach((child) => (child as Barrel).setImmovable(true))
  }

   private createGroups() {
    this.projectileGroup = this.physics.add.group()
    this.barrelGroup = this.physics.add.group()
    this.tankGroup = this.physics.add.group()
  }

  private createCollisions() {
    this.registerPassiveColliders()
    this.registerActiveColliders()
  }

  private registerPassiveColliders() {
    this.physics.add.collider(this.tankGroup, this.blocksLayer)
    this.physics.add.collider(this.tankGroup, this.blocksHardLayer)
    this.physics.add.collider(this.tankGroup, this.tankGroup)
    this.physics.add.collider(this.tankGroup, this.barrelGroup)
  }

  private registerActiveColliders() {
    this.physics.add.collider(this.projectileGroup, this.blocksLayer,
      (p, b) => {
        const proj = p as Projectile
        const tile = b as Phaser.Tilemaps.Tile
		
		this.events.emit(GameEvent.BlockDestroy, {
			roomId: sessionConfig.roomId,
			tileX: tile.x,
			tileY: tile.y,
			position: {
				x: tile.getCenterX(),
				y: tile.getCenterY()
			}
		})

		this.destroyBlock(tile.getCenterX(), tile.getCenterY(), tile.x, tile.y)
        proj.destroy()
      })

    this.physics.add.collider(this.projectileGroup, this.blocksHardLayer,
      (p) => {
        const proj = p as Projectile
        this.events.emit(GameEvent.ExplosionSmoke, {
          x: proj.x,
          y: proj.y,
          type: 'explosion_smoke',
        })
        proj.destroy()
      })

    this.physics.add.collider(this.projectileGroup, this.barrelGroup,
      (p, b) => {
        const proj = p as Projectile
        const barrel = b as Barrel

		this.events.emit(GameEvent.BarrelDestroy, {
			roomId: sessionConfig.roomId,
			index: barrel.getIndex()
		})
		this.destroyBarrel(barrel)
        proj.destroy()
      })

    this.physics.add.collider(this.projectileGroup, this.tankGroup,
      (p, t) => {
        const proj = p as Projectile
        const tank = t as Tank
        if (proj.owner === tank) return
        proj.destroy()
		this.events.emit(GameEvent.TankDestroy, {
		  roomId: sessionConfig.roomId,
		  color: tank.getColor(),
		  x: tank.x,
		  y: tank.y
		})
		this.destroyTank(tank)
      })

    this.physics.add.collider(this.projectileGroup, this.projectileGroup,
      (p1, p2) => {
        const proj1 = p1 as Projectile
        const proj2 = p2 as Projectile
        if (!proj1.active || !proj2.active) return
        this.events.emit(GameEvent.Explosion, {
          x: (proj1.x + proj2.x) / 2,
          y: (proj1.y + proj2.y) / 2,
          type: 'explosion',
        })
		this.events.emit(GameEvent.ProjectileHitProjectile)
        proj1.destroy()
        proj2.destroy()
      })
  }

  private destroyBlock(x: number, y: number, tileX: number, tileY: number) {
	this.events.emit(GameEvent.Explosion, {
	  x: x,
	  y: y,
	  type: 'explosion',
	})
	this.blocksLayer.removeTileAt(tileX, tileY)
  }

  private destroyBarrel(barrel: Barrel) {
	this.events.emit(GameEvent.Explosion, {
		x: barrel.x,
		y: barrel.y,
		type: 'explosion',
	})
	barrel.destroy()
	this.time.delayedCall(GAME_CONFIG.timing.oilSpawnDelay, () => {
		this.speedSystem.addOil(barrel.x, barrel.y)
	})
  }

  private destroyTank(tank: Tank) {
	tank.destroy()
	this.events.emit(GameEvent.Explosion, {
		x: tank.x,
		y: tank.y,
		type: 'explosion',
	})
	this.matchManager.recordPlacement(tank)
  }

  private registerSceneEvents() {
    this.events.once(Scenes.Events.SHUTDOWN, this.shutdown, this)
    // this.events.on
    this.events.on(GameEvent.TileDestroy, (tile: Tilemaps.Tile) => {
      this.tankGroup.getChildren().forEach(t => {
        const tank: Tank = t as Tank
        const body = tank.body
        if (!body) return
        if (tile.intersects(body.left, body.top, body.right, body.bottom)) {
          this.events.emit(GameEvent.Explosion, {
            x: tank.x,
            y: tank.y,
            type: GameEvent.Explosion,
          })
          this.matchManager.recordPlacement(tank)
          tank.destroy()
        }
      })
    })
  }

  update() {
    const winner = this.tankGroup.getLength() === 1
      ? this.tankGroup.getChildren().find(t => (t as Tank).getColor()) as Tank | undefined
      : undefined

    this.matchManager.checkEnd(this.tankGroup.getLength(), winner)
  }

  shutdown() {
	this.isShuttingDown = true
    this.explosionManager.destroy()
    this.deathWallManager?.destroy()
    this.matchManager.destroy()
    this.speedSystem.destroy()
    this.events.off(GameEvent.TileDestroy)
    this.networkManager.destroy()
	this.soundManager.destroy()
    this.events.off(GameEvent.TankMoved, this.handleTankMoved, this)
	this.events.off(GameEvent.RoomJoined, this.handleRoomJoined, this)
	this.events.off(GameEvent.MatchStarted, this.handleMatchStarted, this)
	this.events.off(GameEvent.DeathWallStep, this.handleDeathWallStep, this)
	this.events.off(GameEvent.BlockDestroyed, this.handleBlockDestroyed, this)
	this.events.off(GameEvent.BarrelDestroyed, this.handleBarrelDestroyed, this)
	this.events.off(GameEvent.TankDestroyed, this.handleTankDestroyed, this)
  }

  initTanks(tanksSpawnLayer: Tilemaps.ObjectLayer | null) {
    this.tankRoster = new Map()

    tanksSpawnLayer?.objects.forEach(obj => {
      const color = obj.properties.find((e: any) => e.name === 'type_color').value
      const angle = obj.properties.find((e: any) => e.name === 'angle').value
      const isLocal = color === sessionConfig.localColor
      const tank = new Tank(this, obj.x ?? 0, obj.y ?? 0, angle, color, this.tankGroup, this.projectileGroup, isLocal)
      this.tankRoster.set(color, tank)
    })
  }

  private handleTankMoved = (payload: TankMovedPayload) =>
    this.tankRoster.get(payload.playerId)?.receiveRemoteState(payload)

  private handleRoomJoined = (payload: RoomJoinedPayload) => {
    this.roomId = payload.roomId
    this.barrelPos = payload.randomBarrelPositions
    this.roomCreatedAt = payload.roomCreatedAt

    console.log(payload)

    if (this.map) {
      this.createBarrels(this.map)
      this.deathWallManager = new DeathWallManager(this, this.map, this.tankGroup, payload.deathWallStep)
    }
  }

  private handleMatchStarted = (payload: { roomId: string; randomBarrelPositions: Position[] }) => {
    if (this.isShuttingDown) return

    this.isShuttingDown = true
    this.scene.stop('Overlay')
    this.scene.restart({ matchStartedAt: Date.now()})
  }

  private handleDeathWallStep = (p: DeathWallStepPayload) => this.deathWallManager?.applyStep(p.step)

  private handleBlockDestroyed = (payload: BlockDestroyPayload) => {
	  this.destroyBlock(payload.position.x, payload.position.y, payload.tileX, payload.tileY)
  }

  private handleBarrelDestroyed = (payload: BarrelDestroyPayload) => {
	const barrel = this.barrelGroup
	  .getChildren()
	  .find(c => (c as Barrel).getIndex() === payload.index) as Barrel | undefined
	if (!barrel) return
    this.destroyBarrel(barrel)
  }

  private handleTankDestroyed = (payload: TankDestroyPayload) => {
	const tank = this.tankGroup
	  .getChildren()
	  .find(c => (c as Tank).getColor() === payload.color) as Tank | undefined
	if (!tank) return
	this.destroyTank(tank)
  }
}
