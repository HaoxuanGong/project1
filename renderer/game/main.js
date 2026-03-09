/**
 * Game entry point – configures and starts the Phaser game.
 */
import { MenuScene } from './scenes/MenuScene.js';
import { OfficeScene } from './scenes/OfficeScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
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
