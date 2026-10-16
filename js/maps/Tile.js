// Tile class, which is our nodes
export class Tile {

  // Possible tile types
  static Type = Object.freeze({
    Grass: Symbol("Grass"),
    Sand: Symbol("Sand"),
    Water: Symbol("Water")
  });

  // Map to hold costs associated with types
  static Cost = new Map([
    [Tile.Type.Grass, 1],
    [Tile.Type.Sand, 3],
    [Tile.Type.Water, 10]
  ]);

  // Tile constructor
  constructor(row, col, type = Tile.Type.Grass, height = 1) {
    this.row = row;
    this.col = col;
    this.type = type;
    this.height = height;
    this.cost = Tile.Cost.get(this.type);
  }

  // Check to see if we can walk on this tile
  isWalkable() {
    // All tiles are walkable, including water
    return true;
  }

}