/**
 * Game entry point – configures and starts the Phaser game.
 */
import { MenuScene } from './scenes/MenuScene.js';
import { OfficeScene } from './scenes/OfficeScene.js';

const params = new URLSearchParams(window.location.search);
const rendererType = params.get('renderer') === 'canvas' ? Phaser.CANVAS : Phaser.AUTO;

const config = {
  type: rendererType,
  parent: 'game-container',
  backgroundColor: '#0f0f1e',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%',
  },
  dom: {
    createContainer: true,
  },
  scene: [MenuScene, OfficeScene],
};

window.__game = new Phaser.Game(config);
