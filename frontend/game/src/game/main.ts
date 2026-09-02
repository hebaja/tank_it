import { Game as MainGame } from './scenes/Game'
import { AUTO, Game, Scale, Types } from 'phaser'
import { Overlay } from './scenes/Overlay'
import { configureSession, SessionConfig } from '../net/sessionConfig'

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

const StartGame = (parent: string, session: Partial<SessionConfig> = {}) => {
  configureSession(session)
  return new Game({ ...config, parent })
}

export default StartGame
