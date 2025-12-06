import * as THREE from 'three';
import { HUD } from './ui/HUD';
import { ResourceHUD } from './ui/ResourceHUD';
import { Base } from './entities/buildings/Base';
import { Worker } from './entities/units/Worker';
import { Tree } from './entities/resources/Tree';
import { ResourceManager } from './core/ResourceManager';

type GameEntity = Base | Worker | Tree;

class Game {
  private _scene: THREE.Scene;
  private _camera: THREE.PerspectiveCamera;
  private _renderer: THREE.WebGLRenderer;
  private _hud: HUD;
  private _resourceHUD: ResourceHUD;
  private _resourceManager: ResourceManager;
  private _isRunning = false;
  private _isPaused = false;
  private _lastTime = 0;
  private _base!: Base;
  private _workers: Worker[] = [];
  private _trees: Tree[] = [];
  private _raycaster: THREE.Raycaster;
  private _mouse: THREE.Vector2;
  private _selectedEntity: GameEntity | null = null;
  private _hoveredEntity: GameEntity | null = null;

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
    this._resourceHUD = new ResourceHUD();
    this._resourceManager = new ResourceManager();
    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();

    this._setupRenderer();
    this._setupCamera();
    this._setupScene();
    this._setupEventListeners();
    this._setupHUD();
    this._setupResourceManager();
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
      side: THREE.DoubleSide,
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
    this._renderer.domElement.addEventListener(
      'click',
      this._onCanvasClick.bind(this)
    );
    this._renderer.domElement.addEventListener('contextmenu', (e) =>
      e.preventDefault()
    ); // Disable context menu
    this._renderer.domElement.addEventListener(
      'mousedown',
      this._onCanvasClick.bind(this)
    );
    this._renderer.domElement.addEventListener(
      'mousemove',
      this._onCanvasMouseMove.bind(this)
    );
  }

  private _setupHUD(): void {
    this._hud.onPause(() => this._pauseGame());
    this._hud.onResume(() => this._resumeGame());
    this._hud.onMainMenu(() => this._returnToMainMenu());
    this._hud.show();
  }

  private _setupResourceManager(): void {
    // Update resource HUD when resources change
    this._resourceManager.onChange((resources) => {
      this._resourceHUD.updateResources(resources);
    });

    // Initial update
    this._resourceHUD.updateResources(this._resourceManager.getResources());
    this._resourceHUD.show();

    // Spawn trees in groups around the map
    this._spawnTrees();
  }

  private _spawnTrees(): void {
    // Spawn 5 groups of trees
    const treeGroups = [
      { center: new THREE.Vector3(-15, 0, -15), count: 8 },
      { center: new THREE.Vector3(15, 0, -15), count: 6 },
      { center: new THREE.Vector3(-15, 0, 15), count: 7 },
      { center: new THREE.Vector3(15, 0, 15), count: 9 },
      { center: new THREE.Vector3(-20, 0, 0), count: 5 },
    ];

    treeGroups.forEach((group) => {
      for (let i = 0; i < group.count; i++) {
        // Random position around the group center
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 3 + 1; // 1-4 units from center
        const position = new THREE.Vector3(
          group.center.x + Math.cos(angle) * distance,
          0,
          group.center.z + Math.sin(angle) * distance
        );

        // Random size variation
        const size = 0.8 + Math.random() * 0.4; // 0.8-1.2 scale
        const tree = new Tree(position, size);
        this._trees.push(tree);
        this._scene.add(tree.getMesh());
      }
    });
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

    // Check for intersections with all entities
    let newHoveredEntity: GameEntity | null = null;

    // Check base
    const baseMesh = this._base.getMesh();
    const baseIntersects = this._raycaster.intersectObjects(
      baseMesh.children,
      true
    );
    if (baseIntersects.length > 0) {
      newHoveredEntity = this._base;
    }

    // Check workers if no base intersection
    if (!newHoveredEntity) {
      for (const worker of this._workers) {
        const workerMesh = worker.getMesh();
        const workerIntersects = this._raycaster.intersectObjects(
          workerMesh.children,
          true
        );
        if (workerIntersects.length > 0) {
          newHoveredEntity = worker;
          break;
        }
      }
    }

    // Check trees if no other intersection
    if (!newHoveredEntity) {
      for (const tree of this._trees) {
        const treeMesh = tree.getMesh();
        const treeIntersects = this._raycaster.intersectObjects(
          treeMesh.children,
          true
        );
        if (treeIntersects.length > 0) {
          newHoveredEntity = tree;
          break;
        }
      }
    }

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

    // Right-click for commands
    if (event.button === 2) {
      event.preventDefault();
      this._handleRightClick(event);
      return;
    }

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = this._renderer.domElement.getBoundingClientRect();
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update the raycaster with camera and mouse position
    this._raycaster.setFromCamera(this._mouse, this._camera);

    // Check for intersections with all entities
    let clickedEntity: GameEntity | null = null;

    // Check base
    const baseMesh = this._base.getMesh();
    const baseIntersects = this._raycaster.intersectObjects(
      baseMesh.children,
      true
    );
    if (baseIntersects.length > 0) {
      clickedEntity = this._base;
    }

    // Check workers if no base intersection
    if (!clickedEntity) {
      for (const worker of this._workers) {
        const workerMesh = worker.getMesh();
        const workerIntersects = this._raycaster.intersectObjects(
          workerMesh.children,
          true
        );
        if (workerIntersects.length > 0) {
          clickedEntity = worker;
          break;
        }
      }
    }

    // Check trees if no other intersection
    if (!clickedEntity) {
      for (const tree of this._trees) {
        const treeMesh = tree.getMesh();
        const treeIntersects = this._raycaster.intersectObjects(
          treeMesh.children,
          true
        );
        if (treeIntersects.length > 0) {
          clickedEntity = tree;
          break;
        }
      }
    }

    if (clickedEntity) {
      // Entity was clicked - select it
      this._selectEntity(clickedEntity);
    } else {
      // Clicked on empty space - deselect
      this._deselectEntity();
    }
  }

  private _handleRightClick(event: MouseEvent): void {
    if (!this._selectedEntity || !(this._selectedEntity instanceof Worker)) {
      return; // Only workers can be commanded with right-click
    }

    // Calculate mouse position
    const rect = this._renderer.domElement.getBoundingClientRect();
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update raycaster
    this._raycaster.setFromCamera(this._mouse, this._camera);

    // Check if clicking on a tree
    for (const tree of this._trees) {
      const treeMesh = tree.getMesh();
      const treeIntersects = this._raycaster.intersectObjects(
        treeMesh.children,
        true
      );
      if (treeIntersects.length > 0 && !tree.isDepleted()) {
        // Command worker to harvest this tree
        this._selectedEntity.harvestResource(tree, this._base);
        return;
      }
    }

    // If not clicking on a tree, just move to location
    const groundIntersects = this._raycaster.intersectObjects(
      this._scene.children,
      true
    );
    if (groundIntersects.length > 0) {
      const targetPosition = groundIntersects[0].point;
      this._selectedEntity.moveTo(targetPosition);
    }
  }

  /**
   * Find a nearby tree for a worker when their current resource is depleted
   */
  private _findNearbyTree(worker: Worker): Tree | null {
    const workerPos = worker.getPosition();
    const assignedResource = worker.getAssignedResource();
    const searchPos = assignedResource
      ? assignedResource.getPosition()
      : workerPos;

    let closestTree: Tree | null = null;
    let closestDistance = Infinity;
    const MAX_SEARCH_DISTANCE = 15; // Only search within 15 units

    for (const tree of this._trees) {
      if (tree.isDepleted()) continue;

      const distance = searchPos.distanceTo(tree.getPosition());
      if (distance < closestDistance && distance <= MAX_SEARCH_DISTANCE) {
        closestDistance = distance;
        closestTree = tree;
      }
    }

    return closestTree;
  }

  private _selectEntity(entity: GameEntity): void {
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
      // Determine entity name and icon
      let name = 'Unknown';
      let icon = '❓';
      let health = 0;
      let maxHealth = 0;

      if (this._selectedEntity instanceof Base) {
        name = 'Base';
        icon = '🏛️';
        health = this._selectedEntity.getHealth();
        maxHealth = this._selectedEntity.getMaxHealth();
      } else if (this._selectedEntity instanceof Worker) {
        name = 'Worker';
        icon = '👷';
        health = this._selectedEntity.getHealth();
        maxHealth = this._selectedEntity.getMaxHealth();
      } else if (this._selectedEntity instanceof Tree) {
        name = 'Tree';
        icon = '🌲';
        health = this._selectedEntity.getWoodAmount();
        maxHealth = health; // Trees don't have separate max, just show wood amount
      }

      this._hud.updateSelectedEntity({
        name,
        icon,
        health,
        maxHealth,
      });

      // Update action menu based on entity type (only on selection change)
      this._updateActionMenu();

      // Update training queue if base is selected
      if (this._selectedEntity instanceof Base) {
        const queueLength = this._selectedEntity.getQueueLength();
        const progress = this._selectedEntity.getTrainingProgress();
        this._hud.updateTrainingQueue(
          queueLength > 0 ? { count: queueLength, progress } : null
        );
      } else {
        this._hud.updateTrainingQueue(null);
      }
    } else {
      this._hud.updateSelectedEntity(null);
      this._hud.updateActionMenu(null);
      this._hud.updateTrainingQueue(null);
    }
  }

  private _updateHUDStats(): void {
    if (!this._selectedEntity) return;

    // Only update stats, not the action menu
    let name = 'Unknown';
    let icon = '❓';
    let health = 0;
    let maxHealth = 0;

    if (this._selectedEntity instanceof Base) {
      name = 'Base';
      icon = '🏛️';
      health = this._selectedEntity.getHealth();
      maxHealth = this._selectedEntity.getMaxHealth();
    } else if (this._selectedEntity instanceof Worker) {
      name = 'Worker';
      icon = '👷';
      health = this._selectedEntity.getHealth();
      maxHealth = this._selectedEntity.getMaxHealth();
    } else if (this._selectedEntity instanceof Tree) {
      name = 'Tree';
      icon = '🌲';
      health = this._selectedEntity.getWoodAmount();
      maxHealth = health;
    }

    this._hud.updateSelectedEntity({
      name,
      icon,
      health,
      maxHealth,
    });

    // Update training queue if base is selected
    if (this._selectedEntity instanceof Base) {
      const queueLength = this._selectedEntity.getQueueLength();
      const progress = this._selectedEntity.getTrainingProgress();
      this._hud.updateTrainingQueue(
        queueLength > 0 ? { count: queueLength, progress } : null
      );
    }
  }

  private _updateActionMenu(): void {
    if (!this._selectedEntity) {
      this._hud.updateActionMenu(null);
      return;
    }

    const actions = [];

    if (this._selectedEntity instanceof Base) {
      // Base actions
      actions.push({
        label: 'Train Worker',
        icon: '👷',
        callback: () => this._trainWorker(),
        enabled: true,
      });
    }

    this._hud.updateActionMenu(actions);
  }

  private _trainWorker(): void {
    if (this._selectedEntity instanceof Base) {
      this._selectedEntity.trainWorker();
      this._updateHUDStats(); // Update UI stats immediately
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

    // Check if a worker is ready to spawn
    if (this._base.hasWorkerReady()) {
      const worker = this._base.spawnWorker();

      // Set up tree finder callback for this worker
      worker.setTreeFinder(() => this._findNearbyTree(worker));

      this._workers.push(worker);
      this._scene.add(worker.getMesh());
    }

    // Update workers
    for (let i = this._workers.length - 1; i >= 0; i--) {
      const worker = this._workers[i];
      worker.update(deltaTime);

      // Check if worker is ready to deliver resources
      if (worker.isReadyToDeliver()) {
        const resources = worker.collectCarriedResources();
        if (resources.wood > 0) {
          this._resourceManager.addResource('wood', resources.wood);
        }
        if (resources.food > 0) {
          this._resourceManager.addResource('food', resources.food);
        }
        if (resources.stone > 0) {
          this._resourceManager.addResource('stone', resources.stone);
        }
      }

      // Remove dead workers
      if (worker.isDead()) {
        this._scene.remove(worker.getMesh());
        worker.dispose();
        this._workers.splice(i, 1);

        // Deselect if the dead worker was selected
        if (this._selectedEntity === worker) {
          this._deselectEntity();
        }
      }
    }

    // Update trees - remove depleted ones with fade effect
    for (let i = this._trees.length - 1; i >= 0; i--) {
      const tree = this._trees[i];
      if (tree.isDepleted()) {
        // Remove from scene and dispose
        this._scene.remove(tree.getMesh());
        tree.dispose();
        this._trees.splice(i, 1);

        // Deselect if the depleted tree was selected
        if (this._selectedEntity === tree) {
          this._deselectEntity();
        }
      }
    }

    // Update HUD stats if an entity is selected (not the action menu)
    if (this._selectedEntity) {
      this._updateHUDStats();
    }
  }

  private _render(): void {
    this._renderer.render(this._scene, this._camera);
  }

  public dispose(): void {
    this._isRunning = false;
    this._hud.dispose();
    this._resourceHUD.dispose();
    this._base.dispose();

    // Dispose all workers
    for (const worker of this._workers) {
      worker.dispose();
    }
    this._workers = [];

    // Dispose all trees
    for (const tree of this._trees) {
      tree.dispose();
    }
    this._trees = [];

    this._renderer.dispose();
    window.removeEventListener('resize', this._onWindowResize.bind(this));
    this._renderer.domElement.removeEventListener(
      'click',
      this._onCanvasClick.bind(this)
    );
    this._renderer.domElement.removeEventListener(
      'mousedown',
      this._onCanvasClick.bind(this)
    );
    this._renderer.domElement.removeEventListener(
      'mousemove',
      this._onCanvasMouseMove.bind(this)
    );
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
