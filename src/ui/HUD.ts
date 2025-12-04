/**
 * HUD (Heads-Up Display) manages the in-game UI elements
 */
export class HUD {
  private _container: HTMLElement;
  private _menuButton: HTMLButtonElement;
  private _pauseMenu: HTMLElement;
  private _continueButton: HTMLButtonElement;
  private _mainMenuButton: HTMLButtonElement;
  private _isMenuOpen = false;
  private _onPauseCallback?: () => void;
  private _onResumeCallback?: () => void;
  private _onMainMenuCallback?: () => void;
  
  // Bottom HUD components
  private _bottomHUD: HTMLElement;
  private _selectedEntityPanel: HTMLElement;
  private _actionMenu: HTMLElement;
  private _minimap: HTMLElement;

  constructor() {
    this._container = this._createContainer();
    this._menuButton = this._createMenuButton();
    this._pauseMenu = this._createPauseMenu();
    this._continueButton = this._createContinueButton();
    this._mainMenuButton = this._createMainMenuButton();
    
    // Create bottom HUD components
    this._bottomHUD = this._createBottomHUD();
    this._selectedEntityPanel = this._createSelectedEntityPanel();
    this._actionMenu = this._createActionMenu();
    this._minimap = this._createMinimap();

    this._setupPauseMenu();
    this._setupBottomHUD();
    this._setupEventListeners();
    
    document.body.appendChild(this._container);
  }

  private _createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'hud-container';
    container.className = 'hud-container';
    return container;
  }

  private _createMenuButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.id = 'menu-button';
    button.className = 'menu-button';
    button.textContent = 'Menu';
    return button;
  }

  private _createPauseMenu(): HTMLElement {
    const menu = document.createElement('div');
    menu.id = 'pause-menu';
    menu.className = 'pause-menu';
    menu.style.display = 'none';

    const menuContent = document.createElement('div');
    menuContent.className = 'pause-menu-content';

    const title = document.createElement('h2');
    title.className = 'pause-menu-title';
    title.textContent = 'Game Paused';

    menuContent.appendChild(title);
    menu.appendChild(menuContent);

    return menu;
  }

  private _createContinueButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'pause-menu-button';
    button.textContent = 'Continue Game';
    return button;
  }

  private _createMainMenuButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'pause-menu-button pause-menu-button-secondary';
    button.textContent = 'Main Menu';
    return button;
  }

  private _createBottomHUD(): HTMLElement {
    const bottomHUD = document.createElement('div');
    bottomHUD.className = 'bottom-hud';
    return bottomHUD;
  }

  private _createSelectedEntityPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'selected-entity-panel';
    
    const placeholder = document.createElement('div');
    placeholder.className = 'entity-placeholder';
    placeholder.textContent = 'Selected Entity';
    
    const entityIcon = document.createElement('div');
    entityIcon.className = 'entity-icon';
    entityIcon.textContent = '🏛️';
    
    const entityInfo = document.createElement('div');
    entityInfo.className = 'entity-info';
    
    const entityName = document.createElement('div');
    entityName.className = 'entity-name';
    entityName.textContent = 'Building Name';
    
    const entityStats = document.createElement('div');
    entityStats.className = 'entity-stats';
    entityStats.textContent = 'HP: 100/100';
    
    entityInfo.appendChild(entityName);
    entityInfo.appendChild(entityStats);
    
    panel.appendChild(entityIcon);
    panel.appendChild(entityInfo);
    
    return panel;
  }

  private _createActionMenu(): HTMLElement {
    const menu = document.createElement('div');
    menu.className = 'action-menu';
    
    const placeholder = document.createElement('div');
    placeholder.className = 'action-placeholder';
    placeholder.textContent = 'Action Menu';
    
    // Create placeholder action buttons
    for (let i = 0; i < 6; i++) {
      const actionButton = document.createElement('button');
      actionButton.className = 'action-button';
      actionButton.textContent = `A${i + 1}`;
      menu.appendChild(actionButton);
    }
    
    return menu;
  }

  private _createMinimap(): HTMLElement {
    const minimap = document.createElement('div');
    minimap.className = 'minimap';
    
    const minimapCanvas = document.createElement('canvas');
    minimapCanvas.className = 'minimap-canvas';
    minimapCanvas.width = 200;
    minimapCanvas.height = 200;
    
    const placeholder = document.createElement('div');
    placeholder.className = 'minimap-placeholder';
    placeholder.textContent = 'Minimap';
    
    minimap.appendChild(minimapCanvas);
    minimap.appendChild(placeholder);
    
    return minimap;
  }

  private _setupPauseMenu(): void {
    const menuContent = this._pauseMenu.querySelector('.pause-menu-content');
    if (menuContent) {
      menuContent.appendChild(this._continueButton);
      menuContent.appendChild(this._mainMenuButton);
    }
  }

  private _setupBottomHUD(): void {
    this._bottomHUD.appendChild(this._selectedEntityPanel);
    this._bottomHUD.appendChild(this._actionMenu);
    this._bottomHUD.appendChild(this._minimap);
  }

  private _setupEventListeners(): void {
    this._menuButton.addEventListener('click', () => this._toggleMenu());
    this._continueButton.addEventListener('click', () => this._closeMenu());
    this._mainMenuButton.addEventListener('click', () => this._returnToMainMenu());
  }

  private _toggleMenu(): void {
    if (this._isMenuOpen) {
      this._closeMenu();
    } else {
      this._openMenu();
    }
  }

  private _openMenu(): void {
    this._isMenuOpen = true;
    this._pauseMenu.style.display = 'flex';
    if (this._onPauseCallback) {
      this._onPauseCallback();
    }
  }

  private _closeMenu(): void {
    this._isMenuOpen = false;
    this._pauseMenu.style.display = 'none';
    if (this._onResumeCallback) {
      this._onResumeCallback();
    }
  }

  private _returnToMainMenu(): void {
    this._closeMenu();
    if (this._onMainMenuCallback) {
      this._onMainMenuCallback();
    }
  }

  /**
   * Set callback for when game is paused
   */
  public onPause(callback: () => void): void {
    this._onPauseCallback = callback;
  }

  /**
   * Set callback for when game is resumed
   */
  public onResume(callback: () => void): void {
    this._onResumeCallback = callback;
  }

  /**
   * Set callback for when returning to main menu
   */
  public onMainMenu(callback: () => void): void {
    this._onMainMenuCallback = callback;
  }

  /**
   * Show the HUD
   */
  public show(): void {
    this._container.style.display = 'block';
    this._container.appendChild(this._menuButton);
    this._container.appendChild(this._pauseMenu);
    this._container.appendChild(this._bottomHUD);
  }

  /**
   * Hide the HUD
   */
  public hide(): void {
    this._container.style.display = 'none';
  }

  /**
   * Check if menu is currently open
   */
  public get isMenuOpen(): boolean {
    return this._isMenuOpen;
  }

  /**
   * Clean up HUD elements
   */
  public dispose(): void {
    this._menuButton.removeEventListener('click', () => this._toggleMenu());
    this._continueButton.removeEventListener('click', () => this._closeMenu());
    this._mainMenuButton.removeEventListener('click', () => this._returnToMainMenu());
    
    if (this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
  }
}
