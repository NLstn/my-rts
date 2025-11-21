export interface WorkerType {
    id: string;
    name: string;
    cost: number;
    color: number;
    description: string;
    harvestRate?: number;
    capacity?: number;
    buildSpeedMultiplier?: number;
    trainingTime?: number;
}
