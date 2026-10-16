import * as THREE from 'three';

// LevelMap holds our bounds of the map
export class LevelMap {
  /**
   * @param {Object} config
   * @param {Object} rng - RNG object with .next() method
   */
  constructor({
    width = 100,
    depth = 100,
    rng = { next: () => Math.random() }
  } = {}) {

    this.width = width;
    this.depth = depth;
    this.rng = rng;
  
    this.minX = -width/2;
    this.maxX = width/2;

    this.minZ = -depth/2;
    this.maxZ = depth/2;
  
  }

  // Method for wrapping!
  wrapPosition(position) {
    
    let wrapped = position.clone();

    // x component
    wrapped.x = THREE.MathUtils.euclideanModulo(
      wrapped.x - this.minX,
      this.width
    ) + this.minX;

    // z component
    wrapped.z = THREE.MathUtils.euclideanModulo(
      wrapped.z - this.minZ,
      this.depth
    ) + this.minZ;

    return wrapped;
  }

  // Method to get a random position
  getRandomPosition() {
    return new THREE.Vector3(
      this.minX + this.width * this.rng.next(),
      0,
      this.minZ + this.depth * this.rng.next()
    );
  }

}