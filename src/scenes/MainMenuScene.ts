import Phaser from 'phaser';

export class MainMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenuScene' });
    }

    create() {
        const { width, height } = this.cameras.main;

        // Title
        this.add
            .text(width / 2, height / 3, 'RTS Game', {
                fontSize: '64px',
                color: '#ffffff',
            })
            .setOrigin(0.5);

        // Start button
        const startButton = this.add
            .text(width / 2, height / 2, 'Start Game', {
                fontSize: '32px',
                color: '#00ff00',
                backgroundColor: '#333333',
                padding: { x: 20, y: 10 },
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        startButton.on('pointerover', () => {
            startButton.setStyle({ color: '#ffffff' });
        });

        startButton.on('pointerout', () => {
            startButton.setStyle({ color: '#00ff00' });
        });

        startButton.on('pointerdown', () => {
            this.scene.start('GameScene');
        });

        // Instructions
        this.add
            .text(width / 2, (height * 2) / 3, 'Build your base, collect resources, and defend against enemies!', {
                fontSize: '18px',
                color: '#aaaaaa',
            })
            .setOrigin(0.5);
    }
}
