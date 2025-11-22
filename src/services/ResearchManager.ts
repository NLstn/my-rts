import Phaser from 'phaser';
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

export interface ResearchManagerConfig {
    researchOptions: ResearchOption[];
    researchMenuContainer?: Phaser.GameObjects.Container;
    hasSufficientResource: (type: ResourceType, amount: number) => boolean;
    spendResources: (type: ResourceType, amount: number) => void;
    onResearchCompleted: (option: ResearchOption) => void;
    showFeedback: (message: string) => void;
    pulseResourceText: () => void;
}

export class ResearchManager {
    private readonly scene: Phaser.Scene;
    private readonly options: ResearchOption[];
    private readonly researchMenuContainer?: Phaser.GameObjects.Container;
    private readonly hasSufficientResource: (type: ResourceType, amount: number) => boolean;
    private readonly spendResources: (type: ResourceType, amount: number) => void;
    private readonly onResearchCompleted: (option: ResearchOption) => void;
    private readonly showFeedback: (message: string) => void;
    private readonly pulseResourceText: () => void;
    private readonly completedResearch: Set<string> = new Set();
    private researchButtons: Map<string, Phaser.GameObjects.Text> = new Map();

    constructor(scene: Phaser.Scene, config: ResearchManagerConfig) {
        this.scene = scene;
        this.options = config.researchOptions;
        this.researchMenuContainer = config.researchMenuContainer;
        this.hasSufficientResource = config.hasSufficientResource;
        this.spendResources = config.spendResources;
        this.onResearchCompleted = config.onResearchCompleted;
        this.showFeedback = config.showFeedback;
        this.pulseResourceText = config.pulseResourceText;

        this.createResearchUI();
    }

    private createResearchUI() {
        if (!this.researchMenuContainer) return;

        const startX = 10;
        const startY = 45;
        const buttonWidth = 320;
        const container = this.researchMenuContainer;

        this.options.forEach((option, index) => {
            const y = startY + index * 60;
            const button = this.scene.add
                .text(startX, y, '', {
                    fontSize: '14px',
                    color: '#ffffff',
                    backgroundColor: '#5a3e85',
                    padding: { x: 8, y: 6 },
                    wordWrap: { width: buttonWidth },
                })
                .setOrigin(0, 0)
                .setInteractive({ useHandCursor: true });

            button.on('pointerdown', () => {
                this.startResearch(option.id);
            });

            this.researchButtons.set(option.id, button);
            this.updateResearchButton(option);
            container.add(button);
        });
    }

    refreshAvailability(placedBuildingNames: string[]) {
        this.options.forEach((option) => {
            if (option.status === 'completed' || option.status === 'inProgress') {
                return;
            }

            if (!option.requiresBuilding) {
                option.status = 'available';
                this.updateResearchButton(option);
                return;
            }

            const requirementMet = placedBuildingNames.includes(option.requiresBuilding);
            option.status = requirementMet ? 'available' : 'locked';
            this.updateResearchButton(option);
        });
    }

    startResearch(optionId: string) {
        const option = this.options.find((candidate) => candidate.id === optionId);
        if (!option || option.status !== 'available') return;

        if (!this.hasSufficientResource('wood', option.cost)) {
            this.showFeedback('Not enough wood for that research.');
            this.pulseResourceText();
            return;
        }

        this.spendResources('wood', option.cost);

        option.status = 'inProgress';
        option.remainingTime = option.duration;
        this.updateResearchButton(option);

        option.timer = this.scene.time.addEvent({
            delay: 100,
            loop: true,
            callback: () => {
                if (!option.remainingTime) return;
                option.remainingTime = Math.max(0, option.remainingTime - 100);
                this.updateResearchButton(option);
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
        this.onResearchCompleted(option);
        this.updateResearchButton(option);
    }

    updateResearchProgress() {
        this.options.forEach((option) => {
            if (option.status === 'inProgress' && option.remainingTime !== undefined) {
                this.updateResearchButton(option);
            }
        });
    }

    private updateResearchButton(option: ResearchOption) {
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
}
