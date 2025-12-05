import { ResourceType, ResourceInventory, ResourceCost } from '../types/ResourceTypes';

/**
 * Manages global resources for the player
 */
export class ResourceManager {
  private _resources: ResourceInventory;
  private _listeners: Set<(resources: ResourceInventory) => void>;

  constructor() {
    this._resources = {
      wood: 100,
      food: 100,
      stone: 50,
      gold: 0,
      iron: 0,
      tools: 0,
    };
    this._listeners = new Set();
  }

  /**
   * Add resources to the inventory
   */
  public addResource(type: ResourceType, amount: number): void {
    this._resources[type] += amount;
    this._notifyListeners();
  }

  /**
   * Remove resources from the inventory
   * @returns true if resources were available and removed, false otherwise
   */
  public removeResource(type: ResourceType, amount: number): boolean {
    if (this._resources[type] < amount) {
      return false;
    }
    this._resources[type] -= amount;
    this._notifyListeners();
    return true;
  }

  /**
   * Check if the player has enough resources for a cost
   */
  public hasEnough(cost: ResourceCost): boolean {
    for (const [type, amount] of Object.entries(cost)) {
      if (amount && this._resources[type as ResourceType] < amount) {
        return false;
      }
    }
    return true;
  }

  /**
   * Deduct a cost from resources
   * @returns true if resources were available and deducted, false otherwise
   */
  public deductCost(cost: ResourceCost): boolean {
    if (!this.hasEnough(cost)) {
      return false;
    }

    for (const [type, amount] of Object.entries(cost)) {
      if (amount) {
        this._resources[type as ResourceType] -= amount;
      }
    }

    this._notifyListeners();
    return true;
  }

  /**
   * Get the current amount of a resource
   */
  public getResource(type: ResourceType): number {
    return this._resources[type];
  }

  /**
   * Get all resources
   */
  public getResources(): Readonly<ResourceInventory> {
    return { ...this._resources };
  }

  /**
   * Register a listener for resource changes
   */
  public onChange(callback: (resources: ResourceInventory) => void): void {
    this._listeners.add(callback);
  }

  /**
   * Unregister a listener
   */
  public offChange(callback: (resources: ResourceInventory) => void): void {
    this._listeners.delete(callback);
  }

  /**
   * Notify all listeners of resource changes
   */
  private _notifyListeners(): void {
    const resourcesCopy = this.getResources();
    this._listeners.forEach((listener) => listener(resourcesCopy));
  }
}
