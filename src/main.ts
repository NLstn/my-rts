import * as THREE from 'three';

class Game {
  private _scene: THREE.Scene;
  private _camera: THREE.PerspectiveCamera;
  private _renderer: THREE.WebGLRenderer;
  private _isRunning = false;
  private _lastTime = 0;

  constructor() {
    this._scene = new THREE.Scene();
    this._camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this._renderer = new THREE.WebGLRenderer({ antialias: true });
    
    this._setupRenderer();
    this._setupCamera();
    this._setupScene();
    this._setupEventListeners();
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
    this._scene.add(ground);

    // Add a test cube
    const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
    const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.set(0, 1, 0);
    this._scene.add(cube);
  }

  private _setupEventListeners(): void {
    window.addEventListener('resize', this._onWindowResize.bind(this));
  }

  private _onWindowResize(): void {
    this._camera.aspect = window.innerWidth / window.innerHeight;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(window.innerWidth, window.innerHeight);
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

  private _update(_deltaTime: number): void {
    // Game logic updates will go here
  }

  private _render(): void {
    this._renderer.render(this._scene, this._camera);
  }

  public dispose(): void {
    this._isRunning = false;
    this._renderer.dispose();
    window.removeEventListener('resize', this._onWindowResize.bind(this));
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
