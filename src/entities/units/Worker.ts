import * as THREE from 'three';
import { Unit, UnitConfig } from './Unit';

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

export class Worker extends Unit {
  constructor(position: THREE.Vector3) {
    super(WORKER_CONFIG, position);
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
    const armGeometry = new THREE.BoxGeometry(width * 0.25, height * 0.4, depth * 0.8);
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
    const legGeometry = new THREE.BoxGeometry(width * 0.35, height * 0.4, depth * 0.9);
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
    const handleGeometry = new THREE.CylinderGeometry(0.05, 0.05, height * 0.5, 6);
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
}

export { WORKER_CONFIG };
