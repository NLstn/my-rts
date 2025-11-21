import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
    private resources: number = 100;
    private resourceText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        const { width, height } = this.cameras.main;

        // Background
        this.add.rectangle(0, 0, width, height, 0x228b22).setOrigin(0);

        // Grid for building placement
        this.createGrid(width, height);

        // UI Panel
        this.createUI();

        // Sample base building
        this.createBuilding(200, 200, 'Base', 0x8b4513);

        // Sample resource nodes
        this.createResourceNode(600, 300);
        this.createResourceNode(800, 500);

        // Instructions
        this.add
            .text(10, height - 30, 'Click to select buildings | Collect resources to expand your base', {
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 5, y: 5 },
            })
            .setScrollFactor(0);
    }

    private createGrid(width: number, height: number) {
        const graphics = this.add.graphics();
        graphics.lineStyle(1, 0x00ff00, 0.2);

        const gridSize = 50;
        // Vertical lines
        for (let x = 0; x < width; x += gridSize) {
            graphics.lineBetween(x, 0, x, height);
        }
        // Horizontal lines
        for (let y = 0; y < height; y += gridSize) {
            graphics.lineBetween(0, y, width, y);
        }
    }

    private createUI() {
        const { width } = this.cameras.main;

        // Resource display
        this.resourceText = this.add
            .text(width - 150, 10, `Resources: ${this.resources}`, {
                fontSize: '20px',
                color: '#ffff00',
                backgroundColor: '#000000',
                padding: { x: 10, y: 5 },
            })
            .setScrollFactor(0);

        // Back to menu button
        const menuButton = this.add
            .text(10, 10, 'Main Menu', {
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#333333',
                padding: { x: 10, y: 5 },
            })
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });

        menuButton.on('pointerover', () => {
            menuButton.setStyle({ backgroundColor: '#555555' });
        });

        menuButton.on('pointerout', () => {
            menuButton.setStyle({ backgroundColor: '#333333' });
        });

        menuButton.on('pointerdown', () => {
            this.scene.start('MainMenuScene');
        });
    }

    private createBuilding(x: number, y: number, name: string, color: number) {
        const building = this.add.rectangle(x, y, 80, 80, color);
        building.setStrokeStyle(2, 0xffffff);
        building.setInteractive({ useHandCursor: true });

        this.add.text(x, y, name, {
            fontSize: '12px',
            color: '#ffffff',
        }).setOrigin(0.5);

        building.on('pointerdown', () => {
            console.log(`Selected: ${name}`);
            this.tweens.add({
                targets: building,
                scaleX: 1.1,
                scaleY: 1.1,
                duration: 100,
                yoyo: true,
            });
        });
    }

    private createResourceNode(x: number, y: number) {
        const resource = this.add.circle(x, y, 20, 0xffd700);
        resource.setStrokeStyle(2, 0xffff00);
        resource.setInteractive({ useHandCursor: true });

        resource.on('pointerdown', () => {
            this.collectResource(resource);
        });
    }

    private collectResource(resource: Phaser.GameObjects.Arc) {
        this.resources += 10;
        this.resourceText.setText(`Resources: ${this.resources}`);

        // Visual feedback
        this.tweens.add({
            targets: resource,
            alpha: 0,
            scale: 1.5,
            duration: 300,
            onComplete: () => {
                resource.destroy();
            },
        });
    }
}
