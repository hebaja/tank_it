import { Physics, Input, Scenes, Scene } from 'phaser'
import { Math as PhaserMath } from 'phaser'
import { Projectile } from './Projectile'
import { AmmoGauge } from './AmmoGauge'
import { Color } from '../config/color'
import { SPAWN_CORNERS, TANK_CONFIG } from '../config/layout'
import { GAME_CONFIG } from '../config/game'
import { GameEvent } from '../config/events'
import { sessionConfig } from '../../net/sessionConfig'
import { TankMovedPayload, TankMovePayload } from '../../net/contracts'

type TankControlsA = {
  A: Input.Keyboard.Key
  D: Input.Keyboard.Key
  W: Input.Keyboard.Key
  S: Input.Keyboard.Key
  J: Input.Keyboard.Key
}

/*
type TankControlsB = {
  left: Input.Keyboard.Key
  right: Input.Keyboard.Key
  up: Input.Keyboard.Key
  down: Input.Keyboard.Key
  enter: Input.Keyboard.Key
}
*/

type Pair = [x: number, y: number]

export class Tank extends Physics.Arcade.Sprite {
  private controlsA: TankControlsA
  // private controlsB: TankControlsB
  private keyboard: any
  private projectile: Projectile | null = null
  private ammoGauge: AmmoGauge
  private sparkShot?: Phaser.GameObjects.Sprite
  private speed: number = GAME_CONFIG.tank.speed
  private turnSpeed: number = GAME_CONFIG.tank.turnSpeed
  private isSlow: boolean = false
  private color: Color
  //private playerIndex: number
  private isLocal: boolean
  private projectileGroup: Phaser.Physics.Arcade.Group
  private lastSentAt = 0
  private lastSentX = 0
  private lastSentY = 0
  private lastSentAngle = 0
  private sequence = 0
  private static readonly SEND_INTERVAL_MS = 50
  private static readonly POS_EPSILON = 0.5
  private static readonly ANGLE_EPSILON = 0.5

  private pendingRemote?: { x: number; y: number; angle: number }


  static preload(scene: Scene) {
    scene.load.image(Color.blue, 'sprites/tank_blue.png')
    scene.load.image(Color.red, 'sprites/tank_red.png')
    scene.load.image(Color.green, 'sprites/tank_green.png')
    scene.load.image(Color.dark, 'sprites/tank_dark.png')
    scene.load.image('spark', 'sprites/shot_orange.png')
  }

  constructor(
    scene: Scene,
    x: number,
    y: number,
    color: Color,
    group: Phaser.Physics.Arcade.Group,
    projectileGroup: Phaser.Physics.Arcade.Group,
    isLocal: boolean
  ) {
    super(scene, x, y, color)
    this.keyboard = scene.input.keyboard
    if (!this.keyboard) {
      throw new Error('Keyboard plugin not available')
    }
    scene.physics.add.existing(this)
    scene.add.existing(this)
    group.add(this)
    scene.events.on(Scenes.Events.UPDATE, this.update, this)
    this.setCollideWorldBounds(true)
    this.depth = GAME_CONFIG.depth.tank
    this.color = color
    // this.playerIndex = index
    this.projectileGroup = projectileGroup
    this.isLocal = isLocal

    if (this.isLocal)
      this.controlsA = this.keyboard?.addKeys({
        A: Input.Keyboard.KeyCodes.A,
        D: Input.Keyboard.KeyCodes.D,
        W: Input.Keyboard.KeyCodes.W,
        S: Input.Keyboard.KeyCodes.S,
        J: Input.Keyboard.KeyCodes.J
      })
    /*
    if (this.playerIndex != 0)
      this.controlsB = this.keyboard?.addKeys({
        left: Input.Keyboard.KeyCodes.LEFT,
        right: Input.Keyboard.KeyCodes.RIGHT,
        up: Input.Keyboard.KeyCodes.UP,
        down: Input.Keyboard.KeyCodes.DOWN,
        enter: Input.Keyboard.KeyCodes.ENTER
      })
      */
    if (SPAWN_CORNERS[color] == 'top-left' || SPAWN_CORNERS[color] == 'top-right')
      this.angle = TANK_CONFIG.faceDown
    else
      this.angle = TANK_CONFIG.faceUp

    this.ammoGauge = new AmmoGauge(scene, color, SPAWN_CORNERS[color])
  }

  destroy(fromScene?: boolean): void {
    this.scene?.events.off(Scenes.Events.UPDATE, this.update, this)
    this.ammoGauge?.destroy()
    this.sparkShot?.destroy()
    super.destroy(fromScene)
  }

  update() {
    if (this.body)
      this.setVelocity(0, 0)
    if (this.isSlow) {
      this.turnSpeed = GAME_CONFIG.tank.turnSpeedSlow
      this.speed = GAME_CONFIG.tank.speedSlow
    } else {
      this.turnSpeed = GAME_CONFIG.tank.turnSpeed
      this.speed = GAME_CONFIG.tank.speed
    }

    if (this.isLocal && this.body) {

      if (this.controlsA.A.isDown) {
        this.angle -= this.turnSpeed
      }
      if (this.controlsA.D.isDown) {
        this.angle += this.turnSpeed
      }
      if (this.controlsA.S.isDown) {
        const velocity = this.scene.physics.velocityFromAngle(this.angle - 90, this.speed)
        this.setVelocity(velocity.x, velocity.y)
      }
      if (this.controlsA.W.isDown) {
        const velocity = this.scene.physics.velocityFromAngle(this.angle - 90 + 180, this.speed)
        this.setVelocity(velocity.x, velocity.y)
      }
      this.maybeSendTankMove()

      if (Input.Keyboard.JustDown(this.controlsA.J)) {
        this.fire()
      }
    } else {
      this.applyRemoteState()
    }

    /*
    if (this.playerIndex == 1 && this.body)
    {
      if (this.controlsB.left.isDown) {
        this.angle -= this.turnSpeed
      }
      if (this.controlsB.right.isDown) {
        this.angle += this.turnSpeed
      }
      if (this.controlsB.down.isDown) {
        const velocity = this.scene.physics.velocityFromAngle(this.angle - 90, this.speed)
        this.setVelocity(velocity.x, velocity.y)
      }
      if (this.controlsB.up.isDown) {
        const velocity = this.scene.physics.velocityFromAngle(this.angle - 90 + 180, this.speed)
        this.setVelocity(velocity.x, velocity.y)
      }
      */

    // if (Input.Keyboard.JustDown(this.controlsB.enter)) {
    //   this.fire()
    // }
    if (this.sparkShot) {
      const tips = this.getTipTank(36)
      this.sparkShot.setPosition(
        tips[0],
        tips[1]
      )
    }
  }

  private maybeSendTankMove() {
    const now = this.scene.time.now
    if (now - this.lastSentAt < Tank.SEND_INTERVAL_MS) return
    const dx = Math.abs(this.x - this.lastSentX), dy = Math.abs(this.y - this.lastSentY)
    const da = Math.abs(this.angle - this.lastSentAngle)
    if (dx < Tank.POS_EPSILON && dy < Tank.POS_EPSILON && da < Tank.ANGLE_EPSILON) return
    this.lastSentAt = now
    this.lastSentX = this.x; this.lastSentY = this.y; this.lastSentAngle = this.angle
    this.scene.events.emit(GameEvent.TankMove, {
      roomId: sessionConfig.roomId,
      playerId: this.color,
      position: { x: this.x, y: this.y },
      rotation: this.angle,
      sequence: this.sequence++,
      timestamp: Date.now(),
    } satisfies TankMovePayload)
  }

  getProjectile(): Projectile | null {
    return this.projectile
  }

  getTipTank(distance: number): Pair {
    const tipX = this.x - Math.cos(PhaserMath.DegToRad(this.angle - 90)) * distance
    const tipY = this.y - Math.sin(PhaserMath.DegToRad(this.angle - 90)) * distance

    const tips: Pair = [tipX, tipY]

    return (tips)
  }

  setSparkShot() {
    this.sparkShot?.destroy()
    const tips = this.getTipTank(36)
    this.sparkShot = this.scene.add.sprite(tips[0], tips[1], 'spark')
    this.sparkShot.angle = this.angle
    this.sparkShot.depth = GAME_CONFIG.depth.spark
  }

  setSlow(value: boolean) {
    this.isSlow = value
  }

  fire() {
    if (!this.ammoGauge.getCanFire())
      return

    const tip = this.getTipTank(20)
    this.setSparkShot()
    this.scene.time.delayedCall(GAME_CONFIG.timing.sparkLifetime, () => {
      this.sparkShot?.destroy()
      this.sparkShot = undefined
    })

    this.projectile = new Projectile(this.scene, tip[0], tip[1], this.angle, this.color, this.projectileGroup, this)
    this.projectile.depth = GAME_CONFIG.depth.projectile

    this.scene.events.emit(GameEvent.ProjectileFired, this.projectile)

    this.projectile.once('destroy', () => {
      this.projectile = null
    })
    this.ammoGauge.consumeGauge()
  }

  private applyRemoteState() {
    if (!this.pendingRemote) return
    this.x = this.pendingRemote.x; this.y = this.pendingRemote.y; this.angle = this.pendingRemote.angle
  }

  receiveRemoteState(payload: TankMovedPayload) {
    this.pendingRemote = { x: payload.position.x, y: payload.position.y, angle: payload.rotation }
  }

  getColor(): Color {
    return this.color
  }
}
