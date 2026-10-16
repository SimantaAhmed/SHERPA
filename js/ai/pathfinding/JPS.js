import * as THREE from "three";
import { MinHeap } from "./util/MinHeap";
import { Pathfinder } from "./Pathfinder";

export class JPS extends Pathfinder {

  constructor(map, heuristic, tileMapRenderer) {
    super();
    this.map = map;
    this.heuristic = heuristic;
    this.tileMapRenderer = tileMapRenderer;
  }

  // Original version of ASTAR
  // That we will modify for JPS
  findPath(start, goal) {

    let open = new MinHeap();
    let costs = new Map();
    let parents = new Map();

    costs.set(start, 0);
    parents.set(start, null);

    open.enqueue(start, this.heuristic(start, goal, 1));

    while (!open.isEmpty()) {

      let current = open.dequeue();

      if (current === goal) {
        return this.tracePath(parents, start, goal);
      }

      // Change this line for JPS!
      for (let neighbour of this.identifySuccessors(current, goal, parents)) {

        // Important update!
        // Since we are skipping over nodes, we must consider the 
        // distance between the current and the neighbour
        let newCost = costs.get(current) + this.heuristic(current, neighbour, 1);

        if (!costs.has(neighbour) || newCost < costs.get(neighbour)) {

          costs.set(neighbour, newCost);
          parents.set(neighbour, current);

          let f = newCost + this.heuristic(neighbour, goal, 1);
          open.enqueue(neighbour, f);

        }
      }
    }
    return [];
  }

  // Identify jump points to add to our PQ
  identifySuccessors(node, goal, parents) {
    let successors = [];
    let parent = parents.get(node);

    let directions = this.pruneDirections(node, parent);

    for (let dir of directions) {

      let jp = this.jump(node, dir[0], dir[1], goal);

      if (jp) {
        successors.push(jp);

        this.tileMapRenderer.setTileColor(jp, new THREE.Color("orange"));
      }

    }

    return successors;
  }

  // Prune directions
  // Identify directions to go in so that we do not backtrack
  pruneDirections(node, parent) {

    // If there's no parent
    // look at all directions
    if (!parent) {
      return [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
      ];
    }

    // Find the direction we came in
    let dr = Math.sign(node.row - parent.row);
    let dc = Math.sign(node.col - parent.col);

    // Our primary direction was left or right
    if (dc !== 0) {
      return [
        [0, dc],
        [-1, 0],
        [1, 0]
      ];
    }

    // Our primary direction was up or down
    else {
      return [
        [dr, 0],
        [0, -1],
        [0, 1]
      ];
    }

  }

  // Method to look for jump points
  jump(node, dr, dc, goal) {

    // Start by getting the row and col of neighbour
    let r = node.row + dr;
    let c = node.col + dc;

    // This is a useless path
    if (!this.map.isWalkable(r, c)) return null;

    let neighbour = this.map.grid[r][c];

    // yay we found our goal
    if (neighbour === goal) return neighbour;

    // Horizontal movement
    if (dc !== 0) {

      if (
        (this.map.isWalkable(r - 1, c) && !this.map.isWalkable(r - 1, c - dc)) ||
        (this.map.isWalkable(r + 1, c) && !this.map.isWalkable(r + 1, c - dc))
      ) {
        return neighbour;
      }

    }

    // Vertical movement
    else if (dr !== 0) {

      if (
        (this.map.isWalkable(r, c - 1) && !this.map.isWalkable(r - dr, c - 1)) ||
        (this.map.isWalkable(r, c + 1) && !this.map.isWalkable(r - dr, c + 1))
      ) {
        return neighbour;
      }

      // Secondary direction
      if (
        this.jump(neighbour, 0, -1, goal) ||
        this.jump(neighbour, 0, 1, goal)
      ) {
        return neighbour;
      }
    }

    return this.jump(neighbour, dr, dc, goal);
  }

}