import Phaser from 'phaser';
import { type BuildingConfig } from '../buildings/Building';
import { type ResourceType } from '../units/Worker';

export interface ResearchOption {
    id: string;
    name: string;
    description: string;
    cost: number;
    duration: number;
    requiresBuilding?: string;
    status: 'locked' | 'available' | 'inProgress' | 'completed';
    remainingTime?: number;
    timer?: Phaser.Time.TimerEvent;
    onComplete: () => void;
}

interface UIManagerCallbacks {
    onMainMenu: () => void;
    onStartPlacement: (config: BuildingConfig) => void;
    onQueueTraining: () => void;
    onSelectNextIdleWorker: () => void;
    onGatherNearest: () => void;
    onToggleAutoGather: () => void;
    onCycleWorkerType: () => void;
    onStartResearch: (id: string) => void;
}

export class UIManager {
    private scene: Phaser.Scene;
    private callbacks: UIManagerCallbacks;
    private resourceText!: Phaser.GameObjects.Text;
    private populationText!: Phaser.GameObjects.Text;
    private spawnWorkerButton!: Phaser.GameObjects.Text;
    private trainingStatusText!: Phaser.GameObjects.Text;
    private workerTypeToggle!: Phaser.GameObjects.Text;
    private autoGatherButton!: Phaser.GameObjects.Text;
    private placementInfoText?: Phaser.GameObjects.Text;
    private feedbackText?: Phaser.GameObjects.Text;
    private researchButtons: Map<string, Phaser.GameObjects.Text> = new Map();
    private autoGatherEnabled: boolean = false;

    constructor(scene: Phaser.Scene, callbacks: UIManagerCallbacks) {
        this.scene = scene;
        this.callbacks = callbacks;
    }

    createHUD(buildMenuConfigs: BuildingConfig[], researchOptions: ResearchOption[]) {
        const { width } = this.scene.cameras.main;

        this.resourceText = this.scene.add
            .text(width - 10, 10, '', {
                fontSize: '18px',
                color: '#ffff00',
                backgroundColor: '#000000',
                padding: { x: 10, y: 5 },
                lineSpacing: 4,
            })
            .setOrigin(1, 0)
            .setScrollFactor(0)
            .setDepth(1000);

        this.populationText = this.scene.add
            .text(width - 10, 40, '', {
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 8, y: 4 },
            })
            .setOrigin(1, 0)
            .setScrollFactor(0)
            .setDepth(1000);

        this.createBuildMenu(width - 10, 70, buildMenuConfigs);
        this.createMenuButton();
        this.createWorkerControls();
        this.createPlacementFeedback(width);
        this.createResearchUI(researchOptions);
    }

    updateResourceTotals(resourceTotals: Record<ResourceType, number>) {
        const text = [
            'Resources',
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
        this.workerTypeToggle.setText(label);
        this.workerTypeToggle.setStyle({ backgroundColor: canCycle ? '#2e8b57' : '#1f4d36' });
    }

    setTrainingButton(label: string, enabled: boolean) {
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
        this.trainingStatusText.setText(text);
    }

    setAutoGatherEnabled(enabled: boolean) {
        this.autoGatherEnabled = enabled;
        this.autoGatherButton.setText(`Auto Gather: ${enabled ? 'On' : 'Off'}`);
        this.autoGatherButton.setStyle({ backgroundColor: enabled ? '#4b8f28' : '#444444' });
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

    updateResearchOption(option: ResearchOption) {
        const button = this.researchButtons.get(option.id);
        if (!button) return;

        const baseText = `${option.name} (${option.cost})\n${option.description}`;

        if (option.status === 'completed') {
            button.setText(`${baseText}\nCompleted`);
            button.setStyle({ backgroundColor: '#2f6f3f', color: '#d3ffd3' });
            button.disableInteractive();
            return;
        }

        if (option.status === 'inProgress') {
            const remainingSeconds = (option.remainingTime ?? 0) / 1000;
            button.setText(`${baseText}\nResearching... ${remainingSeconds.toFixed(1)}s`);
            button.setStyle({ backgroundColor: '#9466c4', color: '#ffffff' });
            button.disableInteractive();
            return;
        }

        if (option.status === 'available') {
            button.setText(`${baseText}\nClick to research (${option.duration / 1000}s)`);
            button.setStyle({ backgroundColor: '#5a3e85', color: '#ffffff' });
            button.setInteractive({ useHandCursor: true });
            return;
        }

        button.setText(`${baseText}\nRequires ${option.requiresBuilding}`);
        button.setStyle({ backgroundColor: '#3d2b5c', color: '#bbbbbb' });
        button.disableInteractive();
    }

    updateResearchAvailability(researchOptions: ResearchOption[]) {
        researchOptions.forEach((option) => this.updateResearchOption(option));
    }

    pulseResourceText() {
        this.scene.tweens.add({
            targets: this.resourceText,
            tint: 0xff0000,
            duration: 150,
            yoyo: true,
            repeat: 2,
        });
    }

    private createBuildMenu(anchorX: number, startY: number, buildMenuConfigs: BuildingConfig[]) {
        const spacing = 48;
        const buttonWidth = 240;
        const buttonHeight = 40;

        buildMenuConfigs.forEach((config, index) => {
            const y = startY + index * spacing;
            const buttonContainer = this.scene.add.container(anchorX, y).setScrollFactor(0).setDepth(1000);

            const background = this.scene.add
                .rectangle(0, 0, buttonWidth, buttonHeight, 0x004c99, 1)
                .setOrigin(1, 0)
                .setStrokeStyle(2, 0x003366);
            const label = this.scene.add
                .text(-10, 8, `${config.name} (${config.cost})`, {
                    fontSize: '14px',
                    color: '#ffffff',
                })
                .setOrigin(1, 0);
            const preview = this.scene.add.rectangle(-buttonWidth + 30, 20, 24, 24, config.color, 1).setOrigin(0.5);
            const description = this.scene.add
                .text(-buttonWidth + 52, 8, config.description ?? 'No description', {
                    fontSize: '11px',
                    color: '#cce6ff',
                    wordWrap: { width: 150 },
                })
                .setOrigin(0, 0);

            buttonContainer.add([background, preview, label, description]);

            buttonContainer.setInteractive(
                new Phaser.Geom.Rectangle(-buttonWidth, 0, buttonWidth, buttonHeight),
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
            });
        });
    }

    private createMenuButton() {
        const menuButton = this.scene.add
            .text(10, 10, 'Main Menu', {
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#333333',
                padding: { x: 10, y: 5 },
            })
            .setScrollFactor(0)
            .setDepth(1000)
            .setInteractive({ useHandCursor: true });

        menuButton.on('pointerover', () => {
            menuButton.setStyle({ backgroundColor: '#555555' });
        });

        menuButton.on('pointerout', () => {
            menuButton.setStyle({ backgroundColor: '#333333' });
        });

        menuButton.on('pointerdown', () => {
            this.callbacks.onMainMenu();
        });
    }

    private createWorkerControls() {
        this.workerTypeToggle = this.scene.add
            .text(10, 50, '', {
                fontSize: '15px',
                color: '#ffffff',
                backgroundColor: '#2e8b57',
                padding: { x: 10, y: 4 },
            })
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });

        this.workerTypeToggle.on('pointerdown', () => {
            this.callbacks.onCycleWorkerType();
        });

        this.spawnWorkerButton = this.scene.add
            .text(10, 80, '', {
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#3366cc',
                padding: { x: 10, y: 5 },
            })
            .setScrollFactor(0)
            .setDepth(1000)
            .setInteractive({ useHandCursor: true });

        this.spawnWorkerButton.on('pointerover', () => {
            this.spawnWorkerButton.setStyle({ backgroundColor: '#3355aa' });
        });

        this.spawnWorkerButton.on('pointerout', () => {
            this.spawnWorkerButton.setStyle({ backgroundColor: '#3366cc' });
        });

        this.spawnWorkerButton.on('pointerdown', () => {
            this.callbacks.onQueueTraining();
        });

        const idleWorkerButton = this.scene.add
            .text(10, 120, 'Next Idle Worker (.)', {
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#228b22',
                padding: { x: 10, y: 5 },
            })
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });

        idleWorkerButton.on('pointerover', () => {
            idleWorkerButton.setStyle({ backgroundColor: '#2fa82f' });
        });

        idleWorkerButton.on('pointerout', () => {
            idleWorkerButton.setStyle({ backgroundColor: '#228b22' });
        });

        idleWorkerButton.on('pointerdown', () => {
            this.callbacks.onSelectNextIdleWorker();
        });

        const gatherNearestButton = this.scene.add
            .text(10, 160, 'Gather Nearest', {
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#8b8b00',
                padding: { x: 10, y: 5 },
            })
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });

        gatherNearestButton.on('pointerover', () => {
            gatherNearestButton.setStyle({ backgroundColor: '#a3a300' });
        });

        gatherNearestButton.on('pointerout', () => {
            gatherNearestButton.setStyle({ backgroundColor: '#8b8b00' });
        });

        gatherNearestButton.on('pointerdown', () => {
            this.callbacks.onGatherNearest();
        });

        this.autoGatherButton = this.scene.add
            .text(10, 200, '', {
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
            this.setAutoGatherEnabled(this.autoGatherEnabled);
        });

        this.autoGatherButton.on('pointerdown', () => {
            this.callbacks.onToggleAutoGather();
        });

        this.trainingStatusText = this.scene.add
            .text(10, 240, '', {
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: '#1a1a1a',
                padding: { x: 10, y: 6 },
                wordWrap: { width: 280 },
            })
            .setScrollFactor(0);
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

    private createResearchUI(researchOptions: ResearchOption[]) {
        const { width } = this.scene.cameras.main;
        const startX = 10;
        const startY = 170;
        const rowHeight = 60;

        researchOptions.forEach((option, index) => {
            const y = startY + index * rowHeight;
            const button = this.scene.add
                .text(startX, y, '', {
                    fontSize: '14px',
                    color: '#ffffff',
                    backgroundColor: '#5a3e85',
                    padding: { x: 8, y: 6 },
                    wordWrap: { width: width / 3 },
                })
                .setScrollFactor(0)
                .setInteractive({ useHandCursor: true });

            button.on('pointerdown', () => {
                this.callbacks.onStartResearch(option.id);
            });

            this.researchButtons.set(option.id, button);
            this.updateResearchOption(option);
        });
    }
}
