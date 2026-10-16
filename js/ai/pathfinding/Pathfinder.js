export class Pathfinder {

  // Pathfinding constructor 
  constructor() {
    if (new.target === Pathfinder) {
      throw new Error("Cannot initialize abstract class");
    }
  }

  // Find path must be implemented
  findPath(start, end, map) {
    throw new Error("Must implement findPath!");
  }

  // Trace the parents Map
  // Get a path from our "parents" Map()
  tracePath(parents, start, end) {
    let path = [end];
    let current = end;

    while (current !== start) {
      current = parents.get(current);
      path.unshift(current);
    }
    
    return path;
  }
}