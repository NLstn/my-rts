import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Load any assets needed for the loading screen
        // For now, we'll just use simple graphics
    }

    create() {
        // Boot scene complete, move to main menu
        this.scene.start('MainMenuScene');
    }
}
