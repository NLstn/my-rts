import Phaser from 'phaser';
import { Building, type BuildingConfig } from '../buildings/Building';
import { Barracks } from '../buildings/Barracks';
import { Base } from '../buildings/Base';
import { House } from '../buildings/House';
import { Storehouse } from '../buildings/Storehouse';
import { Tower } from '../buildings/Tower';
import { type ResourceNode, type WorkerStateType, Worker, WorkerState } from '../units/Worker';

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;
const KEYBOARD_PAN_SPEED = 400;
const EDGE_SCROLL_SPEED = 350;
const EDGE_SCROLL_THRESHOLD = 30;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.6;
const ZOOM_STEP = 0.0015;
const KEYBOARD_ZOOM_RATE = 240;

interface PlacementValidationResult {
    valid: boolean;
    reason?: string;
    type?: 'building' | 'resource' | 'baseZone';
}

interface ResourceManagerConfig {
    initialSpawnCount: number;
    nodesPerInterval: number;
    maxActiveNodes: number;
    respawnIntervalMs: number;
    minDistanceFromBase: number;
    maxDistanceFromBase: number;
    minDistanceBetweenNodes: number;
}

interface ConstructionSite {
    config: BuildingConfig;
    position: Phaser.Math.Vector2;
    container: Phaser.GameObjects.Container;
    base: Phaser.GameObjects.Rectangle;
    progressBar: Phaser.GameObjects.Rectangle;
    progressBackground: Phaser.GameObjects.Rectangle;
    progressText: Phaser.GameObjects.Text;
    remainingTime: number;
    totalTime: number;
    requiresWorker: boolean;
    assignedWorker?: Worker;
}

type ScenarioGoalType = 'resources' | 'houses' | 'storehouses' | 'workers';

interface ScenarioGoal {
    id: ScenarioGoalType;
    description: string;
    current: number;
    target: number;
    completed: boolean;
}

interface TrainingQueueState {
    building: Building;
    pending: number;
    activeTimer?: Phaser.Time.TimerEvent;
    currentCompleteTime?: number;
    spawnPoint: Phaser.Math.Vector2;
}

export class GameScene extends Phaser.Scene {
    private resources: number = 100;

    private readonly workerCost: number = 25;

    private populationCap: number = 8;
    private currentPopulation: number = 0;

    private resourceText!: Phaser.GameObjects.Text;
    private populationText!: Phaser.GameObjects.Text;
    private spawnWorkerButton!: Phaser.GameObjects.Text;
    private trainingStatusText!: Phaser.GameObjects.Text;
    private idleWorkerButton!: Phaser.GameObjects.Text;
    private gatherNearestButton!: Phaser.GameObjects.Text;
    private autoGatherButton!: Phaser.GameObjects.Text;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasdKeys!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
    private zoomKeys!: Record<'Q' | 'E', Phaser.Input.Keyboard.Key>;
    private readonly gridSize = 50;
    private placementPreview?: Phaser.GameObjects.Rectangle;
    private placementInfoText?: Phaser.GameObjects.Text;
    private feedbackText?: Phaser.GameObjects.Text;
    private currentPlacement?: BuildingConfig;
    private placedBuildings: Building[] = [];
    private constructionSites: ConstructionSite[] = [];
    private basePosition: Phaser.Math.Vector2 = new Phaser.Math.Vector2(200, 200);
    private dropOffPoints: Phaser.Math.Vector2[] = [];
    private dropOffMarkers: Phaser.GameObjects.Shape[] = [];
    private buildMenuConfigs: BuildingConfig[] = [];
    private workers: Worker[] = [];
    private readonly idleWorkers: Set<Worker> = new Set();
    private trainingQueues: Map<Building, TrainingQueueState> = new Map();
    private selectedWorker?: Worker;
    private selectedBuilding?: Building;
    private resourceNodes: ResourceNode[] = [];
    private nodeIdCounter: number = 0;
    private readonly resourceManagerConfig: ResourceManagerConfig = {
        initialSpawnCount: 4,
        nodesPerInterval: 2,
        maxActiveNodes: 8,
        respawnIntervalMs: 12000,
        minDistanceFromBase: 250,
        maxDistanceFromBase: 900,
        minDistanceBetweenNodes: 200,
    };
    private resourceRespawnTimer?: Phaser.Time.TimerEvent;
    private readonly workerProductionTimeMs = 2000;
    private autoGatherEnabled: boolean = false;

    private scenarioGoals: ScenarioGoal[] = [];
    private readonly scenarioDurationMs = 4 * 60 * 1000;
    private scenarioEndTime: number = 0;
    private scenarioCompleted: boolean = false;
    private scenarioFailed: boolean = false;
    private scenarioPanel?: Phaser.GameObjects.Container;
    private scenarioPanelBackground?: Phaser.GameObjects.Rectangle;
    private goalTextMap: Map<ScenarioGoalType, Phaser.GameObjects.Text> = new Map();
    private scenarioTimerText?: Phaser.GameObjects.Text;
    private scenarioResultContainer?: Phaser.GameObjects.Container;
    private housesBuilt: number = 0;
    private storehousesBuilt: number = 0;

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

        this.buildMenuConfigs = this.createBuildMenuConfigs();

        // UI Panel
        this.createUI();

        // Sample base building
        const baseBuilding = new Base(this);
        baseBuilding.create(this.basePosition.x, this.basePosition.y);
        this.configureBuilding(baseBuilding);
        this.placedBuildings.push(baseBuilding);
        this.addDropOffPoint(this.basePosition.clone());
        this.initializeResourceManager();

        this.initializeScenarioGoals();

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
        this.zoomKeys = this.input.keyboard!.addKeys('Q,E') as Record<'Q' | 'E', Phaser.Input.Keyboard.Key>;

        this.input.keyboard?.on('keydown-PERIOD', () => {
            this.selectNextIdleWorker();
        });

        this.input.on('wheel', (pointer: Phaser.Input.Pointer, _gameObjects: unknown, _deltaX: number, deltaY: number) => {
            this.adjustCameraZoom(-deltaY * ZOOM_STEP, pointer);
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

    private createBuildMenuConfigs(): BuildingConfig[] {
        return [
            Barracks.getConfig(),
            House.getConfig(),
            Storehouse.getConfig(),
            Tower.getConfig()
        ];
    }

    private getPopulationLabel() {
        return `Population: ${this.currentPopulation}/${this.populationCap}`;
    }

    private createBuildMenu(anchorX: number, startY: number) {
        const spacing = 48;
        const buttonWidth = 240;

        this.buildMenuConfigs.forEach((config, index) => {
            const y = startY + index * spacing;
            const buttonContainer = this.add.container(anchorX, y).setScrollFactor(0);

            const background = this.add
                .rectangle(0, 0, buttonWidth, 40, 0x004c99, 1)
                .setOrigin(1, 0)
                .setStrokeStyle(2, 0x003366);
            const label = this.add
                .text(-10, 8, `${config.name} (${config.cost})`, {
                    fontSize: '14px',
                    color: '#ffffff',
                })
                .setOrigin(1, 0);
            const preview = this.add.rectangle(-buttonWidth + 30, 20, 24, 24, config.color, 1).setOrigin(0.5);
            const description = this.add
                .text(-buttonWidth + 52, 8, config.description ?? 'No description', {
                    fontSize: '12px',
                    color: '#cce6ff',
                    wordWrap: { width: 160 },
                })
                .setOrigin(0, 0);

            buttonContainer.add([background, preview, label, description]);

            buttonContainer.setSize(buttonWidth, 40);
            buttonContainer.setInteractive({ useHandCursor: true });

            buttonContainer.on('pointerover', () => {
                background.setFillStyle(0x005fb3);
            });

            buttonContainer.on('pointerout', () => {
                background.setFillStyle(0x004c99);
            });

            buttonContainer.on('pointerdown', () => {
                this.startPlacement(config);
            });
        });
    }

    private addDropOffPoint(position: Phaser.Math.Vector2) {
        this.dropOffPoints.push(position.clone());
        const marker = this.add
            .circle(position.x, position.y, 18, 0x1e90ff, 0.25)
            .setStrokeStyle(2, 0x00bfff)
            .setDepth(2);
        this.dropOffMarkers.push(marker);
    }

    private initializeResourceManager() {
        for (let i = 0; i < this.resourceManagerConfig.initialSpawnCount; i++) {
            this.spawnProceduralResourceNode();
        }

        this.startResourceRespawnLoop();
    }

    private startResourceRespawnLoop() {
        if (this.resourceRespawnTimer) {
            return;
        }

        this.resourceRespawnTimer = this.time.addEvent({
            delay: this.resourceManagerConfig.respawnIntervalMs,
            loop: true,
            callback: () => this.spawnResourceNodesForInterval(),
        });
    }

    private spawnResourceNodesForInterval() {
        const openSlots = Math.max(0, this.resourceManagerConfig.maxActiveNodes - this.resourceNodes.length);
        const nodesToSpawn = Math.min(this.resourceManagerConfig.nodesPerInterval, openSlots);

        let spawned = 0;
        for (let i = 0; i < nodesToSpawn; i++) {
            const node = this.spawnProceduralResourceNode();
            if (node) {
                spawned++;
            }
        }

        if (spawned > 0) {
            this.announceNewResourceNodes(spawned);
        }
    }

    private spawnProceduralResourceNode(): ResourceNode | undefined {
        const attempts = 30;
        for (let i = 0; i < attempts; i++) {
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const distance = Phaser.Math.Between(
                this.resourceManagerConfig.minDistanceFromBase,
                this.resourceManagerConfig.maxDistanceFromBase,
            );

            const targetX = this.basePosition.x + Math.cos(angle) * distance;
            const targetY = this.basePosition.y + Math.sin(angle) * distance;

            const snappedX = Phaser.Math.Snap.To(targetX, this.gridSize);
            const snappedY = Phaser.Math.Snap.To(targetY, this.gridSize);

            const clampedX = Phaser.Math.Clamp(snappedX, 20, WORLD_WIDTH - 20);
            const clampedY = Phaser.Math.Clamp(snappedY, 20, WORLD_HEIGHT - 20);

            if (!this.isValidResourceSpawn(clampedX, clampedY)) {
                continue;
            }

            return this.createResourceNode(clampedX, clampedY);
        }

        return undefined;
    }

    private isValidResourceSpawn(x: number, y: number) {
        const distanceToBase = Phaser.Math.Distance.Between(x, y, this.basePosition.x, this.basePosition.y);
        if (
            distanceToBase < this.resourceManagerConfig.minDistanceFromBase ||
            distanceToBase > this.resourceManagerConfig.maxDistanceFromBase
        ) {
            return false;
        }

        if (this.getBaseSpawnArea().contains(x, y)) {
            return false;
        }

        const nodeBounds = new Phaser.Geom.Rectangle(x - 22, y - 22, 44, 44);

        const overlapsSite = this.constructionSites.some((site) => {
            const bounds = site.base.getBounds();
            return Phaser.Geom.Intersects.RectangleToRectangle(nodeBounds, bounds);
        });

        if (overlapsSite) {
            return false;
        }

        const overlapsBuilding = this.placedBuildings.some((building) => {
            const sprite = building.getSprite();
            if (!sprite) return false;
            const bounds = sprite.getBounds();
            return Phaser.Geom.Intersects.RectangleToRectangle(nodeBounds, bounds);
        });

        if (overlapsBuilding) {
            return false;
        }

        const collidesWithNode = this.resourceNodes.some((node) => {
            const distanceToNode = Phaser.Math.Distance.Between(x, y, node.sprite.x, node.sprite.y);
            return distanceToNode < this.resourceManagerConfig.minDistanceBetweenNodes;
        });

        return !collidesWithNode;
    }

    private announceNewResourceNodes(count: number) {
        const message =
            count === 1
                ? 'A new resource node has appeared nearby.'
                : `${count} new resource nodes have appeared around your base.`;
        this.showFeedback(message);
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

        this.populationText = this.add
            .text(width - 10, 40, this.getPopulationLabel(), {
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 8, y: 4 },
            })
            .setOrigin(1, 0)
            .setScrollFactor(0);

        this.createBuildMenu(width - 10, 70);

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

        this.spawnWorkerButton = this.add
            .text(10, 50, '', {
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#3366cc',
                padding: { x: 10, y: 5 },
            })
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });

        this.spawnWorkerButton.on('pointerover', () => {
            this.spawnWorkerButton.setStyle({ backgroundColor: '#3355aa' });
        });

        this.spawnWorkerButton.on('pointerout', () => {
            this.spawnWorkerButton.setStyle({ backgroundColor: '#3366cc' });
        });

        this.spawnWorkerButton.on('pointerdown', () => {
            this.queueWorkerTraining();
        });

        this.idleWorkerButton = this.add
            .text(10, 90, 'Next Idle Worker (.)', {
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#228b22',
                padding: { x: 10, y: 5 },
            })
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });

        this.idleWorkerButton.on('pointerover', () => {
            this.idleWorkerButton.setStyle({ backgroundColor: '#2fa82f' });
        });

        this.idleWorkerButton.on('pointerout', () => {
            this.idleWorkerButton.setStyle({ backgroundColor: '#228b22' });
        });

        this.idleWorkerButton.on('pointerdown', () => {
            this.selectNextIdleWorker();
        });

        this.gatherNearestButton = this.add
            .text(10, 130, 'Gather Nearest', {
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#8b8b00',
                padding: { x: 10, y: 5 },
            })
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });

        this.gatherNearestButton.on('pointerover', () => {
            this.gatherNearestButton.setStyle({ backgroundColor: '#a3a300' });
        });

        this.gatherNearestButton.on('pointerout', () => {
            this.gatherNearestButton.setStyle({ backgroundColor: '#8b8b00' });
        });

        this.gatherNearestButton.on('pointerdown', () => {
            this.commandGatherNearest();
        });

        this.autoGatherButton = this.add
            .text(10, 170, '', {
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#444444',
                padding: { x: 10, y: 5 },
            })
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });

        this.autoGatherButton.on('pointerover', () => {
            const highlightColor = this.autoGatherEnabled ? '#6bbd42' : '#5a5a5a';
            this.autoGatherButton.setStyle({ backgroundColor: highlightColor });
        });

        this.autoGatherButton.on('pointerout', () => {
            this.updateAutoGatherButtonState();
        });

        this.autoGatherButton.on('pointerdown', () => {
            this.toggleAutoGather();
        });

        this.updateAutoGatherButtonState();

        this.trainingStatusText = this.add
            .text(10, 210, '', {
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: '#1a1a1a',
                padding: { x: 10, y: 6 },
                wordWrap: { width: 280 },
            })
            .setScrollFactor(0);

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

        this.updateTrainingUI();
    }

    private initializeScenarioGoals() {
        this.scenarioGoals = [
            {
                id: 'resources',
                description: 'Reach 200 resources',
                current: this.resources,
                target: 200,
                completed: this.resources >= 200,
            },
            {
                id: 'houses',
                description: 'Build 2 Houses',
                current: 0,
                target: 2,
                completed: false,
            },
            {
                id: 'storehouses',
                description: 'Build 1 Storehouse',
                current: 0,
                target: 1,
                completed: false,
            },
            {
                id: 'workers',
                description: 'Train 4 Workers',
                current: 0,
                target: 4,
                completed: false,
            },
        ];

        this.scenarioEndTime = this.time.now + this.scenarioDurationMs;
        this.createScenarioPanel();
        this.refreshGoalPanel();
        this.updateScenarioTimer();
        this.checkScenarioCompletion();
    }

    private createScenarioPanel() {
        const panelWidth = 280;
        const headerHeight = 28;
        this.scenarioPanel = this.add.container(10, 140).setScrollFactor(0);

        this.scenarioPanelBackground = this.add
            .rectangle(0, 0, panelWidth, 200, 0x000000, 0.55)
            .setOrigin(0, 0);

        const title = this.add.text(10, 6, 'Scenario Goals', {
            fontSize: '16px',
            color: '#f0f8ff',
            fontStyle: 'bold',
        });

        this.scenarioPanel.add([this.scenarioPanelBackground, title]);

        this.goalTextMap.clear();
        let offsetY = headerHeight;
        this.scenarioGoals.forEach((goal) => {
            const text = this.add.text(10, offsetY, '', {
                fontSize: '13px',
                color: '#ffffff',
                wordWrap: { width: panelWidth - 20 },
            });
            this.goalTextMap.set(goal.id, text);
            this.scenarioPanel?.add(text);
            offsetY += 24;
        });

        this.scenarioTimerText = this.add.text(10, offsetY + 4, '', {
            fontSize: '12px',
            color: '#dcdcdc',
        });
        this.scenarioPanel.add(this.scenarioTimerText);

        this.scenarioPanelBackground.height = offsetY + 36;
    }

    private refreshGoalPanel() {
        let offsetY = 28;
        this.scenarioGoals.forEach((goal) => {
            const text = this.goalTextMap.get(goal.id);
            if (!text) return;

            const progress = `${Math.min(goal.current, goal.target)}/${goal.target}`;
            text.setText(`${goal.description}: ${progress}${goal.completed ? ' ✓' : ''}`);
            text.setColor(goal.completed ? '#9cff9c' : '#ffffff');
            text.y = offsetY;
            offsetY += 24;
        });

        if (this.scenarioTimerText) {
            this.scenarioTimerText.y = offsetY + 4;
        }

        if (this.scenarioPanelBackground) {
            this.scenarioPanelBackground.height = offsetY + 36;
        }
    }

    private updateScenarioGoal(type: ScenarioGoalType, value: number) {
        const goal = this.scenarioGoals.find((candidate) => candidate.id === type);
        if (!goal) {
            return;
        }

        if (type === 'resources') {
            goal.current = Math.max(goal.current, value);
        } else {
            goal.current = Math.min(goal.target, value);
        }

        if (!goal.completed && goal.current >= goal.target) {
            goal.completed = true;
            this.showFeedback(`Goal completed: ${goal.description}`);
        }

        this.refreshGoalPanel();
        this.checkScenarioCompletion();
    }

    private updateScenarioTimer() {
        if (this.scenarioCompleted || this.scenarioFailed) {
            return;
        }

        const remainingMs = this.scenarioEndTime - this.time.now;

        if (remainingMs <= 0) {
            this.handleScenarioFailure();
            return;
        }

        const remainingSeconds = Math.ceil(remainingMs / 1000);
        this.scenarioTimerText?.setText(`Time remaining: ${remainingSeconds}s`);
    }

    private checkScenarioCompletion() {
        if (this.scenarioCompleted || this.scenarioFailed) {
            return;
        }

        const allComplete = this.scenarioGoals.every((goal) => goal.completed);
        if (allComplete) {
            this.scenarioCompleted = true;
            this.showScenarioResult('Objectives complete! Great job.', '#2fa82f');
        }
    }

    private handleScenarioFailure() {
        if (this.scenarioCompleted || this.scenarioFailed) {
            return;
        }

        this.scenarioFailed = true;
        this.showScenarioResult('Objectives failed: time expired.', '#ff6666');
    }

    private showScenarioResult(message: string, color: string) {
        if (this.scenarioResultContainer) {
            return;
        }

        const { width, height } = this.scale;
        const container = this.add.container(width / 2, height / 2).setScrollFactor(0);
        const background = this.add.rectangle(0, 0, 420, 160, 0x000000, 0.8).setOrigin(0.5);
        background.setStrokeStyle(2, 0xffffff, 0.7);

        const label = this.add
            .text(0, -30, message, {
                fontSize: '18px',
                color,
                fontStyle: 'bold',
                align: 'center',
                wordWrap: { width: 360 },
            })
            .setOrigin(0.5);

        const menuButton = this.add
            .text(0, 30, 'Return to Menu', {
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#333333',
                padding: { x: 14, y: 8 },
            })
            .setOrigin(0.5)
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

        container.add([background, label, menuButton]);
        this.scenarioResultContainer = container;
    }

    private queueWorkerTraining() {
        if (!this.selectedBuilding || !this.canTrainWorkers(this.selectedBuilding)) {
            this.showFeedback('Select a production building to train workers.');
            this.setSpawnWorkerButtonState('Select a production building to train workers', false);
            return;
        }

        const queue = this.trainingQueues.get(this.selectedBuilding);
        if (!queue) {
            this.showFeedback('Selected building is not ready to train units.');
            return;
        }

        if (this.currentPopulation >= this.populationCap) {
            this.showFeedback('Cannot train: population cap reached.');
            this.updateTrainingUI();
            return;
        }

        if (this.resources < this.workerCost) {
            this.showFeedback('Not enough resources to train a worker.');
            this.pulseResourceText();
            this.updateTrainingUI();
            return;
        }

        this.resources -= this.workerCost;
        this.updateResourceText();

        queue.pending += 1;
        if (!queue.activeTimer) {
            this.beginTraining(queue);
        } else {
            this.updateTrainingUI();
        }
    }

    private beginTraining(queue: TrainingQueueState) {
        if (queue.pending <= 0 || queue.activeTimer) {
            return;
        }

        queue.pending -= 1;
        queue.currentCompleteTime = this.time.now + this.workerProductionTimeMs;
        queue.activeTimer = this.time.delayedCall(this.workerProductionTimeMs, () => {
            this.completeWorkerTraining(queue);
        });
        this.updateTrainingUI();
    }

    private completeWorkerTraining(queue: TrainingQueueState) {
        queue.activeTimer = undefined;
        queue.currentCompleteTime = undefined;
        this.createWorker(queue.spawnPoint);
        if (queue.pending > 0) {
            this.beginTraining(queue);
        } else {
            this.updateTrainingUI();
        }
    }

    private createWorker(spawnPoint?: Phaser.Math.Vector2) {
        const spawnPosition = spawnPoint ? spawnPoint.clone() : this.basePosition.clone();
        const jitter = new Phaser.Math.Vector2(Phaser.Math.Between(-12, 12), Phaser.Math.Between(-12, 12));
        const worker = new Worker(
            this,
            spawnPosition.x + jitter.x,
            spawnPosition.y + jitter.y,
            this.gridSize,
            () => this.dropOffPoints,
            (amount) => this.depositResource(amount),
            (node) => this.updateResourceLabel(node),
            (node) => this.handleResourceDepleted(node),
            (position) => this.findNearestResource(position),
        );

        worker.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (!pointer.rightButtonDown()) {
                this.selectWorker(worker);
            }
        });

        this.workers.push(worker);
        this.currentPopulation += 1;
        this.updatePopulationText();
        this.trackWorker(worker);
        worker.setAutoGatherEnabled(this.autoGatherEnabled);
        this.selectWorker(worker);
        this.updateScenarioGoal('workers', this.workers.length);
    }

    private selectWorker(worker: Worker) {
        this.clearSelectedBuilding();
        this.selectedWorker?.setSelected(false);
        this.selectedWorker = worker;
        this.selectedWorker.setSelected(true);
        this.updateTrainingUI();
    }

    private clearSelectedWorker() {
        if (this.selectedWorker) {
            this.selectedWorker.setSelected(false);
        }
        this.selectedWorker = undefined;
    }

    private clearSelectedBuilding() {
        if (this.selectedBuilding) {
            this.selectedBuilding.setSelected(false);
        }
        this.selectedBuilding = undefined;
    }

    private selectBuilding(building: Building) {
        if (this.selectedBuilding === building) {
            return;
        }

        this.clearSelectedWorker();
        this.selectedBuilding?.setSelected(false);
        this.selectedBuilding = building;
        this.selectedBuilding.setSelected(true);
        this.updateTrainingUI();
    }

    private configureBuilding(building: Building) {
        building.setSelectionHandler((selectedBuilding) => this.selectBuilding(selectedBuilding));

        if (this.canTrainWorkers(building)) {
            this.registerProductionBuilding(building);
        }
    }

    private canTrainWorkers(building?: Building): building is Building {
        return Boolean(building?.getConfig().canTrainWorkers);
    }

    private registerProductionBuilding(building: Building) {
        const spawnPoint = this.getSpawnPointForBuilding(building);
        this.trainingQueues.set(building, {
            building,
            pending: 0,
            spawnPoint,
        });
        this.updateTrainingUI();
    }

    private getSpawnPointForBuilding(building: Building): Phaser.Math.Vector2 {
        const position = building.getPosition() ?? this.basePosition;
        const config = building.getConfig();
        const spawnOffset = new Phaser.Math.Vector2(config.width / 2 + 30, 0);

        return position.clone().add(spawnOffset);
    }

    private trackWorker(worker: Worker) {
        if (worker.state === WorkerState.Idle) {
            this.idleWorkers.add(worker);
        }

        worker.on('stateChanged', (newState: WorkerStateType) => {
            if (newState === WorkerState.Idle) {
                this.idleWorkers.add(worker);
            } else {
                this.idleWorkers.delete(worker);
            }
        });
    }

    private selectNextIdleWorker() {
        const idleWorkers = Array.from(this.idleWorkers);

        if (!idleWorkers.length) {
            this.showFeedback('No idle workers available.');
            return;
        }

        const currentIndex = this.selectedWorker ? idleWorkers.indexOf(this.selectedWorker) : -1;
        const nextIndex = (currentIndex + 1) % idleWorkers.length;
        const worker = idleWorkers[nextIndex];

        this.selectWorker(worker);
        this.centerCameraOn(worker.x, worker.y);
    }

    private commandGatherNearest() {
        if (!this.selectedWorker) {
            this.showFeedback('Select a worker to gather.');
            return;
        }

        const success = this.selectedWorker.gatherNearestAvailable();
        if (!success) {
            this.showFeedback('No available resource nodes to gather.');
        }
    }

    private toggleAutoGather() {
        this.autoGatherEnabled = !this.autoGatherEnabled;
        this.applyAutoGatherState();
    }

    private applyAutoGatherState() {
        this.updateAutoGatherButtonState();
        this.workers.forEach((worker) => worker.setAutoGatherEnabled(this.autoGatherEnabled));
    }

    private updateAutoGatherButtonState() {
        const backgroundColor = this.autoGatherEnabled ? '#5f9e3c' : '#444444';
        const label = this.autoGatherEnabled ? 'Auto-Gather: ON' : 'Auto-Gather: OFF';

        if (this.autoGatherButton) {
            this.autoGatherButton.setText(label);
            this.autoGatherButton.setStyle({ backgroundColor });
        }
    }

    private centerCameraOn(x: number, y: number) {
        this.cameras.main.centerOn(x, y);
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

    private createResourceNode(x: number, y: number, amount: number = 100) {
        const resource = this.add.circle(x, y, 20, 0xffd700);
        resource.setStrokeStyle(2, 0xffff00);
        resource.setInteractive({ useHandCursor: true });

        const label = this.add
            .text(x, y - 35, `${amount}`, {
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
            amount,
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

        return node;
    }

    private findNearestResource(position: Phaser.Math.Vector2): ResourceNode | undefined {
        let nearest: ResourceNode | undefined;
        let shortest = Number.POSITIVE_INFINITY;

        this.resourceNodes.forEach((node) => {
            if (node.amount <= 0) {
                return;
            }

            const distance = Phaser.Math.Distance.Between(position.x, position.y, node.sprite.x, node.sprite.y);
            if (distance < shortest) {
                shortest = distance;
                nearest = node;
            }
        });

        return nearest;
    }

    private updateResourceLabel(node: ResourceNode) {
        node.label.setText(node.amount > 0 ? `${node.amount}` : 'Depleted');
        const labelColor = node.amount <= 0 ? '#ff6666' : node.amount <= 25 ? '#ffe066' : '#ffffff';
        node.label.setColor(labelColor);
    }

    private handleResourceDepleted(node: ResourceNode) {
        node.sprite.disableInteractive();
        this.updateResourceLabel(node);
        this.resourceNodes = this.resourceNodes.filter((existingNode) => existingNode.id !== node.id);

        this.showFeedback('A resource node has been depleted. Scouting for new deposits...');
        this.startResourceRespawnLoop();

        this.workers.forEach((worker) => worker.handleDepletedNode(node));
    }

    private depositResource(amount: number) {
        this.resources += amount;
        this.updateResourceText();
        this.updateScenarioGoal('resources', this.resources);
    }

    update(_time: number, delta: number) {
        this.handleCameraControls(delta);
        this.workers.forEach((worker) => worker.update());
        this.updateTrainingUI();
        this.updateConstructionSites(delta);
        this.updateScenarioTimer();
    }

    private handleCameraControls(delta: number) {
        const camera = this.cameras.main;
        const deltaSeconds = delta / 1000;
        const pointer = this.input.activePointer;

        let moveX = 0;
        let moveY = 0;
        let zoomDelta = 0;

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

        if (this.zoomKeys.Q.isDown) {
            zoomDelta -= KEYBOARD_ZOOM_RATE * ZOOM_STEP * deltaSeconds;
        }

        if (this.zoomKeys.E.isDown) {
            zoomDelta += KEYBOARD_ZOOM_RATE * ZOOM_STEP * deltaSeconds;
        }

        const maxScrollX = Math.max(WORLD_WIDTH - camera.displayWidth, 0);
        const maxScrollY = Math.max(WORLD_HEIGHT - camera.displayHeight, 0);

        camera.scrollX = Phaser.Math.Clamp(camera.scrollX + moveX * deltaSeconds, 0, maxScrollX);
        camera.scrollY = Phaser.Math.Clamp(camera.scrollY + moveY * deltaSeconds, 0, maxScrollY);

        if (zoomDelta !== 0) {
            this.adjustCameraZoom(zoomDelta, pointer);
        }
    }

    private adjustCameraZoom(deltaZoom: number, pointer?: Phaser.Input.Pointer) {
        const camera = this.cameras.main;
        const previousZoom = camera.zoom;
        const targetZoom = Phaser.Math.Clamp(previousZoom + deltaZoom, MIN_ZOOM, MAX_ZOOM);

        if (targetZoom === previousZoom) {
            return;
        }

        const pointerWorldBefore = pointer ? camera.getWorldPoint(pointer.x, pointer.y) : undefined;

        camera.setZoom(targetZoom);

        const maxScrollX = Math.max(WORLD_WIDTH - camera.displayWidth, 0);
        const maxScrollY = Math.max(WORLD_HEIGHT - camera.displayHeight, 0);

        if (pointerWorldBefore && pointer) {
            const pointerWorldAfter = camera.getWorldPoint(pointer.x, pointer.y);
            const offsetX = pointerWorldBefore.x - pointerWorldAfter.x;
            const offsetY = pointerWorldBefore.y - pointerWorldAfter.y;

            camera.setScroll(
                Phaser.Math.Clamp(camera.scrollX + offsetX, 0, maxScrollX),
                Phaser.Math.Clamp(camera.scrollY + offsetY, 0, maxScrollY),
            );
        } else {
            camera.setScroll(
                Phaser.Math.Clamp(camera.scrollX, 0, maxScrollX),
                Phaser.Math.Clamp(camera.scrollY, 0, maxScrollY),
            );
        }
    }

    private startPlacement(config: BuildingConfig) {
        this.currentPlacement = config;
        this.feedbackText?.setVisible(false);
        const buildDuration = config.buildTime > 0 ? `${config.buildTime / 1000}s to complete` : 'instant build';
        this.placementInfoText?.setText(
            `Placing ${config.name} | Cost: ${config.cost} (paid upfront) | ${buildDuration} | Left-click to place, Right-click to cancel`,
        );
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
        const validation = this.validatePlacement(snappedX, snappedY, this.currentPlacement);
        const hasResources = this.resources >= this.currentPlacement.cost;
        const validPlacement = validation.valid && hasResources;

        const strokeColor = !hasResources
            ? 0xff0000
            : validation.type === 'resource'
                ? 0xffa500
                : validation.type === 'baseZone'
                    ? 0xff00ff
                    : validation.valid
                        ? 0x00ff00
                        : 0xff0000;

        this.placementPreview.setStrokeStyle(2, strokeColor);
        this.placementPreview.setFillStyle(this.currentPlacement.color, validPlacement ? 0.35 : 0.2);

        if (!hasResources) {
            this.showFeedback('Not enough resources');
        } else if (!validation.valid && validation.reason) {
            this.showFeedback(validation.reason);
        } else {
            this.feedbackText?.setVisible(false);
        }
    }

    private validatePlacement(
        x: number,
        y: number,
        config: BuildingConfig,
        options: { checkBaseZone?: boolean } = {},
    ): PlacementValidationResult {
        const previewBounds = new Phaser.Geom.Rectangle(
            x - config.width / 2,
            y - config.height / 2,
            config.width,
            config.height,
        );

        const resourceCollision = this.resourceNodes.find((node) => {
            const nodeBounds = node.sprite.getBounds();
            return Phaser.Geom.Intersects.RectangleToRectangle(previewBounds, nodeBounds);
        });

        if (resourceCollision) {
            return { valid: false, reason: 'Cannot place: overlaps resource node', type: 'resource' };
        }

        if (options.checkBaseZone !== false) {
            const baseZone = this.getBaseSpawnArea();
            if (Phaser.Geom.Intersects.RectangleToRectangle(previewBounds, baseZone)) {
                return { valid: false, reason: 'Cannot place: blocks base spawn area', type: 'baseZone' };
            }
        }

        const collidesWithSites = this.constructionSites.some((site) => {
            const bounds = site.base.getBounds();
            return Phaser.Geom.Intersects.RectangleToRectangle(previewBounds, bounds);
        });

        if (collidesWithSites) {
            return { valid: false, reason: 'Cannot place: collision with construction site', type: 'building' };
        }

        const buildingCollision = this.placedBuildings.some((building) => {
            const sprite = building.getSprite();
            if (!sprite) return false;
            const bounds = sprite.getBounds();
            return Phaser.Geom.Intersects.RectangleToRectangle(previewBounds, bounds);
        });

        if (buildingCollision) {
            return { valid: false, reason: 'Cannot place: collision with existing building', type: 'building' };
        }

        return { valid: true };
    }

    private getBaseSpawnArea() {
        const zoneSize = 200;
        return new Phaser.Geom.Rectangle(
            this.basePosition.x - zoneSize / 2,
            this.basePosition.y - zoneSize / 2,
            zoneSize,
            zoneSize,
        );
    }

    private confirmPlacement() {
        if (!this.currentPlacement || !this.placementPreview) {
            return;
        }

        const { x, y } = this.placementPreview;
        const validation = this.validatePlacement(x, y, this.currentPlacement);
        if (!validation.valid) {
            this.showFeedback(validation.reason ?? 'Cannot place here. Please choose another spot.');
            return;
        }

        if (this.resources < this.currentPlacement.cost) {
            this.showFeedback('Insufficient resources to construct this building.');
            this.pulseResourceText();
            return;
        }

        this.resources -= this.currentPlacement.cost;
        this.updateResourceText();

        const site = this.createConstructionSite(x, y, this.currentPlacement);
        this.constructionSites.push(site);

        if (site.totalTime <= 0) {
            this.completeConstruction(site);
        } else {
            if (this.selectedWorker) {
                this.assignWorkerToSite(site, this.selectedWorker);
                this.showFeedback(`Construction started. ${site.config.buildTime / 1000}s build time.`);
            } else {
                this.updateConstructionText(site);
                this.showFeedback('Construction site placed. Assign a worker to begin building.');
            }
        }

        this.cancelPlacement();
    }

    private cancelPlacement() {
        this.currentPlacement = undefined;
        this.placementPreview?.setVisible(false);
        this.placementInfoText?.setVisible(false);
        this.feedbackText?.setVisible(false);
    }

    private updateResourceText() {
        this.resourceText.setText(`Resources: ${this.resources}`);
        this.updateTrainingUI();
    }

    private updatePopulationText() {
        this.populationText.setText(this.getPopulationLabel());
        this.updateTrainingUI();
    }

    private setSpawnWorkerButtonState(label: string, enabled: boolean) {
        this.spawnWorkerButton.setText(label);

        if (enabled) {
            this.spawnWorkerButton
                .setInteractive({ useHandCursor: true })
                .setStyle({ backgroundColor: '#3366cc', color: '#ffffff' });
        } else {
            this.spawnWorkerButton.disableInteractive();
            this.spawnWorkerButton.setStyle({ backgroundColor: '#555555', color: '#cccccc' });
        }
    }

    private updateTrainingUI() {
        if (!this.trainingStatusText || !this.spawnWorkerButton) {
            return;
        }

        const selectedBuilding = this.selectedBuilding;

        if (!this.canTrainWorkers(selectedBuilding)) {
            this.setSpawnWorkerButtonState('Select a Base to train workers', false);
            this.trainingStatusText.setText('No production building selected.');
            return;
        }

        const buildingName = selectedBuilding.getConfig().name;
        const queue = this.trainingQueues.get(selectedBuilding);

        if (!queue) {
            this.setSpawnWorkerButtonState(`${buildingName} cannot train workers right now`, false);
            this.trainingStatusText.setText(`${buildingName} is not ready to train units.`);
            return;
        }

        const queueCount = queue.pending + (queue.activeTimer ? 1 : 0);
        const capacityReached = this.currentPopulation >= this.populationCap;
        const hasResources = this.resources >= this.workerCost;
        const canTrain = hasResources && !capacityReached;

        this.setSpawnWorkerButtonState(`Train Worker (${this.workerCost}) - ${buildingName}`, canTrain);

        const statusParts: string[] = [`Training at ${buildingName}`, `Queue: ${queueCount}`];

        if (queue.activeTimer && queue.currentCompleteTime) {
            const remainingMs = Math.max(0, queue.currentCompleteTime - this.time.now);
            statusParts.push(`Next in ${(remainingMs / 1000).toFixed(1)}s`);
        } else if (queueCount === 0) {
            statusParts.push('Idle');
        }

        if (!hasResources) {
            statusParts.push('Need more resources');
        }

        if (capacityReached) {
            statusParts.push('Population cap reached');
        }

        this.trainingStatusText.setText(statusParts.join(' | '));
    }

    private showFeedback(message: string) {
        if (!this.feedbackText) {
            return;
        }

        this.feedbackText.setText(message);
        this.feedbackText.setVisible(true);
    }

    private createConstructionSite(x: number, y: number, config: BuildingConfig): ConstructionSite {
        const container = this.add.container(x, y);
        const base = this.add.rectangle(0, 0, config.width, config.height, config.color, 0.25);
        base.setStrokeStyle(2, 0xffff00);

        const progressBackground = this.add
            .rectangle(0, config.height / 2 + 12, config.width, 10, 0x000000, 0.6)
            .setOrigin(0.5);
        const progressBar = this.add
            .rectangle(-config.width / 2, progressBackground.y, 0, 8, 0x00ff00, 0.8)
            .setOrigin(0, 0.5);
        const progressText = this.add
            .text(0, progressBackground.y - 18, '', {
                fontSize: '12px',
                color: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 4, y: 2 },
            })
            .setOrigin(0.5);

        container.add([base, progressBackground, progressBar, progressText]);
        container.setSize(config.width, config.height + 30);
        container.setInteractive(
            new Phaser.Geom.Rectangle(-config.width / 2, -config.height / 2, config.width, config.height + 30),
            (rect: Phaser.Geom.Rectangle, x: number, y: number) => Phaser.Geom.Rectangle.Contains(rect, x, y),
        );

        const requiresWorker = config.buildTime > 0;
        const site: ConstructionSite = {
            config,
            position: new Phaser.Math.Vector2(x, y),
            container,
            base,
            progressBar,
            progressBackground,
            progressText,
            remainingTime: config.buildTime,
            totalTime: config.buildTime,
            requiresWorker,
        };

        container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonDown()) {
                this.cancelConstructionSite(site);
            } else if (this.selectedWorker) {
                this.assignWorkerToSite(site, this.selectedWorker);
            }
        });

        this.updateConstructionText(site);
        return site;
    }

    private assignWorkerToSite(site: ConstructionSite, worker: Worker) {
        this.unassignWorkerFromOtherSites(worker, site);

        if (site.assignedWorker === worker) {
            return;
        }

        if (site.assignedWorker) {
            site.assignedWorker.releaseFromConstruction();
        }

        site.assignedWorker = worker;
        worker.assignConstruction(
            site.position,
            () => this.updateConstructionText(site),
            () => {
                site.assignedWorker = undefined;
                this.updateConstructionText(site);
            },
        );
        this.updateConstructionText(site);
    }

    private unassignWorkerFromOtherSites(worker: Worker, targetSite: ConstructionSite) {
        this.constructionSites.forEach((otherSite) => {
            if (otherSite === targetSite) {
                return;
            }

            if (otherSite.assignedWorker === worker) {
                otherSite.assignedWorker = undefined;
                this.updateConstructionText(otherSite);
            }
        });
    }

    private updateConstructionSites(delta: number) {
        this.constructionSites.slice().forEach((site) => {
            if (site.totalTime <= 0) {
                this.completeConstruction(site);
                return;
            }

            const canBuild =
                !site.requiresWorker || (site.assignedWorker && site.assignedWorker.state === WorkerState.Building);
            if (canBuild && site.remainingTime > 0) {
                site.remainingTime = Math.max(0, site.remainingTime - delta);
                const progress = Phaser.Math.Clamp(1 - site.remainingTime / site.totalTime, 0, 1);
                site.progressBar.width = site.config.width * progress;
                this.updateConstructionText(site);

                if (site.remainingTime <= 0) {
                    this.completeConstruction(site);
                }
            } else {
                this.updateConstructionText(site);
            }
        });
    }

    private updateConstructionText(site: ConstructionSite) {
        if (site.totalTime <= 0) {
            site.progressText.setText('Completing...');
            return;
        }

        if (site.requiresWorker && (!site.assignedWorker || site.assignedWorker.state !== WorkerState.Building)) {
            site.progressText.setText('Awaiting worker');
            site.progressBar.width = 0;
            return;
        }

        const remainingSeconds = Math.max(0, Math.ceil(site.remainingTime / 1000));
        site.progressText.setText(`Building... ${remainingSeconds}s`);
    }

    private cancelConstructionSite(site: ConstructionSite) {
        this.constructionSites = this.constructionSites.filter((candidate) => candidate !== site);
        site.container.destroy();
        site.assignedWorker?.releaseFromConstruction();
        this.resources += site.config.cost;
        this.updateResourceText();
        this.showFeedback('Construction cancelled. Resources refunded.');
    }

    private completeConstruction(site: ConstructionSite) {
        this.constructionSites = this.constructionSites.filter((candidate) => candidate !== site);
        site.container.destroy();

        const building = this.createBuildingFromConfig(site.config);
        building.create(site.position.x, site.position.y);
        this.configureBuilding(building);
        this.placedBuildings.push(building);
        site.assignedWorker?.releaseFromConstruction();
        this.applyBuildingEffects(site.config, site.position);

        if (site.config.name === 'House') {
            this.housesBuilt += 1;
            this.updateScenarioGoal('houses', this.housesBuilt);
        }

        if (site.config.name === 'Storehouse') {
            this.storehousesBuilt += 1;
            this.updateScenarioGoal('storehouses', this.storehousesBuilt);
        }

        this.showFeedback(`${site.config.name} completed.`);
    }

    private createBuildingFromConfig(config: BuildingConfig): Building {
        if (config.name === 'Barracks') {
            return new Barracks(this);
        }

        if (config.name === 'Base') {
            return new Base(this);
        }

        if (config.name === 'House') {
            return new House(this);
        }

        if (config.name === 'Storehouse') {
            return new Storehouse(this);
        }

        if (config.name === 'Tower') {
            return new Tower(this);
        }

        throw new Error(`Unknown building name: ${config.name} in createBuildingFromConfig`);
    }

    private applyBuildingEffects(config: BuildingConfig, position: Phaser.Math.Vector2) {
        // Support both populationBonus (new) and populationCapIncrease (legacy)
        const popIncrease = config.populationBonus ?? config.populationCapIncrease ?? 0;
        if (popIncrease > 0) {
            this.populationCap += popIncrease;
            this.updatePopulationText();
        }

        if (config.providesDropOff) {
            this.addDropOffPoint(position.clone());
        }
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
