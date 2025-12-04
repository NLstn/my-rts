import * as THREE from 'three';
import { HUD } from './ui/HUD';
import { Base } from './entities/buildings/Base';

class Game {
  private _scene: THREE.Scene;
  private _camera: THREE.PerspectiveCamera;
  private _renderer: THREE.WebGLRenderer;
  private _hud: HUD;
  private _isRunning = false;
  private _isPaused = false;
  private _lastTime = 0;
  private _base!: Base;
  private _raycaster: THREE.Raycaster;
  private _mouse: THREE.Vector2;
  private _selectedEntity: Base | null = null;
  private _hoveredEntity: Base | null = null;

  constructor() {
    this._scene = new THREE.Scene();
    this._camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this._renderer = new THREE.WebGLRenderer({ antialias: true });
    this._hud = new HUD();
    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
    
    this._setupRenderer();
    this._setupCamera();
    this._setupScene();
    this._setupEventListeners();
    this._setupHUD();
  }

  private _setupRenderer(): void {
    this._renderer.setSize(window.innerWidth, window.innerHeight);
    this._renderer.setPixelRatio(window.devicePixelRatio);
    const container = document.getElementById('game-container');
    if (container) {
      container.appendChild(this._renderer.domElement);
    }
  }

  private _setupCamera(): void {
    this._camera.position.set(0, 10, 20);
    this._camera.lookAt(0, 0, 0);
  }

  private _setupScene(): void {
    // Add basic lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this._scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    this._scene.add(directionalLight);

    // Add a simple ground plane
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x3a7d44,
      side: THREE.DoubleSide 
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this._scene.add(ground);

    // Add the player's base building
    this._base = new Base(new THREE.Vector3(0, 0, 0));
    this._scene.add(this._base.getMesh());
  }

  private _setupEventListeners(): void {
    window.addEventListener('resize', this._onWindowResize.bind(this));
    this._renderer.domElement.addEventListener('click', this._onCanvasClick.bind(this));
    this._renderer.domElement.addEventListener('mousemove', this._onCanvasMouseMove.bind(this));
  }

  private _setupHUD(): void {
    this._hud.onPause(() => this._pauseGame());
    this._hud.onResume(() => this._resumeGame());
    this._hud.onMainMenu(() => this._returnToMainMenu());
    this._hud.show();
  }

  private _pauseGame(): void {
    this._isPaused = true;
  }

  private _resumeGame(): void {
    this._isPaused = false;
  }

  private _returnToMainMenu(): void {
    this.stop();
    this.dispose();
    
    // Show main menu
    const menu = document.getElementById('menu');
    const gameContainer = document.getElementById('game-container');
    
    if (menu) {
      menu.style.display = 'flex';
    }
    
    if (gameContainer) {
      gameContainer.style.display = 'none';
    }
  }

  private _onWindowResize(): void {
    this._camera.aspect = window.innerWidth / window.innerHeight;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private _onCanvasMouseMove(event: MouseEvent): void {
    // Don't process hover if menu is open
    if (this._hud.isMenuOpen) return;

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = this._renderer.domElement.getBoundingClientRect();
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update the raycaster with camera and mouse position
    this._raycaster.setFromCamera(this._mouse, this._camera);

    // Check for intersections with the base building
    const baseMesh = this._base.getMesh();
    const intersects = this._raycaster.intersectObjects(baseMesh.children, true);

    const newHoveredEntity = intersects.length > 0 ? this._base : null;

    // Update hover state if changed
    if (newHoveredEntity !== this._hoveredEntity) {
      // Remove old hover outline
      if (this._hoveredEntity && this._hoveredEntity !== this._selectedEntity) {
        this._hoveredEntity.hideOutline();
      }

      this._hoveredEntity = newHoveredEntity;

      // Add new hover outline (only if not selected)
      if (this._hoveredEntity && this._hoveredEntity !== this._selectedEntity) {
        this._hoveredEntity.showOutline(0x00ffff, 3); // Cyan, bigger outline
      }
    }
  }

  private _onCanvasClick(event: MouseEvent): void {
    // Don't process clicks if menu is open
    if (this._hud.isMenuOpen) return;

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = this._renderer.domElement.getBoundingClientRect();
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update the raycaster with camera and mouse position
    this._raycaster.setFromCamera(this._mouse, this._camera);

    // Check for intersections with the base building
    const baseMesh = this._base.getMesh();
    const intersects = this._raycaster.intersectObjects(baseMesh.children, true);

    if (intersects.length > 0) {
      // Base was clicked - select it
      this._selectEntity(this._base);
    } else {
      // Clicked on empty space - deselect
      this._deselectEntity();
    }
  }

  private _selectEntity(entity: Base): void {
    // Remove old selection outline
    if (this._selectedEntity) {
      this._selectedEntity.hideOutline();
    }

    this._selectedEntity = entity;
    
    // Add selection outline (smaller, different color)
    if (this._selectedEntity) {
      this._selectedEntity.showOutline(0xffff00, 2); // Yellow, smaller outline
    }
    
    this._updateHUDSelection();
  }

  private _deselectEntity(): void {
    // Remove selection outline
    if (this._selectedEntity) {
      this._selectedEntity.hideOutline();
      
      // Restore hover outline if still hovering
      if (this._selectedEntity === this._hoveredEntity) {
        this._selectedEntity.showOutline(0x00ffff, 3);
      }
    }

    this._selectedEntity = null;
    this._updateHUDSelection();
  }

  private _updateHUDSelection(): void {
    if (this._selectedEntity) {
      this._hud.updateSelectedEntity({
        name: 'Base',
        icon: '🏛️',
        health: this._selectedEntity.getHealth(),
        maxHealth: this._selectedEntity.getMaxHealth(),
      });
    } else {
      this._hud.updateSelectedEntity(null);
    }
  }

  public start(): void {
    if (this._isRunning) return;
    
    this._isRunning = true;
    this._lastTime = performance.now();
    this._gameLoop(this._lastTime);
  }

  public stop(): void {
    this._isRunning = false;
  }

  private _gameLoop(currentTime: number): void {
    if (!this._isRunning) return;

    const deltaTime = (currentTime - this._lastTime) / 1000;
    this._lastTime = currentTime;

    this._update(deltaTime);
    this._render();

    requestAnimationFrame(this._gameLoop.bind(this));
  }

  private _update(deltaTime: number): void {
    // Skip updates if game is paused
    if (this._isPaused) {
      return;
    }
    
    // Update buildings
    this._base.update(deltaTime);
    
    // Update HUD if an entity is selected
    if (this._selectedEntity) {
      this._updateHUDSelection();
    }
  }

  private _render(): void {
    this._renderer.render(this._scene, this._camera);
  }

  public dispose(): void {
    this._isRunning = false;
    this._hud.dispose();
    this._base.dispose();
    this._renderer.dispose();
    window.removeEventListener('resize', this._onWindowResize.bind(this));
    this._renderer.domElement.removeEventListener('click', this._onCanvasClick.bind(this));
    this._renderer.domElement.removeEventListener('mousemove', this._onCanvasMouseMove.bind(this));
  }
}

// Menu handling
const startButton = document.getElementById('start-game-btn');
const menu = document.getElementById('menu');
const gameContainer = document.getElementById('game-container');

let game: Game | null = null;

startButton?.addEventListener('click', () => {
  // Hide menu
  if (menu) {
    menu.style.display = 'none';
  }
  
  // Show game container
  if (gameContainer) {
    gameContainer.style.display = 'block';
  }
  
  // Initialize and start game
  game = new Game();
  game.start();
});
