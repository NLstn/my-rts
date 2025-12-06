import * as THREE from 'three';
import { Building, BuildingConfig } from './Building';
import { Worker, WORKER_CONFIG } from '../units/Worker';

const BASE_CONFIG: BuildingConfig = {
  name: 'Base',
  cost: {
    wood: 0,
    stone: 0,
    gold: 0,
    food: 0,
  },
  buildTime: 0, // Starting building, no build time
  maxHealth: 1000,
  dimensions: {
    width: 6,
    height: 4,
    depth: 6,
  },
};

interface TrainingQueueItem {
  type: 'worker';
  progress: number;
  totalTime: number;
}

export class Base extends Building {
  private _trainingQueue: TrainingQueueItem[] = [];
  private _rallyPoint: THREE.Vector3;
  private _spawnedWorkers: Set<THREE.Vector3> = new Set();
  private _workerReadyToSpawn = false;

  constructor(position: THREE.Vector3) {
    super(BASE_CONFIG, position);
    this._isConstructed = true; // Base starts fully constructed
    this._buildProgress = 1;
    this._rallyPoint = position.clone();
    this._rallyPoint.x += 8; // Default rally point to the right
  }

  protected _createModel(): void {
    const { width, height, depth } = this._config.dimensions;

    // Main building body
    const bodyGeometry = new THREE.BoxGeometry(width, height * 0.7, depth);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b7355, // Brown/tan color
      roughness: 0.7,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = (height * 0.7) / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    this._mesh.add(body);

    // Roof - pyramid style
    const roofGeometry = new THREE.ConeGeometry(width * 0.8, height * 0.3, 4);
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513, // Darker brown for roof
      roughness: 0.8,
      metalness: 0,
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = height * 0.7 + height * 0.15;
    roof.rotation.y = Math.PI / 4; // Rotate 45 degrees to align with building
    roof.castShadow = true;
    this._mesh.add(roof);

    // Door
    const doorGeometry = new THREE.BoxGeometry(width * 0.25, height * 0.4, 0.1);
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0x654321, // Dark wood color
    });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(0, (height * 0.4) / 2, depth / 2 + 0.05);
    this._mesh.add(door);

    // Windows (simple decorative boxes)
    const windowGeometry = new THREE.BoxGeometry(
      width * 0.15,
      height * 0.15,
      0.1
    );
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x87ceeb, // Sky blue for windows
      emissive: 0x87ceeb,
      emissiveIntensity: 0.2,
    });

    // Left window
    const leftWindow = new THREE.Mesh(windowGeometry, windowMaterial);
    leftWindow.position.set(-width * 0.3, height * 0.5, depth / 2 + 0.05);
    this._mesh.add(leftWindow);

    // Right window
    const rightWindow = new THREE.Mesh(windowGeometry, windowMaterial);
    rightWindow.position.set(width * 0.3, height * 0.5, depth / 2 + 0.05);
    this._mesh.add(rightWindow);

    // Foundation/base
    const foundationGeometry = new THREE.BoxGeometry(
      width * 1.1,
      0.3,
      depth * 1.1
    );
    const foundationMaterial = new THREE.MeshStandardMaterial({
      color: 0x696969, // Dark gray
      roughness: 0.9,
      metalness: 0,
    });
    const foundation = new THREE.Mesh(foundationGeometry, foundationMaterial);
    foundation.position.y = 0.15;
    foundation.receiveShadow = true;
    this._mesh.add(foundation);

    // Flag pole
    const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, height * 0.8, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({
      color: 0x2f4f4f, // Dark slate gray
      metalness: 0.6,
      roughness: 0.4,
    });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(width * 0.5, height * 0.7 + height * 0.4, 0);
    pole.castShadow = true;
    this._mesh.add(pole);

    // Flag
    const flagGeometry = new THREE.PlaneGeometry(1.5, 1);
    const flagMaterial = new THREE.MeshStandardMaterial({
      color: 0x0066cc, // Blue flag
      side: THREE.DoubleSide,
      roughness: 0.6,
    });
    const flag = new THREE.Mesh(flagGeometry, flagMaterial);
    flag.position.set(width * 0.5 + 0.75, height * 0.7 + height * 0.6, 0);
    this._mesh.add(flag);
  }

  public update(deltaTime: number): void {
    super.update(deltaTime);

    // Add slight flag animation
    const flag = this._mesh.children.find(
      (child) =>
        child instanceof THREE.Mesh &&
        child.geometry instanceof THREE.PlaneGeometry
    );

    if (flag) {
      const time = Date.now() * 0.001;
      flag.rotation.y = Math.sin(time * 2) * 0.1;
    }

    // Update training queue
    if (this._trainingQueue.length > 0 && !this._workerReadyToSpawn) {
      const currentTraining = this._trainingQueue[0];
      currentTraining.progress += deltaTime;

      // Check if training is complete
      if (currentTraining.progress >= currentTraining.totalTime) {
        this._workerReadyToSpawn = true;
      }
    }
  }

  /**
   * Queue a worker for training
   */
  public trainWorker(): void {
    this._trainingQueue.push({
      type: 'worker',
      progress: 0,
      totalTime: WORKER_CONFIG.trainTime,
    });
  }

  /**
   * Get the current training queue
   */
  public getTrainingQueue(): TrainingQueueItem[] {
    return this._trainingQueue;
  }

  /**
   * Check if a worker is ready to spawn
   */
  public hasWorkerReady(): boolean {
    return this._workerReadyToSpawn;
  }

  /**
   * Spawn a worker at the base
   * Returns the spawned worker instance
   */
  public spawnWorker(): Worker {
    // Remove the completed training from queue
    if (this._trainingQueue.length > 0) {
      this._trainingQueue.shift();
    }

    // Reset the flag
    this._workerReadyToSpawn = false;

    const spawnPos = this._calculateSpawnPosition();
    const worker = new Worker(spawnPos);

    // Move worker to rally point
    worker.moveTo(this._rallyPoint);

    return worker;
  }

  /**
   * Calculate a spawn position next to the base that doesn't overlap
   */
  private _calculateSpawnPosition(): THREE.Vector3 {
    const { width, depth } = this._config.dimensions;
    const spawnDistance = Math.max(width, depth) / 2 + 1;

    // Try different angles around the base to find a free spot
    const angles = [
      0,
      Math.PI / 4,
      Math.PI / 2,
      (3 * Math.PI) / 4,
      Math.PI,
      (5 * Math.PI) / 4,
      (3 * Math.PI) / 2,
      (7 * Math.PI) / 4,
    ];

    for (const angle of angles) {
      const testPos = new THREE.Vector3(
        this._position.x + Math.cos(angle) * spawnDistance,
        this._position.y,
        this._position.z + Math.sin(angle) * spawnDistance
      );

      // Check if this position is already occupied
      let occupied = false;
      for (const spawnedPos of this._spawnedWorkers) {
        if (testPos.distanceTo(spawnedPos) < 1.5) {
          occupied = true;
          break;
        }
      }

      if (!occupied) {
        this._spawnedWorkers.add(testPos);
        // Clean up old spawn positions after a delay
        setTimeout(() => {
          this._spawnedWorkers.delete(testPos);
        }, 2000);
        return testPos;
      }
    }

    // If all positions are occupied, use a random offset
    const randomAngle = Math.random() * Math.PI * 2;
    return new THREE.Vector3(
      this._position.x + Math.cos(randomAngle) * spawnDistance,
      this._position.y,
      this._position.z + Math.sin(randomAngle) * spawnDistance
    );
  }

  /**
   * Set the rally point where units will move after spawning
   */
  public setRallyPoint(position: THREE.Vector3): void {
    this._rallyPoint = position.clone();
  }

  /**
   * Get the rally point
   */
  public getRallyPoint(): THREE.Vector3 {
    return this._rallyPoint.clone();
  }

  /**
   * Get the training progress percentage (0-1) for the current item
   */
  public getTrainingProgress(): number {
    if (this._trainingQueue.length === 0) return 0;
    const current = this._trainingQueue[0];
    return Math.min(1, current.progress / current.totalTime);
  }

  /**
   * Get the queue length
   */
  public getQueueLength(): number {
    return this._trainingQueue.length;
  }
}
