import Phaser from 'phaser';
import { type BuildingConfig } from '../buildings/Building';
import { type ResourceType } from '../units/Worker';

interface UIManagerCallbacks {
    onMainMenu: () => void;
    onStartPlacement: (config: BuildingConfig) => void;
    onQueueTraining: () => void;
    onSelectNextIdleWorker: () => void;
    onGatherNearest: () => void;
    onToggleAutoGather: () => void;
    onCycleWorkerType: () => void;
}

export class UIManager {
    private scene: Phaser.Scene;
    private callbacks: UIManagerCallbacks;
    private statsContainer!: Phaser.GameObjects.Container;
    private resourceText!: Phaser.GameObjects.Text;
    private populationText!: Phaser.GameObjects.Text;
    private scoreText!: Phaser.GameObjects.Text;
    private spawnWorkerButton?: Phaser.GameObjects.Text;
    private trainingStatusText?: Phaser.GameObjects.Text;
    private workerTypeToggle?: Phaser.GameObjects.Text;
    private autoGatherButton?: Phaser.GameObjects.Text;
    private idleWorkerButton?: Phaser.GameObjects.Text;
    private gatherNearestButton?: Phaser.GameObjects.Text;
    private placementInfoText?: Phaser.GameObjects.Text;
    private feedbackText?: Phaser.GameObjects.Text;
    private autoGatherEnabled: boolean = false;
    private buildMenuContainer?: Phaser.GameObjects.Container;
    private researchMenuContainer?: Phaser.GameObjects.Container;
    private buildMenuVisible: boolean = false;
    private researchMenuVisible: boolean = false;
    private trainingUIContainer?: Phaser.GameObjects.Container;

    constructor(scene: Phaser.Scene, callbacks: UIManagerCallbacks) {
        this.scene = scene;
        this.callbacks = callbacks;
    }

    createHUD(buildMenuConfigs: BuildingConfig[]) {
        const { width } = this.scene.cameras.main;

        this.createStatsPanel(width);
        this.createMenuBar(buildMenuConfigs);
        this.createPlacementFeedback(width);
    }

    private createStatsPanel(screenWidth: number) {
        this.statsContainer = this.scene.add
            .container(screenWidth - 10, 10)
            .setScrollFactor(0)
            .setDepth(1000);

        // Background panel
        const panelWidth = 180;
        const panelHeight = 120;
        const background = this.scene.add
            .rectangle(0, 0, panelWidth, panelHeight, 0x000000, 0.85)
            .setOrigin(1, 0)
            .setStrokeStyle(2, 0xffff00);

        // Title
        const title = this.scene.add
            .text(-10, 8, 'Stats', {
                fontSize: '14px',
                color: '#ffff00',
                fontStyle: 'bold',
            })
            .setOrigin(1, 0);

        // Resources section
        this.resourceText = this.scene.add
            .text(-10, 30, '', {
                fontSize: '13px',
                color: '#ffffff',
                lineSpacing: 3,
            })
            .setOrigin(1, 0);

        // Population
        this.populationText = this.scene.add
            .text(-10, 80, '', {
                fontSize: '13px',
                color: '#add8e6',
            })
            .setOrigin(1, 0);

        // Score (initially hidden, can be shown later)
        this.scoreText = this.scene.add
            .text(-10, 98, '', {
                fontSize: '12px',
                color: '#cccccc',
            })
            .setOrigin(1, 0)
            .setVisible(false);

        this.statsContainer.add([background, title, this.resourceText, this.populationText, this.scoreText]);
    }

    updateResourceTotals(resourceTotals: Record<ResourceType, number>) {
        const text = [
            `Wood: ${resourceTotals.wood}`,
            `Stone: ${resourceTotals.stone}`,
            `Food: ${resourceTotals.food}`,
        ].join('\n');

        this.resourceText.setText(text);
    }

    updatePopulation(current: number, cap: number) {
        this.populationText.setText(`Population: ${current}/${cap}`);
    }

    setWorkerTypeLabel(label: string, canCycle: boolean) {
        if (!this.workerTypeToggle) return;
        this.workerTypeToggle.setText(label);
        this.workerTypeToggle.setStyle({ backgroundColor: canCycle ? '#2e8b57' : '#1f4d36' });
    }

    setTrainingButton(label: string, enabled: boolean) {
        if (!this.spawnWorkerButton) return;
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

    setTrainingStatus(text: string) {
        if (!this.trainingStatusText) return;
        this.trainingStatusText.setText(text);
    }

    setAutoGatherEnabled(enabled: boolean) {
        this.autoGatherEnabled = enabled;
        if (!this.autoGatherButton) return;
        this.autoGatherButton.setText(`Auto Gather: ${enabled ? 'On' : 'Off'}`);
        this.autoGatherButton.setStyle({ backgroundColor: enabled ? '#5f9e3c' : '#444444' });
    }

    setPlacementInfo(text: string | undefined) {
        if (!this.placementInfoText) return;

        if (text) {
            this.placementInfoText.setText(text);
            this.placementInfoText.setVisible(true);
        } else {
            this.placementInfoText.setVisible(false);
        }
    }

    showFeedback(message?: string) {
        if (!this.feedbackText) return;

        if (message) {
            this.feedbackText.setText(message);
            this.feedbackText.setVisible(true);
        } else {
            this.feedbackText.setVisible(false);
        }
    }

    updateScore(score: number) {
        this.scoreText.setText(`Score: ${score}`);
        this.scoreText.setVisible(true);
    }

    pulseResourceText() {
        this.scene.tweens.add({
            targets: this.statsContainer,
            alpha: 0.6,
            duration: 150,
            yoyo: true,
            repeat: 2,
        });
    }

    private createMenuBar(buildMenuConfigs: BuildingConfig[]) {
        const mainMenuButton = this.scene.add
            .text(10, 10, 'Main Menu', {
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#333333',
                padding: { x: 10, y: 5 },
            })
            .setScrollFactor(0)
            .setDepth(1000)
            .setInteractive({ useHandCursor: true });

        mainMenuButton.on('pointerover', () => {
            mainMenuButton.setStyle({ backgroundColor: '#555555' });
        });

        mainMenuButton.on('pointerout', () => {
            mainMenuButton.setStyle({ backgroundColor: '#333333' });
        });

        mainMenuButton.on('pointerdown', () => {
            this.callbacks.onMainMenu();
        });

        // Build menu button
        const buildMenuButton = this.scene.add
            .text(110, 10, 'Build', {
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#004c99',
                padding: { x: 10, y: 5 },
            })
            .setScrollFactor(0)
            .setDepth(1000)
            .setInteractive({ useHandCursor: true });

        buildMenuButton.on('pointerover', () => {
            buildMenuButton.setStyle({ backgroundColor: '#005fb3' });
        });

        buildMenuButton.on('pointerout', () => {
            buildMenuButton.setStyle({ backgroundColor: this.buildMenuVisible ? '#005fb3' : '#004c99' });
        });

        buildMenuButton.on('pointerdown', () => {
            this.toggleBuildMenu();
        });

        // Research menu button
        const researchMenuButton = this.scene.add
            .text(280, 10, 'Research', {
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#5a3e85',
                padding: { x: 10, y: 5 },
            })
            .setScrollFactor(0)
            .setDepth(1000)
            .setInteractive({ useHandCursor: true });

        researchMenuButton.on('pointerover', () => {
            researchMenuButton.setStyle({ backgroundColor: '#6f4ca0' });
        });

        researchMenuButton.on('pointerout', () => {
            researchMenuButton.setStyle({ backgroundColor: this.researchMenuVisible ? '#6f4ca0' : '#5a3e85' });
        });

        researchMenuButton.on('pointerdown', () => {
            this.toggleResearchMenu();
        });

        this.createBuildMenu(buildMenuConfigs);
        this.createResearchMenu();
    }

    private toggleBuildMenu() {
        this.buildMenuVisible = !this.buildMenuVisible;
        if (this.buildMenuContainer) {
            this.buildMenuContainer.setVisible(this.buildMenuVisible);
        }
        if (this.buildMenuVisible) {
            if (this.researchMenuVisible) this.toggleResearchMenu();
        }
    }

    private toggleResearchMenu() {
        this.researchMenuVisible = !this.researchMenuVisible;
        if (this.researchMenuContainer) {
            this.researchMenuContainer.setVisible(this.researchMenuVisible);
        }
        if (this.researchMenuVisible) {
            if (this.buildMenuVisible) this.toggleBuildMenu();
        }
    }

    private createBuildMenu(buildMenuConfigs: BuildingConfig[]) {
        const startX = 10;
        const startY = 45;
        const spacing = 48;
        const buttonWidth = 280;
        const buttonHeight = 40;

        this.buildMenuContainer = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(1000).setVisible(false);
        const container = this.buildMenuContainer;

        buildMenuConfigs.forEach((config, index) => {
            const y = startY + index * spacing;
            const buttonContainer = this.scene.add.container(startX, y);

            const background = this.scene.add
                .rectangle(0, 0, buttonWidth, buttonHeight, 0x004c99, 1)
                .setOrigin(0, 0)
                .setStrokeStyle(2, 0x003366);
            const preview = this.scene.add.rectangle(12, 20, 24, 24, config.color, 1).setOrigin(0, 0.5);
            const label = this.scene.add
                .text(buttonWidth - 10, 8, `${config.name} (${config.cost})`, {
                    fontSize: '14px',
                    color: '#ffffff',
                })
                .setOrigin(1, 0);
            const description = this.scene.add
                .text(48, 8, config.description ?? 'No description', {
                    fontSize: '11px',
                    color: '#cce6ff',
                    wordWrap: { width: 150 },
                })
                .setOrigin(0, 0);

            buttonContainer.add([background, preview, label, description]);

            buttonContainer.setInteractive(
                new Phaser.Geom.Rectangle(0, 0, buttonWidth, buttonHeight),
                (shape: Phaser.Geom.Rectangle, x: number, y: number) => Phaser.Geom.Rectangle.Contains(shape, x, y),
            );

            buttonContainer.on('pointerover', () => {
                background.setFillStyle(0x005fb3);
            });

            buttonContainer.on('pointerout', () => {
                background.setFillStyle(0x004c99);
            });

            buttonContainer.on('pointerdown', () => {
                this.callbacks.onStartPlacement(config);
                this.toggleBuildMenu();
            });

            container.add(buttonContainer);
        });
    }

    private createResearchMenu() {
        this.researchMenuContainer = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(1000).setVisible(false);
        // Research options will be added here by ResearchManager
    }

    getResearchMenuContainer(): Phaser.GameObjects.Container | undefined {
        return this.researchMenuContainer;
    }

    private createPlacementFeedback(width: number) {
        this.placementInfoText = this.scene.add
            .text(width / 2, 10, '', {
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 10, y: 5 },
            })
            .setOrigin(0.5, 0)
            .setScrollFactor(0)
            .setDepth(1000)
            .setVisible(false);

        this.feedbackText = this.scene.add
            .text(width / 2, 40, '', {
                fontSize: '14px',
                color: '#ff6666',
                backgroundColor: '#000000',
                padding: { x: 8, y: 4 },
            })
            .setOrigin(0.5, 0)
            .setScrollFactor(0)
            .setDepth(1000)
            .setVisible(false);
    }

    showTrainingUI(buildingX: number, buildingY: number, buildingName: string) {
        if (this.trainingUIContainer) {
            this.trainingUIContainer.destroy();
        }

        const camera = this.scene.cameras.main;
        const screenX = buildingX - camera.scrollX;
        const screenY = buildingY - camera.scrollY;

        this.trainingUIContainer = this.scene.add
            .container(screenX + 80, screenY)
            .setDepth(2000)
            .setScrollFactor(0);

        // Background panel
        const panelWidth = 280;
        const panelHeight = 240;
        const panel = this.scene.add
            .rectangle(0, 0, panelWidth, panelHeight, 0x1a1a1a, 0.95)
            .setOrigin(0, 0)
            .setStrokeStyle(2, 0x3366cc);

        // Title
        const title = this.scene.add
            .text(10, 10, `Training - ${buildingName}`, {
                fontSize: '14px',
                color: '#ffff00',
                fontStyle: 'bold',
            })
            .setOrigin(0, 0);

        // Worker type toggle
        this.workerTypeToggle = this.scene.add
            .text(10, 35, '', {
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: '#2e8b57',
                padding: { x: 8, y: 4 },
            })
            .setOrigin(0, 0)
            .setInteractive({ useHandCursor: true });

        this.workerTypeToggle.on('pointerdown', () => {
            this.callbacks.onCycleWorkerType();
        });

        // Train button
        this.spawnWorkerButton = this.scene.add
            .text(10, 70, '', {
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: '#3366cc',
                padding: { x: 8, y: 4 },
                wordWrap: { width: panelWidth - 20 },
            })
            .setOrigin(0, 0)
            .setInteractive({ useHandCursor: true });

        this.spawnWorkerButton.on('pointerover', () => {
            if (this.spawnWorkerButton) {
                this.spawnWorkerButton.setStyle({ backgroundColor: '#3355aa' });
            }
        });

        this.spawnWorkerButton.on('pointerout', () => {
            if (this.spawnWorkerButton) {
                this.spawnWorkerButton.setStyle({ backgroundColor: '#3366cc' });
            }
        });

        this.spawnWorkerButton.on('pointerdown', () => {
            this.callbacks.onQueueTraining();
        });

        // Training status
        this.trainingStatusText = this.scene.add
            .text(10, 110, '', {
                fontSize: '12px',
                color: '#cccccc',
                wordWrap: { width: panelWidth - 20 },
            })
            .setOrigin(0, 0);

        // Worker controls separator
        const separator = this.scene.add
            .rectangle(10, 145, panelWidth - 20, 1, 0x666666)
            .setOrigin(0, 0);

        const controlsTitle = this.scene.add
            .text(10, 155, 'Worker Commands', {
                fontSize: '12px',
                color: '#aaaaaa',
            })
            .setOrigin(0, 0);

        // Idle worker button
        this.idleWorkerButton = this.scene.add
            .text(10, 175, 'Next Idle (.)', {
                fontSize: '13px',
                color: '#ffffff',
                backgroundColor: '#228b22',
                padding: { x: 8, y: 3 },
            })
            .setOrigin(0, 0)
            .setInteractive({ useHandCursor: true });

        this.idleWorkerButton.on('pointerover', () => {
            if (this.idleWorkerButton) {
                this.idleWorkerButton.setStyle({ backgroundColor: '#2fa82f' });
            }
        });

        this.idleWorkerButton.on('pointerout', () => {
            if (this.idleWorkerButton) {
                this.idleWorkerButton.setStyle({ backgroundColor: '#228b22' });
            }
        });

        this.idleWorkerButton.on('pointerdown', () => {
            this.callbacks.onSelectNextIdleWorker();
        });

        // Gather nearest button
        this.gatherNearestButton = this.scene.add
            .text(140, 175, 'Gather Nearest', {
                fontSize: '13px',
                color: '#ffffff',
                backgroundColor: '#8b8b00',
                padding: { x: 8, y: 3 },
            })
            .setOrigin(0, 0)
            .setInteractive({ useHandCursor: true });

        this.gatherNearestButton.on('pointerover', () => {
            if (this.gatherNearestButton) {
                this.gatherNearestButton.setStyle({ backgroundColor: '#a3a300' });
            }
        });

        this.gatherNearestButton.on('pointerout', () => {
            if (this.gatherNearestButton) {
                this.gatherNearestButton.setStyle({ backgroundColor: '#8b8b00' });
            }
        });

        this.gatherNearestButton.on('pointerdown', () => {
            this.callbacks.onGatherNearest();
        });

        // Auto-gather toggle
        this.autoGatherButton = this.scene.add
            .text(10, 205, '', {
                fontSize: '13px',
                color: '#ffffff',
                backgroundColor: '#444444',
                padding: { x: 8, y: 3 },
            })
            .setOrigin(0, 0)
            .setInteractive({ useHandCursor: true });

        this.autoGatherButton.on('pointerover', () => {
            if (this.autoGatherButton) {
                const highlightColor = this.autoGatherEnabled ? '#6bbd42' : '#5a5a5a';
                this.autoGatherButton.setStyle({ backgroundColor: highlightColor });
            }
        });

        this.autoGatherButton.on('pointerout', () => {
            this.setAutoGatherEnabled(this.autoGatherEnabled);
        });

        this.autoGatherButton.on('pointerdown', () => {
            this.callbacks.onToggleAutoGather();
        });

        this.trainingUIContainer.add([
            panel,
            title,
            this.workerTypeToggle,
            this.spawnWorkerButton,
            this.trainingStatusText,
            separator,
            controlsTitle,
            this.idleWorkerButton,
            this.gatherNearestButton,
            this.autoGatherButton,
        ]);
    }

    hideTrainingUI() {
        if (this.trainingUIContainer) {
            this.trainingUIContainer.destroy();
            this.trainingUIContainer = undefined;
            this.workerTypeToggle = undefined;
            this.spawnWorkerButton = undefined;
            this.trainingStatusText = undefined;
            this.idleWorkerButton = undefined;
            this.gatherNearestButton = undefined;
            this.autoGatherButton = undefined;
        }
    }
}
