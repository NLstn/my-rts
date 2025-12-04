# RTS Game

A real-time strategy game inspired by classics like Anno, Age of Empires, Age of Mythology, and The Settlers. Built with TypeScript and Three.js for browser-based gameplay.

## Overview

This project aims to create a modern, browser-based RTS game featuring:

- **Resource Management**: Gather and manage resources like wood, stone, food, and gold
- **Building Construction**: Construct various buildings to support your civilization
- **Unit Control**: Train and command different types of units
- **Territory Expansion**: Expand your settlement and control strategic locations
- **3D Graphics**: Immersive 3D environment powered by Three.js

## Tech Stack

- **TypeScript**: Type-safe game logic and architecture
- **Three.js**: 3D rendering and graphics
- **Vite**: Fast development server and build tool
- **ESLint & Prettier**: Code quality and formatting

## Getting Started

### Prerequisites

- Docker or compatible container runtime
- VS Code with Remote - Containers extension

### Development Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd my-rts
   ```

2. Open in VS Code:
   ```bash
   code .
   ```

3. When prompted, click "Reopen in Container" (or use Command Palette: `Remote-Containers: Reopen in Container`)

4. The devcontainer will automatically install dependencies via `npm install`

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open your browser to `http://localhost:5173`

## Project Structure

```
my-rts/
├── .devcontainer/          # Development container configuration
├── src/                    # Source code
│   ├── core/              # Core game engine
│   ├── entities/          # Game entities (units, buildings, resources)
│   ├── systems/           # Game systems (rendering, input, AI)
│   ├── utils/             # Utility functions
│   └── main.ts            # Entry point
├── public/                 # Static assets
├── tests/                  # Test files
└── docs/                   # Documentation
```

## Development Workflow

### Running the Game

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Code Quality

```bash
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run type-check   # TypeScript type checking
```

### Testing

```bash
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
```

## Game Features (Planned)

### Phase 1: Core Foundation
- [x] Project setup and devcontainer
- [ ] Basic 3D scene with Three.js
- [ ] Camera controls (pan, zoom, rotate)
- [ ] Terrain generation
- [ ] Grid system for building placement

### Phase 2: Resource Management
- [ ] Resource types (wood, stone, food, gold)
- [ ] Resource gathering mechanics
- [ ] Resource display UI
- [ ] Storage buildings

### Phase 3: Buildings
- [ ] Building placement system
- [ ] Construction mechanics
- [ ] Building types (houses, storage, production)
- [ ] Building upgrades

### Phase 4: Units
- [ ] Unit creation and management
- [ ] Pathfinding
- [ ] Unit selection and commands
- [ ] Different unit types (workers, soldiers, etc.)

### Phase 5: Game Mechanics
- [ ] Day/night cycle
- [ ] Weather system
- [ ] AI opponents
- [ ] Win/lose conditions

## Contributing

See [AGENTS.md](AGENTS.md) for guidelines on working with AI coding agents on this project.

## License

[License TBD]

## Acknowledgments

Inspired by:
- Anno series (Blue Byte)
- Age of Empires series (Ensemble Studios)
- Age of Mythology (Ensemble Studios)
- The Settlers series (Blue Byte)
