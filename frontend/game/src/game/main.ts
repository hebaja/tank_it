import { Game as MainGame } from './scenes/Game'
import { AUTO, Game, Scale,Types } from 'phaser'
import { Overlay } from './scenes/Overlay'

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Types.Core.GameConfig = {
    type: AUTO,
    width: 1280,
    height: 960,
    parent: 'game-container',
    backgroundColor: '#000000',
	pixelArt: true,
	physics: {
		default: 'arcade',
			// arcade: {
			//     debug: true
			// }
    },
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [
        MainGame,
		Overlay
    ]
}

const StartGame = (parent: string) => {
    return new Game({ ...config, parent })
}

export default StartGame
