import Phaser from 'phaser';

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;
const KEYBOARD_PAN_SPEED = 400;
const EDGE_SCROLL_SPEED = 350;
const EDGE_SCROLL_THRESHOLD = 30;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.6;
const ZOOM_STEP = 0.0015;

type BuildingType = 'hq' | 'military' | 'utility';

interface BuildingConfig {
    name: string;
    width: number;
    height: number;
    color: number;
    cost: number;
    type: BuildingType;
}

export class GameScene extends Phaser.Scene {
    private resources: number = 100;
    private resourceText!: Phaser.GameObjects.Text;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasdKeys!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
    private readonly gridSize = 50;
    private placementPreview?: Phaser.GameObjects.Rectangle;
    private placementInfoText?: Phaser.GameObjects.Text;
    private confirmButton?: Phaser.GameObjects.Text;
    private cancelButton?: Phaser.GameObjects.Text;
    private feedbackText?: Phaser.GameObjects.Text;
    private currentPlacement?: BuildingConfig;
    private placedBuildings: Phaser.GameObjects.Rectangle[] = [];

    private readonly buildingConfigs: BuildingConfig[] = [
        {
            name: 'Barracks',
            width: 100,
            height: 80,
            color: 0x3366ff,
            cost: 50,
            type: 'military',
        },
    ];

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
        this.createBuilding({
            name: 'Base',
            width: 80,
            height: 80,
            color: 0x8b4513,
            cost: 0,
            type: 'hq',
        }, 200, 200);

        // Sample resource nodes
        this.createResourceNode(600, 300);
        this.createResourceNode(800, 500);

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            this.updatePlacementPreview(pointer);
        });

        // Instructions
        this.add
            .text(10, height - 30, 'Click to select buildings | Collect resources to expand your base', {
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 5, y: 5 },
            })
            .setScrollFactor(0);

        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasdKeys = this.input.keyboard!.addKeys('W,A,S,D') as Record<
            'W' | 'A' | 'S' | 'D',
            Phaser.Input.Keyboard.Key
        >;

        this.input.on('wheel', (_pointer: unknown, _gameObjects: unknown, _deltaX: number, deltaY: number) => {
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

        for (let x = 0; x < width; x += this.gridSize) {
            graphics.lineBetween(x, 0, x, height);
        }

        for (let y = 0; y < height; y += this.gridSize) {
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

        const barracksConfig = this.buildingConfigs[0];

        const buildButton = this.add
            .text(width - 10, 40, `Build ${barracksConfig.name} (${barracksConfig.cost})`, {
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#0066cc',
                padding: { x: 10, y: 5 },
            })
            .setOrigin(1, 0)
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });

        buildButton.on('pointerdown', () => {
            this.startPlacement(barracksConfig);
        });

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

        this.placementInfoText = this.add
            .text(width / 2, 10, '', {
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 10, y: 5 },
            })
            .setOrigin(0.5, 0)
            .setScrollFactor(0)
            .setVisible(false);

        this.feedbackText = this.add
            .text(width / 2, 40, '', {
                fontSize: '14px',
                color: '#ff6666',
                backgroundColor: '#000000',
                padding: { x: 8, y: 4 },
            })
            .setOrigin(0.5, 0)
            .setScrollFactor(0)
            .setVisible(false);

        this.confirmButton = this.createPlacementButton(width / 2 - 80, 70, 'Confirm', () => {
            this.confirmPlacement();
        });

        this.cancelButton = this.createPlacementButton(width / 2 + 20, 70, 'Cancel', () => {
            this.cancelPlacement();
        });
    }

    private createPlacementButton(x: number, y: number, label: string, onClick: () => void) {
        const button = this.add
            .text(x, y, label, {
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: '#444444',
                padding: { x: 10, y: 5 },
            })
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true })
            .setVisible(false);

        button.on('pointerover', () => button.setStyle({ backgroundColor: '#666666' }));
        button.on('pointerout', () => button.setStyle({ backgroundColor: '#444444' }));
        button.on('pointerdown', onClick);

        return button;
    }

    private createBuilding(config: BuildingConfig, x: number, y: number) {
        const building = this.add.rectangle(x, y, config.width, config.height, config.color);
        building.setStrokeStyle(2, 0xffffff);
        building.setInteractive({ useHandCursor: true });

        this.add
            .text(x, y, `${config.name}\n(${config.type})`, {
                fontSize: '12px',
                color: '#ffffff',
                align: 'center',
            })
            .setOrigin(0.5);

        building.on('pointerdown', () => {
            console.log(`Selected: ${config.name}`);
            this.tweens.add({
                targets: building,
                scaleX: 1.1,
                scaleY: 1.1,
                duration: 100,
                yoyo: true,
            });
        });

        this.placedBuildings.push(building);
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

    private startPlacement(config: BuildingConfig) {
        this.currentPlacement = config;
        this.feedbackText?.setVisible(false);
        this.placementInfoText?.setText(`Placing ${config.name} | Cost: ${config.cost}`);
        this.placementInfoText?.setVisible(true);
        this.confirmButton?.setVisible(true);
        this.cancelButton?.setVisible(true);

        if (!this.placementPreview) {
            this.placementPreview = this.add.rectangle(0, 0, config.width, config.height, config.color, 0.35);
            this.placementPreview.setStrokeStyle(2, 0x00ff00);
        } else {
            this.placementPreview
                .setSize(config.width, config.height)
                .setFillStyle(config.color, 0.35)
                .setVisible(true);
        }

        this.updatePlacementPreview(this.input.activePointer);
    }

    private updatePlacementPreview(pointer: Phaser.Input.Pointer) {
        if (!this.currentPlacement || !this.placementPreview) {
            return;
        }

        const snappedX = Math.round(pointer.worldX / this.gridSize) * this.gridSize;
        const snappedY = Math.round(pointer.worldY / this.gridSize) * this.gridSize;

        this.placementPreview.setPosition(snappedX, snappedY);
        const collision = this.checkCollision(snappedX, snappedY, this.currentPlacement);
        const hasResources = this.resources >= this.currentPlacement.cost;
        const validPlacement = !collision && hasResources;

        this.placementPreview.setStrokeStyle(2, validPlacement ? 0x00ff00 : 0xff0000);
        this.placementPreview.setFillStyle(this.currentPlacement.color, validPlacement ? 0.35 : 0.2);

        if (!hasResources) {
            this.showFeedback('Not enough resources');
        } else if (collision) {
            this.showFeedback('Cannot place: collision with existing building');
        } else {
            this.feedbackText?.setVisible(false);
        }
    }

    private checkCollision(x: number, y: number, config: BuildingConfig) {
        const previewBounds = new Phaser.Geom.Rectangle(
            x - config.width / 2,
            y - config.height / 2,
            config.width,
            config.height,
        );

        return this.placedBuildings.some((building) => {
            const bounds = building.getBounds();
            return Phaser.Geom.Intersects.RectangleToRectangle(previewBounds, bounds);
        });
    }

    private confirmPlacement() {
        if (!this.currentPlacement || !this.placementPreview) {
            return;
        }

        const { x, y } = this.placementPreview;
        const hasCollision = this.checkCollision(x, y, this.currentPlacement);
        if (hasCollision) {
            this.showFeedback('Cannot place here. Please choose another spot.');
            return;
        }

        if (this.resources < this.currentPlacement.cost) {
            this.showFeedback('Insufficient resources to construct this building.');
            this.pulseResourceText();
            return;
        }

        this.resources -= this.currentPlacement.cost;
        this.resourceText.setText(`Resources: ${this.resources}`);
        this.createBuilding(this.currentPlacement, x, y);
        this.cancelPlacement();
    }

    private cancelPlacement() {
        this.currentPlacement = undefined;
        this.placementPreview?.setVisible(false);
        this.confirmButton?.setVisible(false);
        this.cancelButton?.setVisible(false);
        this.placementInfoText?.setVisible(false);
        this.feedbackText?.setVisible(false);
    }

    private showFeedback(message: string) {
        if (!this.feedbackText) {
            return;
        }

        this.feedbackText.setText(message);
        this.feedbackText.setVisible(true);
    }

    private pulseResourceText() {
        this.tweens.add({
            targets: this.resourceText,
            tint: 0xff0000,
            duration: 150,
            yoyo: true,
            repeat: 2,
        });
    }
}
