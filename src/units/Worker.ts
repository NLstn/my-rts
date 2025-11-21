import Phaser from 'phaser';

export const WorkerState = {
    Idle: 'idle',
    Moving: 'moving',
    Harvesting: 'harvesting',
    Returning: 'returning',
} as const;

export type WorkerStateType = typeof WorkerState[keyof typeof WorkerState];

export interface ResourceNode {
    id: number;
    sprite: Phaser.GameObjects.Arc;
    amount: number;
}

export class Worker extends Phaser.GameObjects.Rectangle {
    public state: WorkerStateType = WorkerState.Idle;

    private speed: number = 140;

    private harvestRate: number = 5;

    private capacity: number = 25;

    private carried: number = 0;

    private targetNode?: ResourceNode;

    private waypoints: Phaser.Math.Vector2[] = [];

    private harvestTimer?: Phaser.Time.TimerEvent;

    private basePosition: Phaser.Math.Vector2;

    private readonly gridSize: number;

    private readonly onDeposit: (amount: number) => void;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        basePosition: Phaser.Math.Vector2,
        gridSize: number,
        onDeposit: (amount: number) => void,
    ) {
        super(scene, x, y, 24, 24, 0xadd8e6, 1);

        this.basePosition = basePosition.clone();
        this.gridSize = gridSize;
        this.onDeposit = onDeposit;

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setStrokeStyle(2, 0xffffff);
        this.setInteractive({ useHandCursor: true });

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setCollideWorldBounds(true);
        body.setImmovable(false);
    }

    public setSelected(selected: boolean) {
        this.setStrokeStyle(2, selected ? 0x00ffcc : 0xffffff);
    }

    public assignResource(node: ResourceNode) {
        this.stopHarvesting();
        this.targetNode = node;
        this.state = WorkerState.Moving;
        this.buildPathTo(node.sprite.x, node.sprite.y);
    }

    public moveTo(target: Phaser.Math.Vector2) {
        this.stopHarvesting();
        this.targetNode = undefined;
        this.state = WorkerState.Moving;
        this.buildPathTo(target.x, target.y);
    }

    public update() {
        if (this.state === WorkerState.Harvesting || this.state === WorkerState.Idle) {
            return;
        }

        if (!this.waypoints.length) {
            (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
            return;
        }

        const target = this.waypoints[0];
        const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
        const body = this.body as Phaser.Physics.Arcade.Body;

        if (distance < 4) {
            this.setPosition(target.x, target.y);
            body.setVelocity(0, 0);
            this.waypoints.shift();
            if (!this.waypoints.length) {
                this.onDestinationReached();
            }
            return;
        }

        const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
        const vx = Math.cos(angle) * this.speed;
        const vy = Math.sin(angle) * this.speed;
        body.setVelocity(vx, vy);
    }

    private onDestinationReached() {
        if (this.state === WorkerState.Moving && this.targetNode) {
            this.startHarvesting();
            return;
        }

        if (this.state === WorkerState.Returning) {
            this.depositResources();
            return;
        }

        this.state = WorkerState.Idle;
    }

    private startHarvesting() {
        if (!this.targetNode) {
            this.state = WorkerState.Idle;
            return;
        }

        this.state = WorkerState.Harvesting;
        const sprite = this.targetNode.sprite;
        sprite.setFillStyle(0xffe066);

        this.harvestTimer = this.scene.time.addEvent({
            delay: 800,
            loop: true,
            callback: () => this.harvestTick(),
        });
    }

    private harvestTick() {
        if (!this.targetNode) {
            this.stopHarvesting();
            this.state = WorkerState.Idle;
            return;
        }

        if (this.carried >= this.capacity || this.targetNode.amount <= 0) {
            this.stopHarvesting();
            if (this.carried > 0) {
                this.returnToBase();
            } else {
                this.state = WorkerState.Idle;
            }
            return;
        }

        const availableCapacity = this.capacity - this.carried;
        const harvested = Math.min(this.harvestRate, this.targetNode.amount, availableCapacity);
        this.carried += harvested;
        this.targetNode.amount -= harvested;

        if (this.targetNode.amount <= 0) {
            this.targetNode.sprite.setFillStyle(0x777755);
        }

        if (this.carried >= this.capacity || this.targetNode.amount <= 0) {
            this.stopHarvesting();
            this.returnToBase();
        }
    }

    private returnToBase() {
        this.state = WorkerState.Returning;
        this.buildPathTo(this.basePosition.x, this.basePosition.y);
    }

    private depositResources() {
        if (this.carried > 0) {
            this.onDeposit(this.carried);
        }
        this.carried = 0;
        this.state = WorkerState.Idle;
        this.targetNode = undefined;
    }

    private stopHarvesting() {
        if (this.harvestTimer) {
            this.harvestTimer.remove(false);
            this.harvestTimer = undefined;
        }

        if (this.targetNode) {
            this.targetNode.sprite.setFillStyle(0xffd700);
        }
    }

    private buildPathTo(x: number, y: number) {
        const snappedTarget = new Phaser.Math.Vector2(
            Phaser.Math.Snap.To(x, this.gridSize),
            Phaser.Math.Snap.To(y, this.gridSize),
        );
        const snappedStart = new Phaser.Math.Vector2(
            Phaser.Math.Snap.To(this.x, this.gridSize),
            Phaser.Math.Snap.To(this.y, this.gridSize),
        );

        const path: Phaser.Math.Vector2[] = [];
        path.push(snappedStart);

        if (snappedStart.x !== snappedTarget.x) {
            path.push(new Phaser.Math.Vector2(snappedTarget.x, snappedStart.y));
        }

        if (snappedStart.y !== snappedTarget.y) {
            path.push(new Phaser.Math.Vector2(snappedTarget.x, snappedTarget.y));
        }

        // Remove the initial node as the worker is already there.
        path.shift();
        this.waypoints = path;

        if (!this.waypoints.length) {
            this.onDestinationReached();
        }
    }
}
