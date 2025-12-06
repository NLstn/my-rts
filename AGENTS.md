# AI Agent Guidelines

This document provides guidelines for AI coding agents (like GitHub Copilot, Cursor, etc.) working on this RTS game project.

## Project Context

This is a browser-based real-time strategy game inspired by Anno, Age of Empires, Age of Mythology, and The Settlers. The game is built with TypeScript and Three.js, targeting modern web browsers.

### Core Technologies

- **TypeScript**: All game code should be strongly typed
- **Three.js**: For 3D rendering and scene management
- **Vite**: Build tool and dev server
- **ESLint + Prettier**: Code quality standards

## Architecture Principles

### 1. Entity-Component-System (ECS) Pattern

Consider using an ECS-like architecture for game objects:

- **Entities**: Game objects (units, buildings, resources)
- **Components**: Data containers (position, health, sprite)
- **Systems**: Logic processors (rendering, movement, combat)

### 2. Separation of Concerns

- Keep game logic separate from rendering
- Separate input handling from game state
- Use dependency injection where appropriate

### 3. Performance Considerations

- Optimize for 60 FPS gameplay
- Use object pooling for frequently created/destroyed entities
- Implement spatial partitioning for collision detection
- Batch draw calls where possible with Three.js

### 4. Code Organization

```
src/
├── core/           # Core engine (game loop, state management)
├── entities/       # Game entities (units, buildings, resources)
├── components/     # ECS components
├── systems/        # ECS systems
├── rendering/      # Three.js rendering logic
├── input/          # Input handling (mouse, keyboard)
├── ai/             # AI logic for NPCs
├── ui/             # UI elements and HUD
├── utils/          # Helper functions
└── types/          # TypeScript type definitions
```

## Coding Standards

### TypeScript Guidelines

1. **Use strict mode**: Enable all strict TypeScript checks
2. **Avoid `any`**: Use proper types or `unknown` with type guards
3. **Interfaces over types**: Prefer interfaces for object shapes
4. **Named exports**: Use named exports instead of default exports
5. **Immutability**: Prefer const and readonly where appropriate

### Naming Conventions

- **Classes**: PascalCase (e.g., `GameEngine`, `UnitController`)
- **Interfaces**: PascalCase with "I" prefix optional (e.g., `IRenderable` or `Renderable`)
- **Functions/Methods**: camelCase (e.g., `updateGameState`, `renderScene`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_UNITS`, `GRID_SIZE`)
- **Private members**: prefix with underscore (e.g., `_internalState`)

### File Structure

```typescript
// 1. Imports (grouped: external, internal, types)
import * as THREE from 'three';
import { GameEngine } from './core/GameEngine';
import type { Position, GameEntity } from './types';

// 2. Constants
const MAX_ZOOM = 100;
const MIN_ZOOM = 10;

// 3. Types/Interfaces
interface BuildingConfig {
  cost: ResourceCost;
  buildTime: number;
}

// 4. Main class/function
export class Building implements GameEntity {
  // Properties
  private _position: Position;

  // Constructor
  constructor(position: Position) {
    this._position = position;
  }

  // Public methods
  public update(deltaTime: number): void {
    // Implementation
  }

  // Private methods
  private _checkResources(): boolean {
    // Implementation
  }
}
```

## Game Design Considerations

### Resource Types

- **Wood**: For basic construction
- **Stone**: For advanced buildings and defenses
- **Food**: For population growth and unit maintenance
- **Gold**: For trading and advanced units

### Building Categories

- **Residential**: Houses, apartments (increase population)
- **Production**: Sawmill, quarry, farm (generate resources)
- **Storage**: Warehouses, granaries (store resources)
- **Military**: Barracks, archery range (train units)
- **Special**: Markets, temples (special functions)

### Unit Types

- **Villagers/Workers**: Gather resources, construct buildings
- **Military Units**: Various tiers (infantry, archers, cavalry)
- **Heroes**: Special powerful units (Age of Mythology style)

## Common Patterns

### Game Loop

```typescript
class GameEngine {
  private _lastTime = 0;

  public start(): void {
    requestAnimationFrame(this._gameLoop.bind(this));
  }

  private _gameLoop(currentTime: number): void {
    const deltaTime = currentTime - this._lastTime;
    this._lastTime = currentTime;

    this._update(deltaTime);
    this._render();

    requestAnimationFrame(this._gameLoop.bind(this));
  }
}
```

### Resource Management

```typescript
interface ResourceManager {
  resources: Map<ResourceType, number>;
  addResource(type: ResourceType, amount: number): void;
  removeResource(type: ResourceType, amount: number): boolean;
  hasEnough(cost: ResourceCost): boolean;
}
```

### Event System

```typescript
class EventBus {
  private _listeners = new Map<string, Set<Function>>();

  on(event: string, callback: Function): void;
  off(event: string, callback: Function): void;
  emit(event: string, data?: any): void;
}
```

## Mandatory Quality Checks

### Before Committing Code

**CRITICAL**: All code changes MUST pass the following checks before being committed:

1. **Build Validation**: Run `npm run build` to ensure the project builds
   - Build must succeed without errors
   - Check for any build warnings
   - TypeScript type checking happens during build

2. **Linting**: Run `npm run lint` to check for code quality issues
   - Fix all errors and warnings
   - No eslint-disable comments without justification

3. **Testing**: Run `npm test` once test suite is implemented
   - All tests must pass
   - Add tests for new features
   - Update tests for modified features

## Testing Guidelines

1. **Unit Tests**: Test pure functions and game logic
2. **Integration Tests**: Test system interactions
3. **Performance Tests**: Monitor frame rate and memory usage

```typescript
describe('ResourceManager', () => {
  it('should add resources correctly', () => {
    const manager = new ResourceManager();
    manager.addResource('wood', 100);
    expect(manager.getResource('wood')).toBe(100);
  });
});
```

### Test Coverage Requirements

- Aim for 80%+ code coverage for game logic
- 100% coverage for critical systems (resource management, state management)
- All public APIs must have tests
- Edge cases and error conditions must be tested

## Performance Best Practices

1. **Three.js Optimization**:
   - Reuse geometries and materials
   - Use InstancedMesh for repeated objects
   - Implement frustum culling
   - Use LOD (Level of Detail) for distant objects

2. **Game Logic**:
   - Update only what's necessary each frame
   - Use spatial hashing for entity queries
   - Implement dirty flags for state changes

3. **Memory Management**:
   - Dispose Three.js objects when no longer needed
   - Use object pools for bullets, effects, etc.
   - Avoid memory leaks in event listeners

## Documentation

- Add JSDoc comments for public APIs
- Document complex algorithms
- Keep README updated with new features
- Maintain this AGENTS.md with architectural decisions

## Questions to Ask

When implementing new features, consider:

1. Does this fit the ECS architecture?
2. How will this perform with 1000+ entities?
3. Is this properly typed?
4. Does this need to be configurable?
5. How will this work in multiplayer (future consideration)?

## Resources

- [Three.js Documentation](https://threejs.org/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Game Programming Patterns](https://gameprogrammingpatterns.com/)
- [RTS Game Development Resources](https://www.gamedeveloper.com/)

## Notes for Future Development

### Multiplayer Considerations

- Design with deterministic simulation in mind
- Separate visual representation from game state
- Plan for client-side prediction and server reconciliation

### Modding Support

- Consider plugin architecture
- Make game data data-driven (JSON configs)
- Provide clear APIs for custom content

### Accessibility

- Keyboard navigation support
- Colorblind-friendly UI
- Adjustable UI scaling
- Alternative control schemes

---

**Remember**: This is a long-term project. Focus on building a solid foundation with clean, maintainable code. Performance and polish come after functionality.
