# RTS Game - Agent Documentation

## Project Goal

This repository contains a web-based **Real-Time Strategy (RTS) game** where players can:
- Build and manage a base
- Collect resources from the game world
- Construct buildings and structures
- Defend against enemies
- Expand their territory

The game is built using modern web technologies to deliver a smooth, interactive gaming experience directly in the browser.

---

## Technology Stack

### Core Framework
- **Vite** - Fast, modern build tool optimized for development speed
- **TypeScript** - Type-safe JavaScript for robust code
- **Phaser 3** - Powerful 2D game framework for rendering and physics

### Development Tools
- **ESLint** - Code linting with TypeScript support
- **Vitest** - Fast unit testing framework
- **Happy-DOM** - Lightweight DOM implementation for testing

---

## Project Structure

```
my-rts/
├── src/
│   ├── scenes/           # Phaser game scenes
│   │   ├── BootScene.ts      # Initial loading scene
│   │   ├── MainMenuScene.ts  # Main menu interface
│   │   └── GameScene.ts      # Main gameplay scene
│   ├── main.ts           # Game initialization and configuration
│   └── game.test.ts      # Unit tests
├── index.html            # Entry HTML file
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite build configuration
├── vitest.config.ts      # Test configuration
└── eslint.config.js      # Linting rules
```

---

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher recommended)
- npm (comes with Node.js)

### Installation

1. **Clone the repository** (if not already done):
   ```bash
   cd /workspaces/my-rts
   ```

2. **Install dependencies** (already completed):
   ```bash
   npm install
   ```

### Available Commands

#### Development
```bash
npm run dev
```
Starts the development server at `http://localhost:5173/`. Features hot module replacement for instant updates during development.

#### Building for Production
```bash
npm run build
```
Compiles TypeScript and builds optimized production files to the `dist/` directory.

#### Preview Production Build
```bash
npm run preview
```
Serves the production build locally for testing.

#### Linting
```bash
npm run lint          # Check for linting errors
npm run lint:fix      # Automatically fix linting errors
```

#### Testing
```bash
npm run test          # Run tests in watch mode
npm run test:ui       # Run tests with UI interface
npm run test:coverage # Generate test coverage report
```

---

## Game Architecture

### Scene System

The game uses Phaser's scene system to organize different game states:

1. **BootScene** - Handles initial asset loading and setup
2. **MainMenuScene** - Provides the entry point with game start options
3. **GameScene** - Contains the main gameplay logic

### Core Gameplay Features (Current Implementation)

#### Resource Management
- Players start with 100 resources
- Resource nodes appear on the map (gold circles)
- Clicking a resource node collects +10 resources
- Resources are displayed in the UI

#### Building System
- Base building is pre-placed at game start
- Buildings are interactive rectangles with labels
- Clicking buildings provides visual feedback
- Grid system helps with placement visualization

#### UI Elements
- Resource counter (top-right)
- Main menu button (top-left)
- Instructions (bottom)
- Interactive buttons with hover effects

---

## Development Guidelines

### Code Style
- Use TypeScript for all game logic
- Follow ESLint rules (configured in `eslint.config.js`)
- Use meaningful variable and function names
- Add comments for complex game logic

### Testing
- Write unit tests for game mechanics
- Test resource calculations and game state
- Use Vitest for fast test execution
- Aim for good test coverage of critical systems

### Scene Development
- Keep scenes focused on specific responsibilities
- Use private methods for internal scene logic
- Leverage Phaser's built-in systems (tweens, physics, etc.)
- Maintain clean separation between UI and game logic

---

## Next Steps for Development

### Immediate Enhancements
1. **Unit System** - Create worker/soldier units that can move and interact
2. **Building Construction** - Implement building placement system
3. **Resource Gathering** - Automate resource collection with worker units
4. **Enemy AI** - Add basic enemy units and combat mechanics
5. **Camera Controls** - Implement panning and zooming

### Advanced Features
1. **Multiple Resource Types** - Add wood, stone, food, etc.
2. **Tech Tree** - Research and upgrades system
3. **Fog of War** - Implement visibility mechanics
4. **Multiplayer** - Add networking for PvP gameplay
5. **Save/Load** - Persist game state

### Asset Integration
1. Replace placeholder graphics with sprites
2. Add sound effects and music
3. Create particle effects for visual feedback
4. Design proper UI elements and HUD

---

## Game Controls (Current)

- **Mouse Click** - Select buildings, collect resources
- **Hover** - Preview interactive elements

---

## Performance Considerations

- Phaser uses WebGL for hardware-accelerated rendering
- Vite provides fast HMR (Hot Module Replacement)
- Arcade physics is lightweight and suitable for RTS games
- Consider object pooling for units/projectiles at scale

---

## Troubleshooting

### Development Server Won't Start
- Ensure all dependencies are installed: `npm install`
- Check that port 5173 is not in use
- Clear node_modules and reinstall if needed

### Build Errors
- Run `npm run lint` to check for code issues
- Verify TypeScript compilation: `tsc --noEmit`
- Check that all imports are correct

### Game Not Rendering
- Check browser console for errors
- Verify that Phaser is properly imported
- Ensure the `game-container` div exists in index.html

---

## Resources

- [Phaser 3 Documentation](https://photonstorm.github.io/phaser3-docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)

---

## Contributing

When adding new features:
1. Create new scene files in `src/scenes/`
2. Add game logic classes in appropriate subdirectories
3. Write tests for new mechanics
4. Update this documentation
5. Ensure code passes linting: `npm run lint`
6. Run tests before committing: `npm run test`

---

## License

This project is set up for educational and development purposes.

---

**Happy Game Development! 🎮**
