import { Physics, Input, Scenes, Scene } from 'phaser';
import { Math as PhaserMath } from 'phaser';
import { Projectile } from './Projectile';
import { AmmoGauge } from './AmmoGauge';
import { Color } from '../config/color';
import { SPAWN_CORNERS } from '../config/layout';
import { GAME_CONFIG } from '../config/game';
import { GameEvent } from '../config/events';
import { sessionConfig } from '../../net/sessionConfig';
import {
    Position,
    ProjectilePayload,
    TankMovedPayload,
    TankMovePayload,
} from '../../net/contracts';

type TankControls = {
    A: Input.Keyboard.Key;
    D: Input.Keyboard.Key;
    W: Input.Keyboard.Key;
    S: Input.Keyboard.Key;
    SPACE: Input.Keyboard.Key;
};

export class Tank extends Physics.Arcade.Sprite {
    private controlsA: TankControls;
    private projectile: Projectile | null = null;
    private ammoGauge: AmmoGauge;
    private sparkShot?: Phaser.GameObjects.Sprite;
    private speed: number = GAME_CONFIG.tank.speed;
    private turnSpeed: number = GAME_CONFIG.tank.turnSpeed;
    private isSlow: boolean = false;
    private color: Color;
    private isLocal: boolean;
    private projectileGroup: Phaser.Physics.Arcade.Group;
    private lastSentAt = 0;
    private lastSentX = 0;
    private lastSentY = 0;
    private lastSentAngle = 0;
    private sequence = 0;
    private controlMode: 'human' | 'ai' = 'human';
    private static readonly SEND_INTERVAL_MS = 5;
    private static readonly POS_EPSILON = 0.5;
    private static readonly ANGLE_EPSILON = 0.5;

    private pendingRemote?: { x: number; y: number; angle: number };

    static preload(scene: Scene) {
        scene.load.image(Color.blue, 'sprites/tank_blue.png');
        scene.load.image(Color.red, 'sprites/tank_red.png');
        scene.load.image(Color.green, 'sprites/tank_green.png');
        scene.load.image(Color.dark, 'sprites/tank_dark.png');
        scene.load.image('spark', 'sprites/shot_orange.png');
    }

    constructor(
        scene: Scene,
        x: number,
        y: number,
        angle: number,
        color: Color,
        group: Phaser.Physics.Arcade.Group,
        projectileGroup: Phaser.Physics.Arcade.Group,
        isLocal: boolean,
    ) {
        super(scene, x, y, color);
        const keyboard = scene.input.keyboard;
        if (!keyboard) {
            throw new Error('Keyboard plugin not available');
        }
        scene.physics.add.existing(this);
        scene.add.existing(this);
        group.add(this);
        scene.events.on(Scenes.Events.UPDATE, this.update, this);
        this.setCollideWorldBounds(true);
        this.depth = GAME_CONFIG.depth.tank;
        this.color = color;
        this.projectileGroup = projectileGroup;
        this.isLocal = isLocal;
        this.angle = angle;

        if (this.isLocal)
            this.controlsA = keyboard.addKeys({
                A: Input.Keyboard.KeyCodes.A,
                D: Input.Keyboard.KeyCodes.D,
                W: Input.Keyboard.KeyCodes.W,
                S: Input.Keyboard.KeyCodes.S,
                SPACE: Input.Keyboard.KeyCodes.SPACE,
            }) as TankControls;
        this.ammoGauge = new AmmoGauge(scene, color, SPAWN_CORNERS[color]);
    }

    destroy(fromScene?: boolean): void {
        this.scene?.events.off(Scenes.Events.UPDATE, this.update, this);
        this.ammoGauge?.destroy();
        this.sparkShot?.destroy();
        super.destroy(fromScene);
    }

    moveForward() {
        const velocity = this.scene.physics.velocityFromAngle(
            this.angle - 90 + 180,
            this.speed,
        );
        this.setVelocity(velocity.x, velocity.y);
    }

    moveBackward() {
        const velocity = this.scene.physics.velocityFromAngle(
            this.angle - 90,
            this.speed,
        );
        this.setVelocity(velocity.x, velocity.y);
    }

    turnLeft() {
        this.angle -= this.turnSpeed;
    }

    turnRight() {
        this.angle += this.turnSpeed;
    }

    applyAction(action: number) {
        switch (action) {
            case 0:
                this.speed = 0;
                break;
            case 1:
                this.moveForward();
                break;
            case 2:
                this.moveBackward();
                break;
            case 3:
                this.turnLeft();
                break;
            case 4:
                this.turnRight();
                break;
            case 5:
                this.fire();
                break;
        }
    }

    humanControl() {
        if (this.controlsA.A.isDown) {
            this.applyAction(3);
        }
        if (this.controlsA.D.isDown) {
            this.applyAction(4);
        }
        if (this.controlsA.S.isDown) {
            this.applyAction(2);
        }
        if (this.controlsA.W.isDown) {
            this.applyAction(1);
        }
        if (Input.Keyboard.JustDown(this.controlsA.SPACE)) {
            this.applyAction(5);
        }
    }

    aiControl() {
        this.applyAction(3);
    }

    getObservation(
        enemyTank: Tank,
    ): [number, number, number, number, number, number] {
        const dx =
            (enemyTank.x - this.x) / this.scene.physics.world.bounds.width;
        const dy =
            (enemyTank.y - this.y) / this.scene.physics.world.bounds.height;
        const angle = this.angle / 180;
        const canFire = this.ammoGauge.getCanFire() ? 1 : 0;
        const isSlow = this.isSlow ? 1 : 0;
        const targetAngle =
            (Math.atan2(enemyTank.y - this.y, enemyTank.x - this.x) * 180) /
            Math.PI;
        return [angle, dx, dy, canFire, isSlow, targetAngle];
    }

    update() {
        if (this.body) this.setVelocity(0, 0);
        if (this.isSlow) {
            this.turnSpeed = GAME_CONFIG.tank.turnSpeedSlow;
            this.speed = GAME_CONFIG.tank.speedSlow;
        } else {
            this.turnSpeed = GAME_CONFIG.tank.turnSpeed;
            this.speed = GAME_CONFIG.tank.speed;
        }
        if (this.isLocal && this.body) {
            if (this.controlMode === 'human') {
                this.humanControl();
            }
            if (this.controlMode === 'ai') {
                this.aiControl();
            }
            this.maybeSendTankMove();
        } else {
            this.applyRemoteState();
        }
        if (this.sparkShot) {
            const tip = this.getProjectileOrigin(36);
            this.sparkShot.setPosition(tip.x, tip.y);
        }
    }

    private maybeSendTankMove() {
        const now = this.scene.time.now;

        if (now - this.lastSentAt < Tank.SEND_INTERVAL_MS) return;

        const dx = Math.abs(this.x - this.lastSentX),
            dy = Math.abs(this.y - this.lastSentY);
        const da = Math.abs(this.angle - this.lastSentAngle);

        if (
            dx < Tank.POS_EPSILON &&
            dy < Tank.POS_EPSILON &&
            da < Tank.ANGLE_EPSILON
        )
            return;

        this.lastSentAt = now;
        this.lastSentX = this.x;
        this.lastSentY = this.y;
        this.lastSentAngle = this.angle;
        this.scene.events.emit(GameEvent.TankMove, {
            roomId: sessionConfig.roomId,
            playerId: this.color,
            position: { x: this.x, y: this.y },
            rotation: this.angle,
            sequence: this.sequence++,
            timestamp: Date.now(),
        } satisfies TankMovePayload);
    }

    getProjectile(): Projectile | null {
        return this.projectile;
    }

    getProjectileOrigin(distance: number): Position {
        const tipX =
            this.x - Math.cos(PhaserMath.DegToRad(this.angle - 90)) * distance;
        const tipY =
            this.y - Math.sin(PhaserMath.DegToRad(this.angle - 90)) * distance;

        return {
            x: tipX,
            y: tipY,
        };
    }

    setSparkShot() {
        this.sparkShot?.destroy();
        const tip = this.getProjectileOrigin(36);
        this.sparkShot = this.scene.add.sprite(tip.x, tip.y, 'spark');
        this.sparkShot.angle = this.angle;
        this.sparkShot.depth = GAME_CONFIG.depth.spark;
    }

    setSlow(value: boolean) {
        this.isSlow = value;
    }

    fire(payload?: ProjectilePayload) {
        if (!this.ammoGauge.getCanFire()) {
            this.scene.events.emit(GameEvent.ProjectileFireFail);
            return;
        }
        this.spawnProjectile(payload);
        if (this.isLocal) this.ammoGauge.consumeGauge();
    }

    spawnProjectile(payload?: ProjectilePayload) {
        const projectileId = payload
            ? payload.projectileId
            : crypto.randomUUID();
        const origin = payload ? payload.origin : this.getProjectileOrigin(20);
        const angle = payload ? payload.angle : this.angle;
        this.setSparkShot();
        this.scene.time.delayedCall(GAME_CONFIG.timing.sparkLifetime, () => {
            this.sparkShot?.destroy();
            this.sparkShot = undefined;
        });

        this.projectile = new Projectile(
            this.scene,
            projectileId,
            origin,
            angle,
            this.color,
            this.projectileGroup,
            this,
            Date.now(),
        );
        this.projectile.depth = GAME_CONFIG.depth.projectile;

        if (this.isLocal)
            this.scene.events.emit(GameEvent.ProjectileFire, {
                roomId: sessionConfig.roomId,
                ownerId: this.color,
                projectileId: this.projectile.getId(),
                origin: origin,
                angle: angle,
                color: this.color,
                timestamp: Date.now(),
                sequence: this.sequence,
            } satisfies ProjectilePayload);

        this.projectile.once('destroy', () => {
            this.projectile = null;
        });
    }

    private applyRemoteState() {
        if (!this.pendingRemote) return;
        this.x = this.pendingRemote.x;
        this.y = this.pendingRemote.y;
        this.angle = this.pendingRemote.angle;
    }

    receiveRemoteState(payload: TankMovedPayload) {
        this.pendingRemote = {
            x: payload.position.x,
            y: payload.position.y,
            angle: payload.rotation,
        };
    }

    fireRemoteProjectile(payload: ProjectilePayload) {
        this.fire(payload);
        this.ammoGauge.consumeGauge();
    }

    getColor(): Color {
        return this.color;
    }

    getIsLocal(): boolean {
        return this.isLocal;
    }
}
