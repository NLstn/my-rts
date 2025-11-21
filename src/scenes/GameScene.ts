import Phaser from 'phaser';
import { Building, type BuildingConfig } from '../buildings/Building';
import { Barracks } from '../buildings/Barracks';
import { Base } from '../buildings/Base';
import { House } from '../buildings/House';
import { Storehouse } from '../buildings/Storehouse';
import { Tower } from '../buildings/Tower';
import { ResourceManager, type ResourceManagerConfig, RESOURCE_CONFIGS } from '../services/ResourceManager';
import { type ResourceType, type WorkerStateType, Worker, WorkerState } from '../units/Worker';
import { TrainingManager } from '../services/TrainingManager';
import { type WorkerType } from '../types/WorkerType';
import { UIManager, type ResearchOption } from '../ui/UIManager';

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

interface HarvestBonusZone {
    center: Phaser.Math.Vector2;
    radius: number;
    multiplier: number;
}

export class GameScene extends Phaser.Scene {
    private resourceTotals: Record<ResourceType, number> = {
        wood: 100,
        stone: 60,
        food: 60,
    };

    private populationCap: number = 8;
    private currentPopulation: number = 0;

    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasdKeys!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
    private zoomKeys!: Record<'Q' | 'E', Phaser.Input.Keyboard.Key>;
    private readonly gridSize = 50;
    private placementPreview?: Phaser.GameObjects.Rectangle;
    private currentPlacement?: BuildingConfig;
    private placedBuildings: Building[] = [];
    private constructionSites: ConstructionSite[] = [];
    private basePosition: Phaser.Math.Vector2 = new Phaser.Math.Vector2(200, 200);
    private dropOffPoints: Phaser.Math.Vector2[] = [];
    private dropOffMarkers: Phaser.GameObjects.Shape[] = [];
    private buildMenuConfigs: BuildingConfig[] = [];
    private workers: Worker[] = [];
    private readonly idleWorkers: Set<Worker> = new Set();
    private trainingManager!: TrainingManager;
    private selectedWorker?: Worker;
    private selectedBuilding?: Building;
    private unlockedWorkerTypeIds: Set<string> = new Set(['worker']);
    private resourceManager!: ResourceManager;
    private readonly resourceManagerConfig: ResourceManagerConfig = {
        initialSpawnCount: 4,
        nodesPerInterval: 2,
        maxActiveNodes: 8,
        respawnIntervalMs: 12000,
        minDistanceFromBase: 250,
        maxDistanceFromBase: 900,
        minDistanceBetweenNodes: 200,
    };
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

    private carryCapacityBonus: number = 0;
    private buildSpeedBonusMultiplier: number = 1;

    private workerTypes: WorkerType[] = [];
    private selectedWorkerTypeIndex: number = 0;
    private harvestBonusZones: HarvestBonusZone[] = [];
    private passiveIncomeTimers: Phaser.Time.TimerEvent[] = [];

    private researchOptions: ResearchOption[] = [];
    private completedResearch: Set<string> = new Set();
    private uiManager!: UIManager;

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
        this.workerTypes = this.createWorkerTypes();
        this.researchOptions = this.createResearchOptions();
        this.trainingManager = this.createTrainingManager();

        this.uiManager = new UIManager(this, {
            onMainMenu: () => this.scene.start('MainMenuScene'),
            onStartPlacement: (config) => this.startPlacement(config),
            onQueueTraining: () => this.queueWorkerTraining(),
            onSelectNextIdleWorker: () => this.selectNextIdleWorker(),
            onGatherNearest: () => this.commandGatherNearest(),
            onToggleAutoGather: () => this.toggleAutoGather(),
            onCycleWorkerType: () => this.cycleWorkerType(),
            onStartResearch: (id) => this.startResearch(id),
        });
        this.uiManager.createHUD(this.buildMenuConfigs, this.researchOptions);
        this.uiManager.updateResourceTotals(this.resourceTotals);
        this.uiManager.updatePopulation(this.currentPopulation, this.populationCap);
        this.updateWorkerTypeToggle();
        this.updateTrainingUI();
        this.updateAutoGatherButtonState();

        // Sample base building
        const baseBuilding = new Base(this);
        baseBuilding.create(this.basePosition.x, this.basePosition.y);
        this.configureBuilding(baseBuilding);
        this.placedBuildings.push(baseBuilding);
        this.addDropOffPoint(this.basePosition.clone());

        this.resourceManager = new ResourceManager(this.resourceManagerConfig, {
            scene: this,
            gridSize: this.gridSize,
            basePosition: this.basePosition,
            worldBounds: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
            getBaseSpawnArea: () => this.getBaseSpawnArea(),
            getConstructionSites: () => this.constructionSites,
            getPlacedBuildings: () => this.placedBuildings,
            showFeedback: (message) => this.showFeedback(message),
            onNodeDepleted: (node) => this.workers.forEach((worker) => worker.handleDepletedNode(node)),
            onNodeRightClick: (node) => {
                if (!this.selectedWorker) {
                    return;
                }

                if (node.amount <= 0) {
                    const label = RESOURCE_CONFIGS[node.type].label;
                    this.showFeedback(`${label} node is depleted.`);
                    return;
                }

                this.selectedWorker.assignResource(node);
            },
        });
        this.resourceManager.initialize();

        this.generateStartingResources();
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
            .setScrollFactor(0)
            .setDepth(1000);

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

    private createTrainingManager() {
        return new TrainingManager(this, {
            defaultTrainingTimeMs: this.workerProductionTimeMs,
            getSpawnPoint: (building) => this.getSpawnPointForBuilding(building),
            getSelectedWorkerType: () => this.getSelectedWorkerType(),
            hasPopulationRoom: () => this.currentPopulation < this.populationCap,
            canAfford: (cost) => this.hasSufficientResource('wood', cost),
            spendResources: (cost) => {
                this.resourceTotals.wood -= cost;
                this.updateResourceText();
            },
            onPopulationIncrease: (amount) => {
                this.currentPopulation += amount;
                this.updatePopulationText();
            },
            onWorkerTrained: (spawnPoint, type) => this.createWorker(spawnPoint, type),
            onQueueUpdated: () => this.updateTrainingUI(),
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

    private createWorkerTypes(): WorkerType[] {
        return [
            {
                id: 'worker',
                name: 'Worker',
                cost: 25,
                color: 0xadd8e6,
                description: 'Generalist gatherer with balanced collection and construction.',
                harvestRate: 5,
                capacity: 25,
            },
            {
                id: 'engineer',
                name: 'Engineer',
                cost: 35,
                color: 0x9fa8da,
                description: 'Barracks-unlocked builder that constructs faster with light harvesting.',
                harvestRate: 4,
                capacity: 20,
                buildSpeedMultiplier: 1.25,
                trainingTime: 2500,
            },
        ];
    }

    private createResearchOptions(): ResearchOption[] {
        return [
            {
                id: 'carry-capacity',
                name: 'Expanded Packs',
                description: 'Workers carry +10 resources. Requires a Storehouse.',
                cost: 60,
                duration: 5000,
                requiresBuilding: 'Storehouse',
                status: 'locked',
                onComplete: () => this.applyCarryCapacityUpgrade(10),
            },
            {
                id: 'construction-drills',
                name: 'Construction Drills',
                description: 'Workers build 20% faster after drills at the Barracks.',
                cost: 70,
                duration: 5000,
                requiresBuilding: 'Barracks',
                status: 'locked',
                onComplete: () => this.applyBuildSpeedUpgrade(1.2),
            },
        ];
    }

    private hasSufficientResource(type: ResourceType, amount: number) {
        return this.resourceTotals[type] >= amount;
    }

    private addDropOffPoint(position: Phaser.Math.Vector2) {
        this.dropOffPoints.push(position.clone());
        const marker = this.add
            .circle(position.x, position.y, 18, 0x1e90ff, 0.25)
            .setStrokeStyle(2, 0x00bfff)
            .setDepth(2);
        this.dropOffMarkers.push(marker);
    }


    private getAvailableWorkerTypes(): WorkerType[] {
        return this.workerTypes.filter((type) => this.unlockedWorkerTypeIds.has(type.id));
    }

    private getSelectedWorkerType(): WorkerType {
        const available = this.getAvailableWorkerTypes();
        if (!available.length) {
            return this.workerTypes[0];
        }

        if (this.selectedWorkerTypeIndex >= available.length) {
            this.selectedWorkerTypeIndex = 0;
        }

        return available[this.selectedWorkerTypeIndex];
    }

    private cycleWorkerType() {
        const available = this.getAvailableWorkerTypes();
        if (!available.length) {
            return;
        }

        this.selectedWorkerTypeIndex = (this.selectedWorkerTypeIndex + 1) % available.length;
        this.updateWorkerTypeToggle();
        this.updateTrainingUI();
    }

    private updateWorkerTypeToggle() {
        const type = this.getSelectedWorkerType();
        const availableCount = this.getAvailableWorkerTypes().length;
        const suffix = availableCount > 1 ? ' (click to cycle)' : '';
        this.uiManager.setWorkerTypeLabel(`Training: ${type.name}${suffix}`, availableCount > 1);
    }

    private unlockWorkerTypes(typeIds: string[]) {
        let added = false;

        typeIds.forEach((id) => {
            if (!this.unlockedWorkerTypeIds.has(id)) {
                this.unlockedWorkerTypeIds.add(id);
                added = true;
            }
        });

        if (added) {
            this.showFeedback('New worker specializations are now available.');
            this.updateWorkerTypeToggle();
            this.updateTrainingUI();
        }
    }

    private refreshResearchAvailability() {
        this.researchOptions.forEach((option) => {
            if (option.status === 'completed' || option.status === 'inProgress') {
                return;
            }

            if (!option.requiresBuilding) {
                option.status = 'available';
                this.uiManager.updateResearchOption(option);
                return;
            }

            const requirementMet = this.placedBuildings.some((building) => building.getConfig().name === option.requiresBuilding);
            option.status = requirementMet ? 'available' : 'locked';
            this.uiManager.updateResearchOption(option);
        });
    }

    private startResearch(optionId: string) {
        const option = this.researchOptions.find((candidate) => candidate.id === optionId);
        if (!option || option.status !== 'available') return;

        if (!this.hasSufficientResource('wood', option.cost)) {
            this.showFeedback('Not enough wood for that research.');
            this.pulseResourceText();
            return;
        }

        this.resourceTotals.wood -= option.cost;
        this.updateResourceText();

        option.status = 'inProgress';
        option.remainingTime = option.duration;
        this.uiManager.updateResearchOption(option);

        option.timer = this.time.addEvent({
            delay: 100,
            loop: true,
            callback: () => {
                if (!option.remainingTime) return;
                option.remainingTime = Math.max(0, option.remainingTime - 100);
                this.uiManager.updateResearchOption(option);
                if (option.remainingTime <= 0) {
                    this.completeResearch(option);
                }
            },
        });
    }

    private completeResearch(option: ResearchOption) {
        option.status = 'completed';
        option.timer?.destroy();
        option.remainingTime = 0;
        this.completedResearch.add(option.id);
        option.onComplete();
        this.showFeedback(`${option.name} completed.`);
        this.uiManager.updateResearchOption(option);
    }

    private updateResearchProgress() {
        this.researchOptions.forEach((option) => {
            if (option.status === 'inProgress' && option.remainingTime !== undefined) {
                this.uiManager.updateResearchOption(option);
            }
        });
    }

    private applyCarryCapacityUpgrade(amount: number) {
        this.carryCapacityBonus += amount;
        this.workers.forEach((worker) => worker.increaseCapacity(amount));
    }

    private applyBuildSpeedUpgrade(multiplier: number) {
        this.buildSpeedBonusMultiplier = multiplier;
        this.workers.forEach((worker) => {
            const typeId = worker.getData('typeId') as string | undefined;
            const type = this.workerTypes.find((candidate) => candidate.id === typeId);
            const baseMultiplier = type?.buildSpeedMultiplier ?? 1;
            worker.setBuildSpeedMultiplier(baseMultiplier * this.buildSpeedBonusMultiplier);
        });
    }

    private initializeScenarioGoals() {
        this.scenarioGoals = [
            {
                id: 'resources',
                description: 'Reach 200 wood',
                current: this.resourceTotals.wood,
                target: 200,
                completed: this.resourceTotals.wood >= 200,
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

        const result = this.trainingManager.queueTraining(this.selectedBuilding);

        if (!result.success) {
            if (result.reason === 'insufficientResources') {
                const type = this.getSelectedWorkerType();
                this.showFeedback(`Not enough wood to train a ${type.name}.`);
                this.pulseResourceText();
            } else if (result.reason === 'populationCap') {
                this.showFeedback('Cannot train: population cap reached.');
            } else {
                this.showFeedback('Selected building is not ready to train units.');
            }
        }

        this.updateTrainingUI();
    }

    private createWorker(spawnPoint: Phaser.Math.Vector2, type: WorkerType) {
        const spawnPosition = spawnPoint.clone();
        const jitter = new Phaser.Math.Vector2(Phaser.Math.Between(-12, 12), Phaser.Math.Between(-12, 12));
        const worker = new Worker(
            this,
            spawnPosition.x + jitter.x,
            spawnPosition.y + jitter.y,
            this.gridSize,
            () => this.dropOffPoints,
            (type: ResourceType, amount: number) => this.depositResource(type, amount),
            (node) => this.resourceManager.updateResourceLabel(node),
            (node) => this.resourceManager.handleResourceDepleted(node),
            (position) => this.resourceManager.findNearestResource(position),
            {
                color: type.color,
                harvestRate: type.harvestRate,
                capacity: (type.capacity ?? 25) + this.carryCapacityBonus,
                buildSpeedMultiplier: (type.buildSpeedMultiplier ?? 1) * this.buildSpeedBonusMultiplier,
                harvestMultiplierProvider: (position) => this.getHarvestMultiplier(position),
            },
        );

        worker.setData('typeId', type.id);

        worker.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (!pointer.rightButtonDown()) {
                this.selectWorker(worker);
            }
        });

        this.workers.push(worker);
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
        this.trainingManager.registerProductionBuilding(building);
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
        this.uiManager.setAutoGatherEnabled(this.autoGatherEnabled);
    }

    private centerCameraOn(x: number, y: number) {
        this.cameras.main.centerOn(x, y);
    }

    private handleCommand(worldX: number, worldY: number) {
        if (!this.selectedWorker) return;

        const targetNode = this.resourceManager.getNodeAt(worldX, worldY);

        if (targetNode) {
            if (targetNode.amount <= 0) {
                const label = RESOURCE_CONFIGS[targetNode.type].label;
                this.showFeedback(`${label} node is depleted.`);
                return;
            }
            this.selectedWorker.assignResource(targetNode);
            return;
        }

        this.selectedWorker.moveTo(new Phaser.Math.Vector2(worldX, worldY));
    }

    private generateStartingResources() {
        const clusterConfigs: { type: ResourceType; count: number; distance: number; spread: number }[] = [
            { type: 'wood', count: 4, distance: 240, spread: 80 },
            { type: 'stone', count: 3, distance: 320, spread: 70 },
            { type: 'food', count: 3, distance: 280, spread: 75 },
        ];

        this.resourceManager.generateStartingResources(clusterConfigs);
    }

    private depositResource(type: ResourceType, amount: number) {
        this.resourceTotals[type] += amount;
        this.updateResourceText();
        this.showFeedback(`+${amount} ${RESOURCE_CONFIGS[type].label}`);
        this.updateScenarioGoal('resources', this.resourceTotals.wood);
    }

    private getHarvestMultiplier(position: Phaser.Math.Vector2) {
        let multiplier = 1;

        this.harvestBonusZones.forEach((zone) => {
            const distance = Phaser.Math.Distance.Between(position.x, position.y, zone.center.x, zone.center.y);
            if (distance <= zone.radius) {
                multiplier *= zone.multiplier;
            }
        });

        return multiplier;
    }

    update(_time: number, delta: number) {
        this.handleCameraControls(delta);
        this.workers.forEach((worker) => worker.update());
        this.updateTrainingUI();
        this.updateConstructionSites(delta);
        this.updateScenarioTimer();
        this.updateResearchProgress();
    }

    shutdown() {
        this.resourceManager.shutdown();
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
        this.uiManager.showFeedback();
        const buildDuration = config.buildTime > 0 ? `${config.buildTime / 1000}s to complete` : 'instant build';
        this.uiManager.setPlacementInfo(
            `Placing ${config.name} | Cost: ${config.cost} (paid upfront) | ${buildDuration} | Left-click to place, Right-click to cancel`,
        );

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
        const hasResources = this.hasSufficientResource('wood', this.currentPlacement.cost);
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
            this.uiManager.showFeedback();
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

        const resourceCollision = this.resourceManager.hasCollisionWithResource(previewBounds);

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

        if (!this.hasSufficientResource('wood', this.currentPlacement.cost)) {
            this.showFeedback('Insufficient wood to construct this building.');
            this.pulseResourceText();
            return;
        }

        this.resourceTotals.wood -= this.currentPlacement.cost;
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
        this.uiManager.setPlacementInfo(undefined);
        this.uiManager.showFeedback();
    }

    private updateResourceText() {
        this.uiManager.updateResourceTotals(this.resourceTotals);
        this.updateTrainingUI();
    }

    private updatePopulationText() {
        this.uiManager.updatePopulation(this.currentPopulation, this.populationCap);
        this.updateTrainingUI();
    }

    private setSpawnWorkerButtonState(label: string, enabled: boolean) {
        this.uiManager.setTrainingButton(label, enabled);
    }

    private updateTrainingUI() {
        const selectedBuilding = this.selectedBuilding;

        if (!this.canTrainWorkers(selectedBuilding)) {
            this.setSpawnWorkerButtonState('Select a Base to train workers', false);
            this.uiManager.setTrainingStatus('No production building selected.');
            return;
        }

        const buildingName = selectedBuilding.getConfig().name;
        const queue = this.trainingManager.getQueueState(selectedBuilding);

        if (!queue) {
            this.setSpawnWorkerButtonState(`${buildingName} cannot train workers right now`, false);
            this.uiManager.setTrainingStatus(`${buildingName} is not ready to train units.`);
            return;
        }

        const queueCount = queue.totalQueued;
        const capacityReached = this.currentPopulation >= this.populationCap;
        const type = this.getSelectedWorkerType();
        const hasResources = this.hasSufficientResource('wood', type.cost);
        const canTrain = hasResources && !capacityReached;

        this.setSpawnWorkerButtonState(`Train ${type.name} (${type.cost}) - ${buildingName}`, canTrain);

        const statusParts: string[] = [`Training at ${buildingName}`, `Queue: ${queueCount}`];

        if (queue.active && queue.currentCompleteTime) {
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

        this.uiManager.setTrainingStatus(statusParts.join(' | '));
    }

    private showFeedback(message: string) {
        this.uiManager.showFeedback(message);
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
                const buildSpeedMultiplier = site.assignedWorker?.getBuildSpeedMultiplier() ?? 1;
                site.remainingTime = Math.max(0, site.remainingTime - delta * buildSpeedMultiplier);
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
        this.resourceTotals.wood += site.config.cost;
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

        if (config.unlockedWorkerTypes?.length) {
            this.unlockWorkerTypes(config.unlockedWorkerTypes);
        }

        const passiveIncome = config.passiveIncomePerMinute ?? 0;
        if (passiveIncome > 0) {
            const incomePerMs = passiveIncome / 60000;
            const timer = this.time.addEvent({
                delay: 1000,
                loop: true,
                callback: () => {
                    this.resourceTotals.wood += Math.round(incomePerMs * 1000);
                    this.updateResourceText();
                },
            });
            this.passiveIncomeTimers.push(timer);
        }

        if (config.harvestBonus) {
            this.harvestBonusZones.push({
                center: position.clone(),
                radius: config.harvestBonus.radius,
                multiplier: config.harvestBonus.multiplier,
            });
        }

        this.refreshResearchAvailability();
    }

    private pulseResourceText() {
        this.uiManager.pulseResourceText();
    }
}
