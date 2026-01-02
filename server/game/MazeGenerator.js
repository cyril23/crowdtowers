import { TILE_TYPES, MAZE_SIZES } from '../../shared/constants.js';

class MazeGenerator {
  constructor(size) {
    const config = MAZE_SIZES[size];
    if (!config) {
      throw new Error(`Invalid maze size: ${size}`);
    }
    this.gridSize = config.grid;
    this.tileSize = config.tileSize;
  }

  generate() {
    const maxAttempts = 100;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = this.attemptGenerate();
      if (result) {
        console.log(`Maze generated successfully on attempt ${attempt + 1}`);
        return result;
      }
    }

    throw new Error('Failed to generate valid maze after maximum attempts');
  }

  attemptGenerate() {
    // Initialize grid with walls
    const grid = Array(this.gridSize).fill(null)
      .map(() => Array(this.gridSize).fill(TILE_TYPES.WALL));

    // Use recursive backtracking to carve passages
    // Start from interior cell (1,1)
    this.carvePassages(grid, 1, 1);

    // Entry and exit in the middle of left and right edges
    const entryY = Math.floor(this.gridSize / 2);
    // Make sure entryY is odd to align with carved passages
    const adjustedEntryY = entryY % 2 === 0 ? entryY + 1 : entryY;

    // Exit on the opposite side, also in the middle
    const exitY = Math.floor(this.gridSize / 2);
    const adjustedExitY = exitY % 2 === 0 ? exitY + 1 : exitY;

    const entry = { x: 0, y: adjustedEntryY };
    const exit = { x: this.gridSize - 1, y: adjustedExitY };

    // Carve entry point and connect to maze
    grid[entry.y][0] = TILE_TYPES.PATH;
    grid[entry.y][1] = TILE_TYPES.PATH;

    // Carve exit point and connect to maze
    grid[exit.y][this.gridSize - 1] = TILE_TYPES.PATH;
    grid[exit.y][this.gridSize - 2] = TILE_TYPES.PATH;

    // Ensure there's a path from entry to the carved maze interior
    this.ensureConnection(grid, 1, entry.y);

    // Ensure there's a path from exit to the carved maze interior
    this.ensureConnection(grid, this.gridSize - 2, exit.y);

    // Calculate path from entry to exit using BFS
    const path = this.findPath(grid, entry, exit);

    // If no path found, return null to trigger retry
    if (!path) {
      return null;
    }

    // Mark entry and exit tiles
    grid[entry.y][entry.x] = TILE_TYPES.ENTRY;
    grid[exit.y][exit.x] = TILE_TYPES.EXIT;

    // Mark buildable tiles (walls adjacent to path)
    this.markBuildableTiles(grid, path);

    return {
      grid,
      entry,
      exit,
      path
    };
  }

  carvePassages(grid, cx, cy) {
    const directions = this.shuffleArray([
      { dx: 0, dy: -2 }, // Up
      { dx: 0, dy: 2 },  // Down
      { dx: -2, dy: 0 }, // Left
      { dx: 2, dy: 0 }   // Right
    ]);

    grid[cy][cx] = TILE_TYPES.PATH;

    for (const { dx, dy } of directions) {
      const nx = cx + dx;
      const ny = cy + dy;

      if (this.isInBounds(nx, ny) && grid[ny][nx] === TILE_TYPES.WALL) {
        // Carve through the wall between current and next cell
        grid[cy + dy / 2][cx + dx / 2] = TILE_TYPES.PATH;
        this.carvePassages(grid, nx, ny);
      }
    }
  }

  // Ensure a cell is connected to the maze by carving if needed
  ensureConnection(grid, x, y) {
    // If already a path, we're good
    if (grid[y][x] === TILE_TYPES.PATH) return;

    // Make this cell a path
    grid[y][x] = TILE_TYPES.PATH;

    // Find the nearest path cell and carve towards it
    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 }
    ];

    for (const { dx, dy } of directions) {
      let nx = x + dx;
      let ny = y + dy;

      // Look up to 3 cells in this direction for a path
      for (let i = 0; i < 3; i++) {
        if (nx < 1 || nx >= this.gridSize - 1 || ny < 1 || ny >= this.gridSize - 1) break;

        if (grid[ny][nx] === TILE_TYPES.PATH) {
          // Found a path, carve to it
          let cx = x, cy = y;
          while (cx !== nx || cy !== ny) {
            if (cx !== nx) cx += dx;
            if (cy !== ny) cy += dy;
            grid[cy][cx] = TILE_TYPES.PATH;
          }
          return;
        }

        nx += dx;
        ny += dy;
      }
    }
  }

  isInBounds(x, y) {
    return x > 0 && x < this.gridSize - 1 && y > 0 && y < this.gridSize - 1;
  }

  shuffleArray(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  findPath(grid, start, end) {
    const queue = [{ ...start, path: [start] }];
    const visited = new Set();
    visited.add(`${start.x},${start.y}`);

    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 }
    ];

    while (queue.length > 0) {
      const current = queue.shift();

      if (current.x === end.x && current.y === end.y) {
        return current.path;
      }

      for (const { dx, dy } of directions) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const key = `${nx},${ny}`;

        if (
          nx >= 0 && nx < this.gridSize &&
          ny >= 0 && ny < this.gridSize &&
          !visited.has(key) &&
          grid[ny][nx] !== TILE_TYPES.WALL
        ) {
          visited.add(key);
          queue.push({
            x: nx,
            y: ny,
            path: [...current.path, { x: nx, y: ny }]
          });
        }
      }
    }

    // No path found - return null to trigger maze regeneration
    return null;
  }

  markBuildableTiles(grid, path) {
    const pathSet = new Set(path.map(p => `${p.x},${p.y}`));
    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 }
    ];

    // Also include all path tiles (not just the BFS path) for buildable adjacency
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (grid[y][x] === TILE_TYPES.PATH) {
          pathSet.add(`${x},${y}`);
        }
      }
    }

    // Mark walls adjacent to any path tile as buildable
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (grid[y][x] === TILE_TYPES.WALL) {
          for (const { dx, dy } of directions) {
            const nx = x + dx;
            const ny = y + dy;

            if (
              nx >= 0 && nx < this.gridSize &&
              ny >= 0 && ny < this.gridSize &&
              (grid[ny][nx] === TILE_TYPES.PATH ||
               grid[ny][nx] === TILE_TYPES.ENTRY ||
               grid[ny][nx] === TILE_TYPES.EXIT)
            ) {
              grid[y][x] = TILE_TYPES.BUILDABLE;
              break;
            }
          }
        }
      }
    }
  }
}

export default MazeGenerator;
