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

    private readonly dropOffRetryBaseDelay: number = 2000;

    private readonly dropOffRetryMaxDelay: number = 30000;

    private targetNode?: ResourceNode;

    private waypoints: Phaser.Math.Vector2[] = [];

    private harvestTimer?: Phaser.Time.TimerEvent;

    private dropOffRetryTimer?: Phaser.Time.TimerEvent;

    private dropOffRetryCount: number = 0;

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
        this.stopDropOffRetry();
        this.targetNode = node;
        this.updateState(WorkerState.Moving);
        this.buildPathTo(node.sprite.x, node.sprite.y);
    }

    public moveTo(target: Phaser.Math.Vector2) {
        this.stopHarvesting();
        this.clearBuildTarget();
        this.stopDropOffRetry();
        this.targetNode = undefined;
        this.updateState(WorkerState.Moving);
        this.buildPathTo(target.x, target.y);
    }

    public assignConstruction(target: Phaser.Math.Vector2, onArrive: () => void, onCancel: () => void) {
        this.stopHarvesting();
        this.stopDropOffRetry();
        this.buildTarget = {
            position: target.clone(),
            onArrive,
            onCancel,
        };
        this.updateState(WorkerState.MovingToBuild);
        this.buildPathTo(target.x, target.y);
    }

    public releaseFromConstruction() {
        this.buildTarget = undefined;
        this.updateState(WorkerState.Idle);
        this.waypoints = [];
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    }

    public cancelConstructionAssignment() {
        if (this.buildTarget) {
            this.buildTarget.onCancel();
        }
        this.buildTarget = undefined;
        this.updateState(WorkerState.Idle);
        this.waypoints = [];
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    }

    public destroy(fromScene?: boolean) {
        this.stopHarvesting();
        this.stopDropOffRetry();
        super.destroy(fromScene);
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
            this.updateState(WorkerState.Building);
            this.buildTarget.onArrive();
            return;
        }

        this.updateState(WorkerState.Idle);
    }

    private startHarvesting() {
        if (!this.targetNode) {
            this.updateState(WorkerState.Idle);
            return;
        }

        this.updateState(WorkerState.Harvesting);
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
            this.updateState(WorkerState.Idle);
            return;
        }

        if (this.carried >= this.capacity || this.targetNode.amount <= 0) {
            this.stopHarvesting();
            if (this.carried > 0) {
                this.returnToBase();
            } else {
                this.updateState(WorkerState.Idle);
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
            this.updateState(WorkerState.Idle);
            this.targetNode = undefined;
        }
    }

    private returnToBase() {
        this.updateState(WorkerState.Returning);
        const nearestDropOff = this.findNearestDropOff();
        if (nearestDropOff) {
            this.buildPathTo(nearestDropOff.x, nearestDropOff.y);
            this.stopDropOffRetry();
        } else {
            this.updateState(WorkerState.Idle);
            this.scheduleDropOffRetry();
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
        this.updateState(WorkerState.Idle);
        this.targetNode = undefined;
        this.stopDropOffRetry();
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

    private scheduleDropOffRetry() {
        if (!this.shouldAttemptDropOff()) {
            return;
        }

        this.stopDropOffRetry();

        // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
        const delay = Math.min(
            this.dropOffRetryBaseDelay * Math.pow(2, this.dropOffRetryCount),
            this.dropOffRetryMaxDelay,
        );
        this.dropOffRetryCount++;

        this.dropOffRetryTimer = this.scene.time.addEvent({
            delay,
            callback: () => {
                // Re-check conditions as worker state may have changed since scheduling
                if (this.shouldAttemptDropOff()) {
                    this.returnToBase();
                }
            },
        });
    }

    private shouldAttemptDropOff(): boolean {
        // Only attempt drop-off when idle to avoid interfering with other tasks.
        // Workers transition to Idle when no drop-off is found (see returnToBase).
        return this.carried > 0 && this.state === WorkerState.Idle;
    }

    private stopDropOffRetry() {
        if (this.dropOffRetryTimer) {
            this.dropOffRetryTimer.remove(false);
            this.dropOffRetryTimer = undefined;
        }
        this.dropOffRetryCount = 0;
    }

    private clearBuildTarget() {
        this.buildTarget = undefined;
        if (this.state === WorkerState.MovingToBuild || this.state === WorkerState.Building) {
            this.updateState(WorkerState.Idle);
        }
    }

    private updateState(nextState: WorkerStateType) {
        if (this.state === nextState) {
            return;
        }

        const previousState = this.state;
        this.state = nextState;
        this.emit('stateChanged', nextState, previousState);
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
