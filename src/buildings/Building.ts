import Phaser from 'phaser';

export type BuildingType = 'hq' | 'military' | 'utility' | 'housing' | 'defense' | 'dropoff';

export interface BuildingConfig {
    name: string;
    width: number;
    height: number;
    color: number;
    cost: number;
    type: BuildingType;
    buildTime: number;
    populationCapIncrease?: number;
    description?: string;
    populationBonus?: number;
    providesDropOff?: boolean;
    canTrainWorkers?: boolean;
    unlockedWorkerTypes?: string[];
    passiveIncomePerMinute?: number;
    harvestBonus?: {
        radius: number;
        multiplier: number;
    };
}

export abstract class Building {
    protected scene: Phaser.Scene;
    protected config: BuildingConfig;
    protected sprite?: Phaser.GameObjects.Rectangle;
    protected label?: Phaser.GameObjects.Text;
    private selectionHandler?: (building: Building) => void;

    constructor(scene: Phaser.Scene, config: BuildingConfig) {
        this.scene = scene;
        this.config = config;
    }

    public create(x: number, y: number): void {
        this.sprite = this.scene.add.rectangle(x, y, this.config.width, this.config.height, this.config.color);
        this.sprite.setStrokeStyle(2, 0xffffff);
        this.sprite.setInteractive({ useHandCursor: true });

        this.label = this.scene.add
            .text(x, y, `${this.config.name}\n(${this.config.type})`, {
                fontSize: '12px',
                color: '#ffffff',
                align: 'center',
            })
            .setOrigin(0.5);

        this.sprite.on('pointerdown', () => {
            this.onSelect();
            this.selectionHandler?.(this);
        });
    }

    protected onSelect(): void {
        console.log(`Selected: ${this.config.name}`);
        if (this.sprite && this.scene.tweens) {
            this.scene.tweens.add({
                targets: this.sprite,
                scaleX: 1.1,
                scaleY: 1.1,
                duration: 100,
                yoyo: true,
            });
        }
    }

    public setSelectionHandler(handler: (building: Building) => void) {
        this.selectionHandler = handler;
    }

    public setSelected(selected: boolean) {
        this.sprite?.setStrokeStyle(2, selected ? 0xffff00 : 0xffffff);
    }

    public getConfig(): BuildingConfig {
        return this.config;
    }

    public getSprite(): Phaser.GameObjects.Rectangle | undefined {
        return this.sprite;
    }

    public getPosition(): Phaser.Math.Vector2 | undefined {
        if (!this.sprite) {
            return undefined;
        }

        return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
    }

    public destroy(): void {
        this.sprite?.destroy();
        this.label?.destroy();
    }
}
