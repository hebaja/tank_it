import { Scene } from 'phaser';
import { Tank } from '../objects/Tank';
import { GameEvent } from '../config/events';
import { sessionConfig } from '../../net/sessionConfig';
import { MatchPlacement } from '../../net/contracts';

export interface MatchResult {
    placements: MatchPlacement[];
}

export class MatchManager {
    private scene: Scene;
    private placements: MatchPlacement[] = [];
    private place: number = 0;
    private points: number = 0;
    private ended: boolean = false;

    constructor(scene: Scene) {
        this.scene = scene;

        // this.scene.events.once(GameEvent.MatchEnd, this.handleMatchEnd, this);
    }

    reset() {
        this.place = 3;
        this.points = 0;
        this.placements = [];
        this.ended = false;
    }

    destroy() {
        // this.scene.events.off(GameEvent.MatchEnd, this.handleMatchEnd, this);
    }

    generatePlacement(
        tank: Tank,
        isWinner: boolean,
    ): MatchPlacement | undefined {
        if (tank.active) {
            return {
                color: tank.getColor(),
                points: this.points++,
                placement: this.place--,
                timestamp: Date.now(),
                isMatchWinner: isWinner,
            };
        }
        return undefined;
    }

    recordPlacement(tank: Tank, isWinner: boolean) {
        const placement = this.generatePlacement(tank, isWinner);

        if (placement) this.placements.push(placement);

        if (this.placements.length >= 1) {
            for (let i = this.placements.length - 1; i > 0; i--) {
                if (i - 1 === -1) break;
                if (
                    Math.abs(
                        this.placements[i - 1].timestamp -
                            this.placements[i].timestamp,
                    ) <= 1
                )
                    this.placements[i - 1].points = this.placements[i].points;
            }
        }
        return placement;
    }

    checkEnd(tankGroup: Phaser.Physics.Arcade.Group) {
        if (this.ended) return;
        if (tankGroup.getLength() === 1) {
            const winner = tankGroup.getFirstAlive() as Tank | undefined;
            if (this.placements.length < 4 && winner) {
                this.recordPlacement(winner, true);
                this.ended = true;
                this.scene.events.emit(GameEvent.MatchEnd, {
                    roomId: sessionConfig.roomId,
                    championshipId: sessionConfig.champId,
                    placements: this.placements,
                });
            }
        } else if (tankGroup.getLength() === 0) {
            this.ended = true;
            this.scene.events.emit(GameEvent.MatchEnd, {
                roomId: sessionConfig.roomId,
                championshipId: sessionConfig.champId,
                placements: this.placements,
            });
        }
    }

    // private handleMatchEnd(data: MatchResult): void {
    //     this.scene.time.delayedCall(
    //         GAME_CONFIG.timing.matchEndOverlayDelay,
    //         () => {
    //             this.scene.scene.pause();
    //             this.scene.scene.launch('Overlay');
    //             console.log(data);
    //         },
    //     );
    // }

    setPlace(place: number) {
        this.place = place;
    }
}
