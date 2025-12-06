import {
  ResourceInventory,
  BASIC_RESOURCES,
  ADVANCED_RESOURCES,
  RESOURCE_NAMES,
  RESOURCE_COLORS,
} from '../types/ResourceTypes';

/**
 * HUD component for displaying player resources
 */
export class ResourceHUD {
  private _container: HTMLDivElement;
  private _basicResourcesContainer: HTMLDivElement;
  private _advancedResourcesContainer: HTMLDivElement;
  private _expandButton: HTMLButtonElement;
  private _isExpanded: boolean;
  private _resourceElements: Map<string, HTMLSpanElement>;

  constructor() {
    this._isExpanded = false;
    this._resourceElements = new Map();
    this._container = this._createContainer();
    this._basicResourcesContainer = this._createBasicResourcesContainer();
    this._advancedResourcesContainer = this._createAdvancedResourcesContainer();
    this._expandButton = this._createExpandButton();

    this._container.appendChild(this._basicResourcesContainer);
    this._container.appendChild(this._expandButton);
    this._container.appendChild(this._advancedResourcesContainer);

    document.body.appendChild(this._container);
  }

  private _createContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '10px';
    container.style.right = '10px';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    container.style.color = 'white';
    container.style.padding = '15px';
    container.style.borderRadius = '8px';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.fontSize = '14px';
    container.style.minWidth = '200px';
    container.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.5)';
    container.style.zIndex = '100';
    return container;
  }

  private _createBasicResourcesContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.style.marginBottom = '10px';

    BASIC_RESOURCES.forEach((resourceType) => {
      const resourceRow = document.createElement('div');
      resourceRow.style.display = 'flex';
      resourceRow.style.justifyContent = 'space-between';
      resourceRow.style.alignItems = 'center';
      resourceRow.style.marginBottom = '8px';

      const nameLabel = document.createElement('span');
      nameLabel.textContent = RESOURCE_NAMES[resourceType] + ':';
      nameLabel.style.fontWeight = 'bold';
      nameLabel.style.color = RESOURCE_COLORS[resourceType];

      const valueLabel = document.createElement('span');
      valueLabel.textContent = '0';
      valueLabel.style.marginLeft = '10px';
      valueLabel.style.minWidth = '50px';
      valueLabel.style.textAlign = 'right';

      this._resourceElements.set(resourceType, valueLabel);

      resourceRow.appendChild(nameLabel);
      resourceRow.appendChild(valueLabel);
      container.appendChild(resourceRow);
    });

    return container;
  }

  private _createAdvancedResourcesContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.style.marginTop = '10px';
    container.style.paddingTop = '10px';
    container.style.borderTop = '1px solid rgba(255, 255, 255, 0.3)';
    container.style.display = 'none'; // Hidden by default

    ADVANCED_RESOURCES.forEach((resourceType) => {
      const resourceRow = document.createElement('div');
      resourceRow.style.display = 'flex';
      resourceRow.style.justifyContent = 'space-between';
      resourceRow.style.alignItems = 'center';
      resourceRow.style.marginBottom = '8px';

      const nameLabel = document.createElement('span');
      nameLabel.textContent = RESOURCE_NAMES[resourceType] + ':';
      nameLabel.style.fontWeight = 'bold';
      nameLabel.style.color = RESOURCE_COLORS[resourceType];

      const valueLabel = document.createElement('span');
      valueLabel.textContent = '0';
      valueLabel.style.marginLeft = '10px';
      valueLabel.style.minWidth = '50px';
      valueLabel.style.textAlign = 'right';

      this._resourceElements.set(resourceType, valueLabel);

      resourceRow.appendChild(nameLabel);
      resourceRow.appendChild(valueLabel);
      container.appendChild(resourceRow);
    });

    return container;
  }

  private _createExpandButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = '▼ More Resources';
    button.style.width = '100%';
    button.style.padding = '8px';
    button.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    button.style.color = 'white';
    button.style.border = '1px solid rgba(255, 255, 255, 0.3)';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.style.fontSize = '12px';
    button.style.transition = 'background-color 0.2s';

    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    });

    button.addEventListener('click', () => {
      this._toggleExpanded();
    });

    return button;
  }

  private _toggleExpanded(): void {
    this._isExpanded = !this._isExpanded;

    if (this._isExpanded) {
      this._advancedResourcesContainer.style.display = 'block';
      this._expandButton.textContent = '▲ Less Resources';
    } else {
      this._advancedResourcesContainer.style.display = 'none';
      this._expandButton.textContent = '▼ More Resources';
    }
  }

  /**
   * Update resource values in the HUD
   */
  public updateResources(resources: ResourceInventory): void {
    Object.entries(resources).forEach(([resourceType, value]) => {
      const element = this._resourceElements.get(resourceType);
      if (element) {
        element.textContent = Math.floor(value).toString();
      }
    });
  }

  /**
   * Show the resource HUD
   */
  public show(): void {
    this._container.style.display = 'block';
  }

  /**
   * Hide the resource HUD
   */
  public hide(): void {
    this._container.style.display = 'none';
  }

  /**
   * Clean up the HUD
   */
  public dispose(): void {
    document.body.removeChild(this._container);
  }
}
