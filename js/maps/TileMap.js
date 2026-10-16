import * as THREE from 'three';
import { Tile } from './Tile.js';
import { LevelMap } from './LevelMap.js';
import { Perlin } from '../pcg/Perlin.js';

// TileMap class will hold information about our tile grid
export class TileMap extends LevelMap {

  /**
   * @param {number} tileSize
   * @param {Object} levelMapConfig
   * @param {Object} rng - RNG object with .next() method
   */
  constructor(tileSize = 1, levelMapConfig = {}, rng = { next: () => Math.random() }) {
    super(levelMapConfig);
    this.rng = rng;

    this.tileSize = tileSize;
    this.cols = Math.floor(this.width / this.tileSize);
    this.rows = Math.floor(this.depth / this.tileSize);

    this.maxHeight = 16;
    this.waterThreshold = 0.36 * this.maxHeight;
    this.sandThreshold = 0.45 * this.maxHeight;

    this.maxAllowedSlope = 2.3;

    this.grid = [];
    this.blocked = new Set();
    this.blackoutTiles = new Set();

    this.generateGrid();
    this.rebuildWalkables();
  }

  key(row, col) {
    return `${row}:${col}`;
  }

  generateGrid() {
    this.grid = [];
    this.blackoutTiles.clear();

    const terrainNoise = new Perlin(24, this.rng);
    const blackoutNoise = new Perlin(18, this.rng);

    for (let r = 0; r < this.rows; r++) {
      const row = [];

      for (let c = 0; c < this.cols; c++) {
        const terrain = terrainNoise.octaveNoise(r, c, 0.018, 6, 0.5, 2.0);
        const blackout = blackoutNoise.octaveNoise(r + 99, c - 37, 0.018, 4, 0.58, 2.0);

        let type = Tile.Type.Grass;
        let height = terrain * this.maxHeight;

        if (height < this.waterThreshold) {
          type = Tile.Type.Water;
          height = this.waterThreshold * 0.92;
        } else if (height < this.sandThreshold) {
          type = Tile.Type.Sand;
        }

        const tile = new Tile(r, c, type, height);
        tile.blackout = blackout > 0.50;

        if (tile.blackout) {
          this.blackoutTiles.add(this.key(r, c));
        }

        row.push(tile);
      }

      this.grid.push(row);
    }
  }

  rebuildWalkables() {
    this.walkableTiles = this.grid.flat().filter((tile) => this.isTileWalkable(tile));
  }

  isInGrid(row, col) {
    return (
      row >= 0 && row < this.rows
      && col >= 0 && col < this.cols
    );
  }

  getTile(row, col) {
    if (!this.isInGrid(row, col)) {
      return null;
    }
    return this.grid[row][col];
  }

  isSteepTransition(fromTile, toTile) {
    if (!fromTile || !toTile) {
      return true;
    }
    return Math.abs(fromTile.height - toTile.height) > this.maxAllowedSlope;
  }

  isTileWalkable(tile) {
    // All tiles are walkable, including water
    if (!tile) {
      return false;
    }
    return !this.blocked.has(this.key(tile.row, tile.col));
  }

  isWalkable(row, col) {
    const tile = this.getTile(row, col);
    if (!tile || !this.isTileWalkable(tile)) {
      return false;
    }

    const cardinal = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    for (const [dr, dc] of cardinal) {
      const neighbor = this.getTile(row + dr, col + dc);
      if (!neighbor || !this.isTileWalkable(neighbor)) {
        continue;
      }

      if (!this.isSteepTransition(tile, neighbor)) {
        return true;
      }
    }

    return false;
  }

  getNeighbours(tile) {
    const neighbors = [];
    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    for (const [dr, dc] of directions) {
      const next = this.getTile(tile.row + dr, tile.col + dc);
      if (!next) {
        continue;
      }

      if (this.isTileWalkable(next) && !this.isSteepTransition(tile, next)) {
        neighbors.push(next);
      }
    }

    return neighbors;
  }

  quantize(position) {
    const row = Math.floor((position.z - this.minZ) / this.tileSize);
    const col = Math.floor((position.x - this.minX) / this.tileSize);

    if (!this.isInGrid(row, col)) {
      return null;
    }

    return this.grid[row][col];
  }

  localize(tile) {
    return new THREE.Vector3(
      tile.col * this.tileSize + this.minX + this.tileSize / 2,
      tile.height,
      tile.row * this.tileSize + this.minZ + this.tileSize / 2,
    );
  }

  getTileHeight(row, col) {
    const clampedRow = THREE.MathUtils.clamp(row, 0, this.rows - 1);
    const clampedCol = THREE.MathUtils.clamp(col, 0, this.cols - 1);
    return this.grid[clampedRow][clampedCol].height;
  }

  sampleHeight(x, z) {
    const localCol = ((x - this.minX) / this.tileSize) - 0.5;
    const localRow = ((z - this.minZ) / this.tileSize) - 0.5;

    const col0 = Math.floor(localCol);
    const row0 = Math.floor(localRow);
    const col1 = col0 + 1;
    const row1 = row0 + 1;

    const tx = THREE.MathUtils.clamp(localCol - col0, 0, 1);
    const tz = THREE.MathUtils.clamp(localRow - row0, 0, 1);

    const h00 = this.getTileHeight(row0, col0);
    const h10 = this.getTileHeight(row0, col1);
    const h01 = this.getTileHeight(row1, col0);
    const h11 = this.getTileHeight(row1, col1);

    const h0 = THREE.MathUtils.lerp(h00, h10, tx);
    const h1 = THREE.MathUtils.lerp(h01, h11, tx);
    return THREE.MathUtils.lerp(h0, h1, tz);
  }

  getHeightAtPosition(position) {
    if (!position) {
      return 0;
    }
    return this.sampleHeight(position.x, position.z);
  }

  isBlackoutTile(tile) {
    if (!tile) {
      return false;
    }
    return this.blackoutTiles.has(this.key(tile.row, tile.col));
  }

  getRandomWalkableTile(filterFn = null) {
    if (!this.walkableTiles.length) {
      return null;
    }

    let candidateList = this.walkableTiles;

    if (filterFn) {
      candidateList = this.walkableTiles.filter(filterFn);
      if (!candidateList.length) {
        candidateList = this.walkableTiles;
      }
    }

    const index = Math.floor(this.rng.next() * candidateList.length);
    return candidateList[index];
  }

  markBlockedTile(tile) {
    if (!tile) {
      return;
    }
    this.blocked.add(this.key(tile.row, tile.col));
  }

  markBlockedArea(center, radius = 1) {
    const centerTile = this.quantize(center);
    if (!centerTile) {
      return;
    }

    for (let r = centerTile.row - radius; r <= centerTile.row + radius; r++) {
      for (let c = centerTile.col - radius; c <= centerTile.col + radius; c++) {
        if (!this.isInGrid(r, c)) {
          continue;
        }

        const tile = this.grid[r][c];
        this.markBlockedTile(tile);
      }
    }
  }
}
