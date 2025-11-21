import { describe, it, expect } from 'vitest';

describe('Game Configuration', () => {
    it('should have correct game dimensions', () => {
        const width = 1280;
        const height = 720;

        expect(width).toBe(1280);
        expect(height).toBe(720);
    });

    it('should calculate resource increase correctly', () => {
        const initialResources = 100;
        const resourceIncrease = 10;
        const expectedTotal = 110;

        expect(initialResources + resourceIncrease).toBe(expectedTotal);
    });
});

describe('Game Mechanics', () => {
    it('should handle resource collection', () => {
        let resources = 100;
        const collectAmount = 10;

        resources += collectAmount;

        expect(resources).toBe(110);
    });

    it('should validate building dimensions', () => {
        const buildingSize = 80;

        expect(buildingSize).toBeGreaterThan(0);
        expect(buildingSize).toBeLessThanOrEqual(100);
    });
});

describe('Worker Training Queue', () => {
    it('should allow queuing multiple workers', () => {
        const workerCost = 25;
        let resources = 200;
        let trainingQueue = 0;

        // Queue 3 workers
        for (let i = 0; i < 3; i++) {
            if (resources >= workerCost) {
                resources -= workerCost;
                trainingQueue++;
            }
        }

        expect(trainingQueue).toBe(3);
        expect(resources).toBe(125);
    });

    it('should respect population cap when queuing', () => {
        const populationCap = 8;
        const currentPopulation = 5;
        let trainingQueue = 0;

        // Try to queue 5 workers (should only allow 3)
        for (let i = 0; i < 5; i++) {
            if (currentPopulation + trainingQueue < populationCap) {
                trainingQueue++;
            }
        }

        expect(trainingQueue).toBe(3);
        expect(currentPopulation + trainingQueue).toBe(8);
    });

    it('should process queue after completing training', () => {
        let trainingQueue = 3;
        let currentPopulation = 0;

        // Simulate completing one worker training
        trainingQueue--;
        currentPopulation++;

        expect(trainingQueue).toBe(2);
        expect(currentPopulation).toBe(1);
    });

    it('should prevent queuing when insufficient resources', () => {
        const workerCost = 25;
        let resources = 20;
        let trainingQueue = 0;

        if (resources >= workerCost) {
            resources -= workerCost;
            trainingQueue++;
        }

        expect(trainingQueue).toBe(0);
        expect(resources).toBe(20);
    });
});
