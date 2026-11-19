import { Scene } from 'phaser';
import { GameEvent } from '../config/events';
import { sessionConfig } from '../../net/sessionConfig';

export class MatchManager {
    private scene: Scene;
    private ended: boolean = false;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    reset() {
        this.ended = false;
    }

    checkEnd(tankGroup: Phaser.Physics.Arcade.Group) {
        if (this.ended) return;
        if (tankGroup.getLength() === 1 || tankGroup.getLength() === 0) {
            this.ended = true;
            this.scene.events.emit(GameEvent.MatchEnd, {
                roomId: sessionConfig.roomId,
                championshipId: sessionConfig.champId,
            });
        }
    }
}
