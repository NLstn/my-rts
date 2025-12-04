import * as THREE from 'three';

export interface UnitConfig {
  name: string;
  cost: {
    wood?: number;
    stone?: number;
    gold?: number;
    food?: number;
  };
  trainTime: number;
  maxHealth: number;
  moveSpeed: number;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
}

export abstract class Unit {
  protected _mesh: THREE.Group;
  protected _position: THREE.Vector3;
  protected _health: number;
  protected _maxHealth: number;
  protected _config: UnitConfig;
  protected _moveSpeed: number;
  protected _isMoving: boolean;
  protected _targetPosition: THREE.Vector3 | null;

  constructor(config: UnitConfig, position: THREE.Vector3) {
    this._config = config;
    this._position = position.clone();
    this._maxHealth = config.maxHealth;
    this._health = config.maxHealth;
    this._moveSpeed = config.moveSpeed;
    this._isMoving = false;
    this._targetPosition = null;
    this._mesh = new THREE.Group();
    this._mesh.position.copy(this._position);
    
    this._createModel();
  }

  protected abstract _createModel(): void;

  public update(deltaTime: number): void {
    // Update movement logic
    if (this._isMoving && this._targetPosition) {
      const direction = new THREE.Vector3()
        .subVectors(this._targetPosition, this._position)
        .normalize();
      
      const distance = this._position.distanceTo(this._targetPosition);
      const moveDistance = this._moveSpeed * deltaTime;
      
      if (distance <= moveDistance) {
        // Reached target
        this._position.copy(this._targetPosition);
        this._mesh.position.copy(this._position);
        this._isMoving = false;
        this._targetPosition = null;
      } else {
        // Move towards target
        this._position.add(direction.multiplyScalar(moveDistance));
        this._mesh.position.copy(this._position);
        
        // Rotate to face direction of movement
        const angle = Math.atan2(direction.x, direction.z);
        this._mesh.rotation.y = angle;
      }
    }
  }

  public moveTo(target: THREE.Vector3): void {
    this._targetPosition = target.clone();
    this._isMoving = true;
  }

  public takeDamage(amount: number): void {
    this._health = Math.max(0, this._health - amount);
  }

  public heal(amount: number): void {
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

  public isDead(): boolean {
    return this._health <= 0;
  }

  public getName(): string {
    return this._config.name;
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
        const outlines = child.children.filter(c => c.userData.isOutline);
        outlines.forEach(outline => {
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
          child.material.forEach(mat => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
