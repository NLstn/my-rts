# RTS Game

A web-based real-time strategy game built with Vite, TypeScript, and Phaser 3.

## Features

- 🏗️ Base building system
- 💎 Resource collection mechanics
- ⚔️ Combat system (coming soon)
- 🎮 Interactive game world
- 📱 Responsive design

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

## Documentation

See [Agent.md](./Agent.md) for detailed documentation about the project structure, architecture, and development guidelines.

## Tech Stack

- **Vite** - Build tool and dev server
- **TypeScript** - Type-safe JavaScript
- **Phaser 3** - Game framework
- **Vitest** - Testing framework
- **ESLint** - Code linting

## Development

```bash
npm run dev         # Start dev server
npm run lint        # Check code quality
npm run lint:fix    # Auto-fix linting issues
npm run test        # Run tests
npm run test:ui     # Run tests with UI
```

## Game Controls

- **Click** - Select buildings and collect resources
- **Hover** - Preview interactive elements

## Project Structure

```
src/
├── scenes/          # Phaser game scenes
│   ├── BootScene.ts
│   ├── MainMenuScene.ts
│   └── GameScene.ts
├── main.ts          # Game initialization
└── game.test.ts     # Tests
```

## License

MIT
