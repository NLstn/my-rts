import * as THREE from 'three';
import { Unit, UnitConfig } from './Unit';
import type { Tree } from '../resources/Tree';
import type { Base } from '../buildings/Base';

const WORKER_CONFIG: UnitConfig = {
  name: 'Worker',
  cost: {
    food: 50,
  },
  trainTime: 5, // 5 seconds to train
  maxHealth: 50,
  moveSpeed: 5, // units per second
  dimensions: {
    width: 0.8,
    height: 1.6,
    depth: 0.6,
  },
};

const MAX_CARRY_CAPACITY = 10; // Maximum resources per type
const HARVEST_RATE = 5; // Resources per second
const HARVEST_RANGE = 2; // Distance at which worker can harvest
const BASE_DELIVERY_RANGE = 4; // Distance from base to stop and deliver

enum WorkerState {
  IDLE,
  MOVING_TO_RESOURCE,
  HARVESTING,
  RETURNING_TO_BASE,
  DELIVERING,
}

interface CarriedResources {
  wood: number;
  food: number;
  stone: number;
}

export class Worker extends Unit {
  private _state: WorkerState;
  private _targetResource: Tree | null;
  private _assignedResource: Tree | null; // The resource the worker is assigned to
  private _homeBase: Base | null;
  private _carriedResources: CarriedResources;
  private _harvestTimer: number;
  private _nearbyTreesFinder: (() => Tree | null) | null; // Callback to find nearby trees

  constructor(position: THREE.Vector3) {
    super(WORKER_CONFIG, position);
    this._state = WorkerState.IDLE;
    this._targetResource = null;
    this._assignedResource = null;
    this._homeBase = null;
    this._carriedResources = { wood: 0, food: 0, stone: 0 };
    this._harvestTimer = 0;
    this._nearbyTreesFinder = null;
  }

  protected _createModel(): void {
    const { width, height, depth } = this._config.dimensions;

    // Body (torso)
    const bodyGeometry = new THREE.BoxGeometry(width, height * 0.5, depth);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b6914, // Brown clothing
      roughness: 0.8,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = height * 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    this._mesh.add(body);

    // Head
    const headGeometry = new THREE.SphereGeometry(width * 0.5, 8, 8);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xffdbac, // Skin tone
      roughness: 0.9,
      metalness: 0,
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = height * 0.8;
    head.castShadow = true;
    this._mesh.add(head);

    // Hat
    const hatGeometry = new THREE.ConeGeometry(width * 0.55, height * 0.15, 6);
    const hatMaterial = new THREE.MeshStandardMaterial({
      color: 0x654321, // Dark brown
      roughness: 0.9,
    });
    const hat = new THREE.Mesh(hatGeometry, hatMaterial);
    hat.position.y = height * 0.9;
    hat.castShadow = true;
    this._mesh.add(hat);

    // Left arm
    const armGeometry = new THREE.BoxGeometry(
      width * 0.25,
      height * 0.4,
      depth * 0.8
    );
    const armMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b6914, // Same as body
      roughness: 0.8,
      metalness: 0.1,
    });
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-width * 0.6, height * 0.45, 0);
    leftArm.castShadow = true;
    this._mesh.add(leftArm);

    // Right arm
    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(width * 0.6, height * 0.45, 0);
    rightArm.castShadow = true;
    this._mesh.add(rightArm);

    // Left leg
    const legGeometry = new THREE.BoxGeometry(
      width * 0.35,
      height * 0.4,
      depth * 0.9
    );
    const legMaterial = new THREE.MeshStandardMaterial({
      color: 0x654321, // Dark brown pants
      roughness: 0.8,
      metalness: 0,
    });
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-width * 0.25, height * 0.2, 0);
    leftLeg.castShadow = true;
    this._mesh.add(leftLeg);

    // Right leg
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(width * 0.25, height * 0.2, 0);
    rightLeg.castShadow = true;
    this._mesh.add(rightLeg);

    // Tool (simple pickaxe on back)
    const handleGeometry = new THREE.CylinderGeometry(
      0.05,
      0.05,
      height * 0.5,
      6
    );
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513, // Wood color
      roughness: 0.9,
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.set(0, height * 0.5, -depth * 0.6);
    handle.rotation.x = Math.PI / 6;
    handle.castShadow = true;
    this._mesh.add(handle);

    // Pickaxe head
    const pickaxeGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.1);
    const pickaxeMaterial = new THREE.MeshStandardMaterial({
      color: 0x555555, // Dark gray metal
      roughness: 0.5,
      metalness: 0.8,
    });
    const pickaxe = new THREE.Mesh(pickaxeGeometry, pickaxeMaterial);
    pickaxe.position.set(0, height * 0.7, -depth * 0.7);
    pickaxe.rotation.x = Math.PI / 6;
    pickaxe.castShadow = true;
    this._mesh.add(pickaxe);
  }

  public update(deltaTime: number): void {
    super.update(deltaTime);

    // Update harvesting state machine
    switch (this._state) {
      case WorkerState.MOVING_TO_RESOURCE:
        if (!this._isMoving && this._targetResource) {
          // Reached resource, start harvesting
          const distance = this._position.distanceTo(
            this._targetResource.getPosition()
          );
          if (distance <= HARVEST_RANGE) {
            this._state = WorkerState.HARVESTING;
            this._targetResource.setBeingHarvested(true);
          }
        }
        break;

      case WorkerState.HARVESTING:
        if (this._targetResource) {
          // Check if resource is depleted
          if (this._targetResource.isDepleted()) {
            this._targetResource.setBeingHarvested(false);

            // Try to find a nearby tree
            const nearbyTree = this._nearbyTreesFinder
              ? this._nearbyTreesFinder()
              : null;
            if (nearbyTree) {
              // Found a nearby tree, go harvest it
              this._targetResource = nearbyTree;
              this._assignedResource = nearbyTree;
              this._state = WorkerState.MOVING_TO_RESOURCE;

              // Calculate position near the tree
              const treePos = nearbyTree.getPosition();
              const direction = new THREE.Vector3()
                .subVectors(this._position, treePos)
                .normalize();
              if (direction.length() === 0) direction.set(1, 0, 0);
              const targetPos = treePos
                .clone()
                .add(direction.multiplyScalar(HARVEST_RANGE * 0.8));
              this.moveTo(targetPos);
            } else if (this._carriedResources.wood > 0 && this._homeBase) {
              // No nearby tree, return to base if carrying resources
              this._state = WorkerState.RETURNING_TO_BASE;
              this._moveToBaseDeliveryPoint();
            } else {
              // Nothing to do
              this._state = WorkerState.IDLE;
              this._targetResource = null;
              this._assignedResource = null;
            }
            break;
          }

          this._harvestTimer += deltaTime;

          // Harvest at the specified rate
          if (this._harvestTimer >= 1.0) {
            const harvestAmount = Math.floor(this._harvestTimer * HARVEST_RATE);
            this._harvestTimer = 0;

            const harvested = this._targetResource.harvest(harvestAmount);
            this._carriedResources.wood += harvested;

            // Check if inventory is full
            if (this._carriedResources.wood >= MAX_CARRY_CAPACITY) {
              this._targetResource.setBeingHarvested(false);
              if (this._homeBase) {
                this._state = WorkerState.RETURNING_TO_BASE;
                this._moveToBaseDeliveryPoint();
              } else {
                this._state = WorkerState.IDLE;
              }
            }
          }
        }
        break;

      case WorkerState.RETURNING_TO_BASE:
        if (!this._isMoving && this._homeBase) {
          // Check if we're close enough to the base
          const distanceToBase = this._position.distanceTo(
            this._homeBase.getPosition()
          );
          if (distanceToBase <= BASE_DELIVERY_RANGE) {
            // Close enough, start delivering
            this._state = WorkerState.DELIVERING;
          }
        }
        break;

      case WorkerState.DELIVERING:
        // Delivery happens in main game loop, then worker returns to resource
        if (this._assignedResource && !this._assignedResource.isDepleted()) {
          // Return to assigned resource
          this._targetResource = this._assignedResource;
          this._state = WorkerState.MOVING_TO_RESOURCE;

          // Calculate position near the resource
          const resourcePos = this._assignedResource.getPosition();
          const direction = new THREE.Vector3()
            .subVectors(this._position, resourcePos)
            .normalize();
          if (direction.length() === 0) direction.set(1, 0, 0);
          const targetPos = resourcePos
            .clone()
            .add(direction.multiplyScalar(HARVEST_RANGE * 0.8));
          this.moveTo(targetPos);
        } else {
          // Resource is depleted, try to find another
          const nearbyTree = this._nearbyTreesFinder
            ? this._nearbyTreesFinder()
            : null;
          if (nearbyTree) {
            this._targetResource = nearbyTree;
            this._assignedResource = nearbyTree;
            this._state = WorkerState.MOVING_TO_RESOURCE;

            // Calculate position near the tree
            const treePos = nearbyTree.getPosition();
            const direction = new THREE.Vector3()
              .subVectors(this._position, treePos)
              .normalize();
            if (direction.length() === 0) direction.set(1, 0, 0);
            const targetPos = treePos
              .clone()
              .add(direction.multiplyScalar(HARVEST_RANGE * 0.8));
            this.moveTo(targetPos);
          } else {
            this._state = WorkerState.IDLE;
            this._targetResource = null;
            this._assignedResource = null;
          }
        }
        break;
    }

    // Add simple walking animation when moving
    if (this._isMoving) {
      const time = Date.now() * 0.005;

      // Find legs and arms for animation
      const children = this._mesh.children;
      const leftLeg = children[5]; // Assuming this is the left leg
      const rightLeg = children[6]; // Assuming this is the right leg
      const leftArm = children[3]; // Assuming this is the left arm
      const rightArm = children[4]; // Assuming this is the right arm

      if (leftLeg && rightLeg) {
        // Simple leg swing animation
        leftLeg.rotation.x = Math.sin(time) * 0.3;
        rightLeg.rotation.x = Math.sin(time + Math.PI) * 0.3;
      }

      if (leftArm && rightArm) {
        // Arms swing opposite to legs
        leftArm.rotation.x = Math.sin(time + Math.PI) * 0.2;
        rightArm.rotation.x = Math.sin(time) * 0.2;
      }
    } else {
      // Reset limb rotations when not moving
      const children = this._mesh.children;
      const leftLeg = children[5];
      const rightLeg = children[6];
      const leftArm = children[3];
      const rightArm = children[4];

      if (leftLeg && rightLeg && leftArm && rightArm) {
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
        leftArm.rotation.x = 0;
        rightArm.rotation.x = 0;
      }
    }
  }

  /**
   * Command worker to harvest a resource
   */
  public harvestResource(resource: Tree, homeBase: Base): void {
    this._targetResource = resource;
    this._assignedResource = resource;
    this._homeBase = homeBase;
    this._state = WorkerState.MOVING_TO_RESOURCE;

    // Calculate a position near the resource instead of at its center
    const resourcePos = resource.getPosition();
    const direction = new THREE.Vector3()
      .subVectors(this._position, resourcePos)
      .normalize();

    // If worker is already at the resource position, pick a default direction
    if (direction.length() === 0) {
      direction.set(1, 0, 0);
    }

    // Move to a position just outside harvest range
    const targetPos = resourcePos
      .clone()
      .add(direction.multiplyScalar(HARVEST_RANGE * 0.8));
    this.moveTo(targetPos);
  }

  /**
   * Set a callback function to find nearby trees when current resource is depleted
   */
  public setTreeFinder(finder: () => Tree | null): void {
    this._nearbyTreesFinder = finder;
  }

  /**
   * Move to a position near the base for delivery
   */
  private _moveToBaseDeliveryPoint(): void {
    if (!this._homeBase) return;

    const basePos = this._homeBase.getPosition();
    const direction = new THREE.Vector3()
      .subVectors(this._position, basePos)
      .normalize();

    // Calculate delivery point just outside the base
    const deliveryPoint = basePos
      .clone()
      .add(direction.multiplyScalar(BASE_DELIVERY_RANGE));
    this.moveTo(deliveryPoint);
  }

  /**
   * Check if worker is ready to deliver resources
   */
  public isReadyToDeliver(): boolean {
    return this._state === WorkerState.DELIVERING;
  }

  /**
   * Get carried resources and reset inventory
   */
  public collectCarriedResources(): CarriedResources {
    const resources = { ...this._carriedResources };
    this._carriedResources = { wood: 0, food: 0, stone: 0 };
    return resources;
  }

  /**
   * Get current carried resource amount
   */
  public getCarriedResources(): CarriedResources {
    return { ...this._carriedResources };
  }

  /**
   * Get worker state
   */
  public getState(): WorkerState {
    return this._state;
  }

  /**
   * Check if worker is idle
   */
  public isIdle(): boolean {
    return this._state === WorkerState.IDLE;
  }

  /**
   * Stop current task
   */
  public stopTask(): void {
    if (this._targetResource) {
      this._targetResource.setBeingHarvested(false);
      this._targetResource = null;
    }
    this._assignedResource = null;
    this._state = WorkerState.IDLE;
    this._targetPosition = null;
    this._isMoving = false;
  }

  /**
   * Get the assigned resource node
   */
  public getAssignedResource(): Tree | null {
    return this._assignedResource;
  }
}

export { WORKER_CONFIG };
