import Phaser from 'phaser';
import { type Building } from '../buildings/Building';
import { type WorkerType } from '../types/WorkerType';

interface TrainingManagerConfig {
    defaultTrainingTimeMs: number;
    getSpawnPoint: (building: Building) => Phaser.Math.Vector2;
    getSelectedWorkerType: () => WorkerType;
    hasPopulationRoom: () => boolean;
    canAfford: (cost: number) => boolean;
    spendResources: (cost: number) => void;
    onPopulationIncrease: (amount: number) => void;
    onWorkerTrained: (spawnPoint: Phaser.Math.Vector2, type: WorkerType) => void;
    onQueueUpdated?: () => void;
}

export type TrainingFailureReason = 'notProductionBuilding' | 'populationCap' | 'insufficientResources';

export type TrainingRequestResult =
    | { success: true }
    | { success: false; reason: TrainingFailureReason };

interface TrainingQueueState {
    pending: number;
    spawnPoint: Phaser.Math.Vector2;
    activeTimer?: Phaser.Time.TimerEvent;
    currentCompleteTime?: number;
}

export interface TrainingQueueSnapshot {
    pending: number;
    totalQueued: number;
    active: boolean;
    currentCompleteTime?: number;
}

export class TrainingManager {
    private readonly queues: Map<Building, TrainingQueueState> = new Map();
    private readonly scene: Phaser.Scene;
    private readonly config: TrainingManagerConfig;

    constructor(scene: Phaser.Scene, config: TrainingManagerConfig) {
        this.scene = scene;
        this.config = config;
    }

    registerProductionBuilding(building: Building) {
        const spawnPoint = this.config.getSpawnPoint(building);
        this.queues.set(building, {
            pending: 0,
            spawnPoint,
        });
        this.config.onQueueUpdated?.();
    }

    queueTraining(building: Building): TrainingRequestResult {
        const queue = this.queues.get(building);
        if (!queue) {
            return { success: false, reason: 'notProductionBuilding' };
        }

        const type = this.config.getSelectedWorkerType();

        if (!this.config.hasPopulationRoom()) {
            return { success: false, reason: 'populationCap' };
        }

        if (!this.config.canAfford(type.cost)) {
            return { success: false, reason: 'insufficientResources' };
        }

        this.config.spendResources(type.cost);
        queue.pending += 1;

        if (!queue.activeTimer) {
            this.startTraining(queue, type);
        }

        this.config.onQueueUpdated?.();
        return { success: true };
    }

    getQueueState(building: Building): TrainingQueueSnapshot | undefined {
        const queue = this.queues.get(building);
        if (!queue) {
            return undefined;
        }

        const active = Boolean(queue.activeTimer);
        const totalQueued = queue.pending + (active ? 1 : 0);

        return {
            pending: queue.pending,
            totalQueued,
            active,
            currentCompleteTime: queue.currentCompleteTime,
        };
    }

    private startTraining(queue: TrainingQueueState, type: WorkerType) {
        if (queue.pending <= 0 || queue.activeTimer) {
            return;
        }

        queue.pending -= 1;
        const duration = type.trainingTime ?? this.config.defaultTrainingTimeMs;
        queue.currentCompleteTime = this.scene.time.now + duration;
        queue.activeTimer = this.scene.time.delayedCall(duration, () => {
            this.finishTraining(queue, type);
        });
        this.config.onQueueUpdated?.();
    }

    private finishTraining(queue: TrainingQueueState, type: WorkerType) {
        queue.activeTimer = undefined;
        queue.currentCompleteTime = undefined;

        this.config.onWorkerTrained(queue.spawnPoint, type);
        this.config.onPopulationIncrease(1);

        if (queue.pending > 0) {
            const nextType = this.config.getSelectedWorkerType();
            this.startTraining(queue, nextType);
        } else {
            this.config.onQueueUpdated?.();
        }
    }
}
