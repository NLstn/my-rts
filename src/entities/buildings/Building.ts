import * as THREE from 'three';

export interface BuildingConfig {
  name: string;
  cost: {
    wood?: number;
    stone?: number;
    gold?: number;
    food?: number;
  };
  buildTime: number;
  maxHealth: number;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
}

export abstract class Building {
  protected _mesh: THREE.Group;
  protected _position: THREE.Vector3;
  protected _health: number;
  protected _maxHealth: number;
  protected _isConstructed: boolean;
  protected _buildProgress: number;
  protected _config: BuildingConfig;

  constructor(config: BuildingConfig, position: THREE.Vector3) {
    this._config = config;
    this._position = position.clone();
    this._maxHealth = config.maxHealth;
    this._health = config.maxHealth;
    this._isConstructed = false;
    this._buildProgress = 0;
    this._mesh = new THREE.Group();
    this._mesh.position.copy(this._position);

    this._createModel();
  }

  protected abstract _createModel(): void;

  public update(_deltaTime: number): void {
    // Update building logic
    if (!this._isConstructed) {
      // Construction progress would be updated here
      // For now, instantly construct
      this._isConstructed = true;
      this._buildProgress = 1;
    }
  }

  public takeDamage(amount: number): void {
    this._health = Math.max(0, this._health - amount);
  }

  public repair(amount: number): void {
    this._health = Math.min(this._maxHealth, this._health + amount);
  }

  public getMesh(): THREE.Group {
    return this._mesh;
  }

  public getPosition(): THREE.Vector3 {
    return this._position.clone();
  }

  public getHealth(): number {
    return this._health;
  }

  public getMaxHealth(): number {
    return this._maxHealth;
  }

  public isDestroyed(): boolean {
    return this._health <= 0;
  }

  public isConstructed(): boolean {
    return this._isConstructed;
  }

  public getBuildProgress(): number {
    return this._buildProgress;
  }

  public showOutline(color: number, linewidth: number = 2): void {
    this.hideOutline();

    // Create outline around actual model geometry
    this._mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const edgesGeometry = new THREE.EdgesGeometry(child.geometry, 15); // 15 degree threshold
        const edgesMaterial = new THREE.LineBasicMaterial({
          color,
          linewidth,
          transparent: true,
          opacity: 0.9,
        });
        const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        edges.userData.isOutline = true;
        child.add(edges);
      }
    });
  }

  public hideOutline(): void {
    // Remove all outline edges from mesh children
    this._mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const outlines = child.children.filter((c) => c.userData.isOutline);
        outlines.forEach((outline) => {
          child.remove(outline);
          if (outline instanceof THREE.LineSegments) {
            outline.geometry.dispose();
            (outline.material as THREE.Material).dispose();
          }
        });
      }
    });
  }

  public dispose(): void {
    // Clean up outline
    this.hideOutline();

    // Clean up Three.js objects
    this._mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
