import Phaser from 'phaser';

export const WorkerState = {
    Idle: 'idle',
    Moving: 'moving',
    Harvesting: 'harvesting',
    Returning: 'returning',
    MovingToBuild: 'movingToBuild',
    Building: 'building',
} as const;

export type WorkerStateType = typeof WorkerState[keyof typeof WorkerState];

export interface ResourceNode {
    id: number;
    sprite: Phaser.GameObjects.Arc;
    label: Phaser.GameObjects.Text;
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

    private readonly gridSize: number;

    private readonly getDropOffTargets: () => Phaser.Math.Vector2[];

    private readonly onDeposit: (amount: number) => void;

    private readonly onResourceUpdate: (node: ResourceNode) => void;

    private readonly onResourceDepleted: (node: ResourceNode) => void;

    private buildTarget?: {
        position: Phaser.Math.Vector2;
        onArrive: () => void;
        onCancel: () => void;
    };

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        gridSize: number,
        getDropOffTargets: () => Phaser.Math.Vector2[],
        onDeposit: (amount: number) => void,
        onResourceUpdate: (node: ResourceNode) => void,
        onResourceDepleted: (node: ResourceNode) => void,
    ) {
        super(scene, x, y, 24, 24, 0xadd8e6, 1);

        this.gridSize = gridSize;
        this.getDropOffTargets = getDropOffTargets;
        this.onDeposit = onDeposit;
        this.onResourceUpdate = onResourceUpdate;
        this.onResourceDepleted = onResourceDepleted;

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
        this.clearBuildTarget();
        this.targetNode = node;
        this.state = WorkerState.Moving;
        this.buildPathTo(node.sprite.x, node.sprite.y);
    }

    public moveTo(target: Phaser.Math.Vector2) {
        this.stopHarvesting();
        this.clearBuildTarget();
        this.targetNode = undefined;
        this.state = WorkerState.Moving;
        this.buildPathTo(target.x, target.y);
    }

    public assignConstruction(target: Phaser.Math.Vector2, onArrive: () => void, onCancel: () => void) {
        this.stopHarvesting();
        this.buildTarget = {
            position: target.clone(),
            onArrive,
            onCancel,
        };
        this.state = WorkerState.MovingToBuild;
        this.buildPathTo(target.x, target.y);
    }

    public releaseFromConstruction() {
        this.buildTarget = undefined;
        this.state = WorkerState.Idle;
        this.waypoints = [];
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    }

    public cancelConstructionAssignment() {
        if (this.buildTarget) {
            this.buildTarget.onCancel();
        }
        this.buildTarget = undefined;
        this.state = WorkerState.Idle;
        this.waypoints = [];
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    }

    public update() {
        if (this.state === WorkerState.Harvesting || this.state === WorkerState.Idle || this.state === WorkerState.Building) {
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

        if (this.state === WorkerState.MovingToBuild && this.buildTarget) {
            this.state = WorkerState.Building;
            this.buildTarget.onArrive();
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

        this.onResourceUpdate(this.targetNode);

        if (this.targetNode.amount <= 0) {
            this.targetNode.sprite.setFillStyle(0x777755);
            this.onResourceDepleted(this.targetNode);
        }

        if (this.carried >= this.capacity || this.targetNode.amount <= 0) {
            this.stopHarvesting();
            this.returnToBase();
        }
    }

    public handleDepletedNode(node: ResourceNode) {
        if (!this.targetNode || this.targetNode.id !== node.id) {
            return;
        }

        this.stopHarvesting();

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(0, 0);
        this.waypoints = [];

        if (this.carried > 0) {
            this.returnToBase();
        } else {
            this.state = WorkerState.Idle;
            this.targetNode = undefined;
        }
    }

    private returnToBase() {
        this.state = WorkerState.Returning;
        const nearestDropOff = this.findNearestDropOff();
        if (nearestDropOff) {
            this.buildPathTo(nearestDropOff.x, nearestDropOff.y);
        } else {
            this.state = WorkerState.Idle;
        }
    }

    private findNearestDropOff(): Phaser.Math.Vector2 | undefined {
        const dropOffTargets = this.getDropOffTargets();
        if (!dropOffTargets.length) {
            return undefined;
        }

        let nearest: Phaser.Math.Vector2 | undefined;
        let shortest = Number.POSITIVE_INFINITY;

        dropOffTargets.forEach((target) => {
            const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
            if (distance < shortest) {
                shortest = distance;
                nearest = target;
            }
        });

        return nearest;
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
            const fillColor = this.targetNode.amount <= 0 ? 0x777755 : 0xffd700;
            this.targetNode.sprite.setFillStyle(fillColor);
        }
    }

    private clearBuildTarget() {
        this.buildTarget = undefined;
        if (this.state === WorkerState.MovingToBuild || this.state === WorkerState.Building) {
            this.state = WorkerState.Idle;
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
