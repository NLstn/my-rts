import Phaser from 'phaser';
import { Building, type BuildingConfig } from '../buildings/Building';
import { Barracks } from '../buildings/Barracks';
import { Base } from '../buildings/Base';
import { type ResourceNode, Worker } from '../units/Worker';

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
    private readonly gridSize = 50;
    private placementPreview?: Phaser.GameObjects.Rectangle;
    private placementInfoText?: Phaser.GameObjects.Text;
    private feedbackText?: Phaser.GameObjects.Text;
    private currentPlacement?: BuildingConfig;
    private placedBuildings: Building[] = [];
    private basePosition: Phaser.Math.Vector2 = new Phaser.Math.Vector2(200, 200);
    private workers: Worker[] = [];
    private selectedWorker?: Worker;
    private resourceNodes: ResourceNode[] = [];
    private nodeIdCounter: number = 0;

    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        const { height } = this.scale;

        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

        this.input.mouse?.disableContextMenu();

        // Background
        this.add.rectangle(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 0x228b22).setOrigin(0);

        // Grid for building placement
        this.createGrid(WORLD_WIDTH, WORLD_HEIGHT);

        // UI Panel
        this.createUI();

        // Sample base building
        const baseBuilding = new Base(this);
        baseBuilding.create(this.basePosition.x, this.basePosition.y);
        this.placedBuildings.push(baseBuilding);

        // Sample resource nodes
        this.createResourceNode(600, 300);
        this.createResourceNode(800, 500);

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            this.updatePlacementPreview(pointer);
        });

        // Left click to place building (use pointerup to fire after UI button clicks)
        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            // Only place if we're in placement mode and didn't click on an interactive object
            if (pointer.leftButtonReleased() && this.currentPlacement) {
                // Check if we clicked on any game object (UI, buildings, resources)
                const hitObjects = this.input.hitTestPointer(pointer);
                const clickedOnUI = hitObjects.some(obj => obj.input && obj.input.cursor === 'pointer');

                if (!clickedOnUI) {
                    this.confirmPlacement();
                }
            }
        });

        // Right click to cancel placement
        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonReleased() && this.currentPlacement) {
                this.cancelPlacement();
            }
        });

        // Instructions
        this.add
            .text(10, height - 30, 'Left-click to place | Right-click for workers | Use build button or spawn workers', {
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

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonDown()) {
                this.handleCommand(pointer.worldX, pointer.worldY);
            }
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

        const barracks = new Barracks(this);
        const barracksConfig = barracks.getConfig();

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

        const spawnWorkerButton = this.add
            .text(10, 50, 'Spawn Worker', {
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#3366cc',
                padding: { x: 10, y: 5 },
            })
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });

        spawnWorkerButton.on('pointerover', () => {
            spawnWorkerButton.setStyle({ backgroundColor: '#3355aa' });
        });

        spawnWorkerButton.on('pointerout', () => {
            spawnWorkerButton.setStyle({ backgroundColor: '#3366cc' });
        });

        spawnWorkerButton.on('pointerdown', () => {
            this.spawnWorker();
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
    }

    private spawnWorker() {
        const offset = 30 + this.workers.length * 10;
        const worker = new Worker(
            this,
            this.basePosition.x + offset,
            this.basePosition.y + offset,
            this.basePosition,
            this.gridSize,
            (amount) => this.depositResource(amount),
            (node) => this.updateResourceLabel(node),
            (node) => this.handleResourceDepleted(node),
        );

        worker.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (!pointer.rightButtonDown()) {
                this.selectWorker(worker);
            }
        });

        this.workers.push(worker);
        this.selectWorker(worker);
    }

    private selectWorker(worker: Worker) {
        this.selectedWorker?.setSelected(false);
        this.selectedWorker = worker;
        this.selectedWorker.setSelected(true);
    }

    private handleCommand(worldX: number, worldY: number) {
        if (!this.selectedWorker) return;

        const targetNode = this.resourceNodes.find((node) => node.sprite.getBounds().contains(worldX, worldY));

        if (targetNode) {
            if (targetNode.amount <= 0) {
                this.showFeedback('This resource node is depleted.');
                return;
            }
            this.selectedWorker.assignResource(targetNode);
            return;
        }

        this.selectedWorker.moveTo(new Phaser.Math.Vector2(worldX, worldY));
    }

    private createResourceNode(x: number, y: number) {
        const resource = this.add.circle(x, y, 20, 0xffd700);
        resource.setStrokeStyle(2, 0xffff00);
        resource.setInteractive({ useHandCursor: true });

        const label = this.add
            .text(x, y - 35, '100', {
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 4, y: 2 },
            })
            .setOrigin(0.5);

        const node: ResourceNode = {
            id: this.nodeIdCounter++,
            sprite: resource,
            label,
            amount: 100,
        };

        resource.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonDown() && this.selectedWorker) {
                if (node.amount <= 0) {
                    this.showFeedback('This resource node is depleted.');
                    return;
                }
                this.selectedWorker.assignResource(node);
            }
        });

        this.resourceNodes.push(node);
    }

    private updateResourceLabel(node: ResourceNode) {
        node.label.setText(`${node.amount}`);
    }

    private handleResourceDepleted(node: ResourceNode) {
        node.sprite.disableInteractive();
        node.label.setText('Depleted');
        node.label.setColor('#ff6666');
        this.resourceNodes = this.resourceNodes.filter((existingNode) => existingNode.id !== node.id);

        this.workers.forEach((worker) => worker.handleDepletedNode(node));
    }

    private depositResource(amount: number) {
        this.resources += amount;
        this.resourceText.setText(`Resources: ${this.resources}`);
    }

    update(_time: number, delta: number) {
        this.handleCameraControls(delta);
        this.workers.forEach((worker) => worker.update());
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
        this.placementInfoText?.setText(`Placing ${config.name} | Cost: ${config.cost} | Left-click to place, Right-click to cancel`);
        this.placementInfoText?.setVisible(true);

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
            const sprite = building.getSprite();
            if (!sprite) return false;
            const bounds = sprite.getBounds();
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

        // Create the appropriate building type
        let newBuilding: Building;
        if (this.currentPlacement.name === 'Barracks') {
            newBuilding = new Barracks(this);
        } else if (this.currentPlacement.name === 'Base') {
            newBuilding = new Base(this);
        } else {
            // Fallback - default to Barracks for unknown types
            newBuilding = new Barracks(this);
        }
        newBuilding.create(x, y);
        this.placedBuildings.push(newBuilding);

        this.cancelPlacement();
    }

    private cancelPlacement() {
        this.currentPlacement = undefined;
        this.placementPreview?.setVisible(false);
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
