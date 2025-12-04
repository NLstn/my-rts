import * as THREE from 'three';
import { Building, BuildingConfig } from './Building';

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

export class Base extends Building {
  constructor(position: THREE.Vector3) {
    super(BASE_CONFIG, position);
    this._isConstructed = true; // Base starts fully constructed
    this._buildProgress = 1;
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
    roof.position.y = height * 0.7 + (height * 0.15);
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
    const windowGeometry = new THREE.BoxGeometry(width * 0.15, height * 0.15, 0.1);
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
    const foundationGeometry = new THREE.BoxGeometry(width * 1.1, 0.3, depth * 1.1);
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
    pole.position.set(width * 0.5, height * 0.7 + (height * 0.4), 0);
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
      child => child instanceof THREE.Mesh && 
      child.geometry instanceof THREE.PlaneGeometry
    );
    
    if (flag) {
      const time = Date.now() * 0.001;
      flag.rotation.y = Math.sin(time * 2) * 0.1;
    }
  }
}
