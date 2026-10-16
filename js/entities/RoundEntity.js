import * as THREE from 'three';
import { Entity } from './Entity.js';

/**
 * Represents a circular (round) entity in the game world, such as a player or lurker.
 * Inherits from Entity and uses a cylinder mesh for rendering.
 */
export class RoundEntity extends Entity {

  /**
   * Create a new RoundEntity.
   * @param {Object} param0 - Configuration object.
   * @param {number} radius - Radius of the entity (default 1).
   * @param {number} height - Height of the entity (default 1).
   * @param {Object} entityConfig - Additional Entity config.
   */
  constructor({
    radius = 1,
    height = 1,
    ...entityConfig
  } = {}) {
    // Set the scale to match the round shape
    super({
      scale: new THREE.Vector3(radius * 2, height, radius * 2),
      ...entityConfig,
    });
    this.radius = radius;
  }

  /**
   * Create the default mesh for this entity (a colored cylinder).
   * @param {number|string} color - The color of the mesh.
   * @returns {THREE.Mesh}
   */
  createDefaultMesh(color) {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(this.scale.x/2, this.scale.x/2, this.scale.y, 32),
      new THREE.MeshStandardMaterial({ color: color })
    );
  }
}