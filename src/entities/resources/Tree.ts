import * as THREE from 'three';

/**
 * Represents a tree that can be harvested for wood
 */
export class Tree {
  private _mesh: THREE.Group;
  private _position: THREE.Vector3;
  private _woodAmount: number;
  private _maxWoodAmount: number;
  private _isBeingHarvested: boolean;
  private _isOutlineVisible: boolean;
  private _outlineHelper: THREE.LineSegments | null;

  constructor(position: THREE.Vector3, size: number = 1) {
    this._position = position.clone();
    this._maxWoodAmount = Math.floor(50 + Math.random() * 50); // 50-100 wood per tree
    this._woodAmount = this._maxWoodAmount;
    this._isBeingHarvested = false;
    this._isOutlineVisible = false;
    this._outlineHelper = null;
    this._mesh = new THREE.Group();
    this._mesh.position.copy(this._position);
    
    this._createModel(size);
  }

  private _createModel(size: number): void {
    // Tree trunk
    const trunkHeight = 2 * size;
    const trunkRadius = 0.3 * size;
    const trunkGeometry = new THREE.CylinderGeometry(
      trunkRadius, 
      trunkRadius * 1.2, 
      trunkHeight, 
      8
    );
    const trunkMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x4a2511, // Dark brown
      roughness: 0.9,
      metalness: 0,
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    this._mesh.add(trunk);

    // Tree foliage - multiple cone layers for a fuller look
    const foliageColor = 0x2d5016; // Dark green
    
    // Bottom layer
    const bottomFoliageGeometry = new THREE.ConeGeometry(1.2 * size, 2 * size, 8);
    const foliageMaterial = new THREE.MeshStandardMaterial({ 
      color: foliageColor,
      roughness: 0.8,
      metalness: 0,
    });
    const bottomFoliage = new THREE.Mesh(bottomFoliageGeometry, foliageMaterial);
    bottomFoliage.position.y = trunkHeight + 0.5 * size;
    bottomFoliage.castShadow = true;
    this._mesh.add(bottomFoliage);

    // Middle layer
    const middleFoliageGeometry = new THREE.ConeGeometry(1 * size, 1.8 * size, 8);
    const middleFoliage = new THREE.Mesh(middleFoliageGeometry, foliageMaterial);
    middleFoliage.position.y = trunkHeight + 1.2 * size;
    middleFoliage.castShadow = true;
    this._mesh.add(middleFoliage);

    // Top layer
    const topFoliageGeometry = new THREE.ConeGeometry(0.7 * size, 1.5 * size, 8);
    const topFoliage = new THREE.Mesh(topFoliageGeometry, foliageMaterial);
    topFoliage.position.y = trunkHeight + 2 * size;
    topFoliage.castShadow = true;
    this._mesh.add(topFoliage);
  }

  /**
   * Harvest wood from the tree
   * @param amount Amount to harvest
   * @returns Actual amount harvested (may be less if tree doesn't have enough)
   */
  public harvest(amount: number): number {
    const harvestedAmount = Math.min(amount, this._woodAmount);
    this._woodAmount -= harvestedAmount;
    this._updateAppearance();
    return harvestedAmount;
  }

  /**
   * Update tree appearance based on remaining wood
   */
  private _updateAppearance(): void {
    const healthPercent = this._woodAmount / this._maxWoodAmount;
    
    // Fade foliage as tree is depleted
    this._mesh.children.forEach((child, index) => {
      if (index > 0) { // Skip trunk
        const mesh = child as THREE.Mesh;
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.opacity = 0.3 + (healthPercent * 0.7);
        material.transparent = true;
      }
    });
  }

  /**
   * Check if tree is depleted
   */
  public isDepleted(): boolean {
    return this._woodAmount <= 0;
  }

  /**
   * Get remaining wood amount
   */
  public getWoodAmount(): number {
    return this._woodAmount;
  }

  /**
   * Set harvesting state
   */
  public setBeingHarvested(isHarvested: boolean): void {
    this._isBeingHarvested = isHarvested;
  }

  /**
   * Check if tree is being harvested
   */
  public isBeingHarvested(): boolean {
    return this._isBeingHarvested;
  }

  /**
   * Get tree position
   */
  public getPosition(): THREE.Vector3 {
    return this._position.clone();
  }

  /**
   * Get tree mesh
   */
  public getMesh(): THREE.Group {
    return this._mesh;
  }

  /**
   * Show selection outline
   */
  public showOutline(color: number = 0x00ff00, lineWidth: number = 2): void {
    if (this._isOutlineVisible) return;

    // Create outline using edges geometry
    const box = new THREE.Box3().setFromObject(this._mesh);
    const size = box.getSize(new THREE.Vector3());
    const boxGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const edges = new THREE.EdgesGeometry(boxGeometry);
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color, 
      linewidth: lineWidth 
    });
    this._outlineHelper = new THREE.LineSegments(edges, lineMaterial);
    
    // Center the outline
    const center = box.getCenter(new THREE.Vector3());
    this._outlineHelper.position.copy(center).sub(this._position);
    
    this._mesh.add(this._outlineHelper);
    this._isOutlineVisible = true;
  }

  /**
   * Hide selection outline
   */
  public hideOutline(): void {
    if (!this._isOutlineVisible || !this._outlineHelper) return;

    this._mesh.remove(this._outlineHelper);
    this._outlineHelper = null;
    this._isOutlineVisible = false;
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.hideOutline();
    this._mesh.children.forEach((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => mat.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
  }
}
