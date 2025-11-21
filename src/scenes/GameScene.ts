import Phaser from 'phaser';

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;
const KEYBOARD_PAN_SPEED = 400;
const EDGE_SCROLL_SPEED = 350;
const EDGE_SCROLL_THRESHOLD = 30;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.6;
const ZOOM_STEP = 0.0015;

export class GameScene extends Phaser.Scene {
    private resources: number = 100;
    private resourceText!: Phaser.GameObjects.Text;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasdKeys!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;

    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        const { height } = this.scale;

        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

        // Background
        this.add.rectangle(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 0x228b22).setOrigin(0);

        // Grid for building placement
        this.createGrid(WORLD_WIDTH, WORLD_HEIGHT);

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

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasdKeys = this.input.keyboard.addKeys('W,A,S,D') as Record<
            'W' | 'A' | 'S' | 'D',
            Phaser.Input.Keyboard.Key
        >;

        this.input.on('wheel', (_pointer, _gameObjects, _deltaX, deltaY) => {
            const camera = this.cameras.main;
            const newZoom = Phaser.Math.Clamp(camera.zoom - deltaY * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
            camera.setZoom(newZoom);

            const maxScrollX = Math.max(WORLD_WIDTH - camera.displayWidth, 0);
            const maxScrollY = Math.max(WORLD_HEIGHT - camera.displayHeight, 0);

            camera.setScroll(
                Phaser.Math.Clamp(camera.scrollX, 0, maxScrollX),
                Phaser.Math.Clamp(camera.scrollY, 0, maxScrollY),
            );
        });
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
            .text(width - 10, 10, `Resources: ${this.resources}`, {
                fontSize: '20px',
                color: '#ffff00',
                backgroundColor: '#000000',
                padding: { x: 10, y: 5 },
            })
            .setOrigin(1, 0)
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

    update(_time: number, delta: number) {
        this.handleCameraControls(delta);
    }

    private handleCameraControls(delta: number) {
        const camera = this.cameras.main;
        const deltaSeconds = delta / 1000;
        const pointer = this.input.activePointer;

        let moveX = 0;
        let moveY = 0;

        if (this.cursors.left?.isDown || this.wasdKeys.A.isDown) {
            moveX -= KEYBOARD_PAN_SPEED;
        }

        if (this.cursors.right?.isDown || this.wasdKeys.D.isDown) {
            moveX += KEYBOARD_PAN_SPEED;
        }

        if (this.cursors.up?.isDown || this.wasdKeys.W.isDown) {
            moveY -= KEYBOARD_PAN_SPEED;
        }

        if (this.cursors.down?.isDown || this.wasdKeys.S.isDown) {
            moveY += KEYBOARD_PAN_SPEED;
        }

        if (pointer.x <= EDGE_SCROLL_THRESHOLD) {
            moveX -= EDGE_SCROLL_SPEED;
        } else if (pointer.x >= this.scale.width - EDGE_SCROLL_THRESHOLD) {
            moveX += EDGE_SCROLL_SPEED;
        }

        if (pointer.y <= EDGE_SCROLL_THRESHOLD) {
            moveY -= EDGE_SCROLL_SPEED;
        } else if (pointer.y >= this.scale.height - EDGE_SCROLL_THRESHOLD) {
            moveY += EDGE_SCROLL_SPEED;
        }

        const maxScrollX = Math.max(WORLD_WIDTH - camera.displayWidth, 0);
        const maxScrollY = Math.max(WORLD_HEIGHT - camera.displayHeight, 0);

        camera.scrollX = Phaser.Math.Clamp(camera.scrollX + moveX * deltaSeconds, 0, maxScrollX);
        camera.scrollY = Phaser.Math.Clamp(camera.scrollY + moveY * deltaSeconds, 0, maxScrollY);
    }
}
