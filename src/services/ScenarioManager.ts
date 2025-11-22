import Phaser from 'phaser';

export type ScenarioGoalType = 'resources' | 'houses' | 'storehouses' | 'workers';

export interface ScenarioGoal {
    id: ScenarioGoalType;
    description: string;
    current: number;
    target: number;
    completed: boolean;
}

export interface ScenarioManagerConfig {
    durationMs: number;
    goals: ScenarioGoal[];
    onGoalCompleted?: (description: string) => void;
    scenarioMenuContainer?: Phaser.GameObjects.Container;
}

export class ScenarioManager {
    private static readonly PANEL_WIDTH = 280;
    private static readonly PANEL_Y_POSITION = 140;
    private static readonly HEADER_HEIGHT = 28;
    private static readonly GOAL_LINE_HEIGHT = 24;
    private static readonly PANEL_PADDING = 36;

    private readonly scene: Phaser.Scene;
    private readonly goals: ScenarioGoal[];
    private readonly durationMs: number;
    private readonly onGoalCompleted?: (description: string) => void;
    private readonly scenarioMenuContainer?: Phaser.GameObjects.Container;

    private endTime: number;
    private completed: boolean = false;
    private failed: boolean = false;
    private goalTextMap: Map<ScenarioGoalType, Phaser.GameObjects.Text> = new Map();
    private scenarioPanel?: Phaser.GameObjects.Container;
    private scenarioPanelBackground?: Phaser.GameObjects.Rectangle;
    private scenarioTimerText?: Phaser.GameObjects.Text;
    private scenarioResultContainer?: Phaser.GameObjects.Container;

    constructor(scene: Phaser.Scene, config: ScenarioManagerConfig) {
        this.scene = scene;
        this.durationMs = config.durationMs;
        this.goals = config.goals.map((goal) => ({ ...goal }));
        this.onGoalCompleted = config.onGoalCompleted;
        this.scenarioMenuContainer = config.scenarioMenuContainer;

        this.endTime = this.scene.time.now + this.durationMs;
        this.createScenarioPanel();
        this.refreshGoalPanel();
        this.updateTimerText();
        this.checkScenarioCompletion();
    }

    tick() {
        if (this.completed || this.failed) {
            return;
        }

        this.updateTimerText();
    }

    updateGoal(type: ScenarioGoalType, value: number) {
        const goal = this.goals.find((candidate) => candidate.id === type);
        if (!goal || this.completed || this.failed) {
            return;
        }

        if (type === 'resources') {
            goal.current = Math.max(goal.current, value);
        } else {
            goal.current = Math.min(goal.target, value);
        }

        if (!goal.completed && goal.current >= goal.target) {
            goal.completed = true;
            this.onGoalCompleted?.(goal.description);
        }

        this.refreshGoalPanel();
        this.checkScenarioCompletion();
    }

    notifyFailure(message: string) {
        if (this.completed || this.failed) {
            return;
        }

        this.failed = true;
        this.showScenarioResult(message, '#ff6666');
    }

    private updateTimerText() {
        if (this.completed || this.failed) {
            return;
        }

        const remainingMs = this.endTime - this.scene.time.now;

        if (remainingMs <= 0) {
            this.notifyFailure('Objectives failed: time expired.');
            return;
        }

        const remainingSeconds = Math.ceil(remainingMs / 1000);
        this.scenarioTimerText?.setText(`Time remaining: ${remainingSeconds}s`);
    }

    private createScenarioPanel() {
        const panelWidth = 320;
        const startX = 10;
        const startY = 45;

        // If we have a scenario menu container, add directly to it (collapsed menu)
        // Otherwise create standalone panel (fallback)
        if (this.scenarioMenuContainer) {
            const title = this.scene.add.text(startX, startY, 'Scenario Goals', {
                fontSize: '16px',
                color: '#f0f8ff',
                fontStyle: 'bold',
            });
            this.scenarioMenuContainer.add(title);

            this.goalTextMap.clear();
            let offsetY = startY + 28;
            this.goals.forEach((goal) => {
                const text = this.scene.add.text(startX, offsetY, '', {
                    fontSize: '13px',
                    color: '#ffffff',
                    wordWrap: { width: panelWidth - 20 },
                });
                this.goalTextMap.set(goal.id, text);
                this.scenarioMenuContainer?.add(text);
                offsetY += 24;
            });

            this.scenarioTimerText = this.scene.add.text(startX, offsetY + 4, '', {
                fontSize: '12px',
                color: '#dcdcdc',
            });
            this.scenarioMenuContainer.add(this.scenarioTimerText);
        } else {
            // Fallback: standalone panel
            const headerHeight = 28;
            this.scenarioPanel = this.scene.add.container(10, 140).setScrollFactor(0);

            this.scenarioPanelBackground = this.scene.add
                .rectangle(0, 0, panelWidth, 200, 0x000000, 0.55)
                .setOrigin(0, 0);

            const title = this.scene.add.text(10, 6, 'Scenario Goals', {
                fontSize: '16px',
                color: '#f0f8ff',
                fontStyle: 'bold',
            });

            this.scenarioPanel.add([this.scenarioPanelBackground, title]);

            this.goalTextMap.clear();
            let offsetY = headerHeight;
            this.goals.forEach((goal) => {
                const text = this.scene.add.text(10, offsetY, '', {
                    fontSize: '13px',
                    color: '#ffffff',
                    wordWrap: { width: panelWidth - 20 },
                });
                this.goalTextMap.set(goal.id, text);
                this.scenarioPanel?.add(text);
                offsetY += 24;
            });

            this.scenarioTimerText = this.scene.add.text(10, offsetY + 4, '', {
                fontSize: '12px',
                color: '#dcdcdc',
            });
            this.scenarioPanel.add(this.scenarioTimerText);

            this.scenarioPanelBackground.height = offsetY + 36;
        }
    }

    private refreshGoalPanel() {
        if (this.scenarioMenuContainer) {
            // Goals in collapsible menu - no need to adjust heights
            this.goals.forEach((goal) => {
                const text = this.goalTextMap.get(goal.id);
                if (!text) return;

                const progress = `${Math.min(goal.current, goal.target)}/${goal.target}`;
                text.setText(`${goal.description}: ${progress}${goal.completed ? ' ✓' : ''}`);
                text.setColor(goal.completed ? '#9cff9c' : '#ffffff');
            });
        } else {
            // Standalone panel - adjust heights dynamically
            let offsetY = 28;
            this.goals.forEach((goal) => {
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
    }

    private checkScenarioCompletion() {
        if (this.completed || this.failed) {
            return;
        }

        const allComplete = this.goals.every((goal) => goal.completed);
        if (allComplete) {
            this.completed = true;
            this.showScenarioResult('Objectives complete! Great job.', '#2fa82f');
        }
    }

    private showScenarioResult(message: string, color: string) {
        if (this.scenarioResultContainer) {
            return;
        }

        const { width, height } = this.scene.scale;
        const container = this.scene.add.container(width / 2, height / 2).setScrollFactor(0);
        const background = this.scene.add.rectangle(0, 0, 420, 160, 0x000000, 0.8).setOrigin(0.5);
        background.setStrokeStyle(2, 0xffffff, 0.7);

        const label = this.scene
            .add.text(0, -30, message, {
                fontSize: '18px',
                color,
                fontStyle: 'bold',
                align: 'center',
                wordWrap: { width: 360 },
            })
            .setOrigin(0.5);

        const menuButton = this.scene
            .add.text(0, 30, 'Return to Menu', {
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
            this.scene.scene.start('MainMenuScene');
        });

        container.add([background, label, menuButton]);
        this.scenarioResultContainer = container;
    }
}
