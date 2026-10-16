import * as THREE from 'three';

/**
 * Base class for our entities
 */
export class Entity {

  // Constructor for our entity
  constructor({
    position = new THREE.Vector3(0,0,0),
    scale = new THREE.Vector3(1,1,1),
    mesh = null,
    color = 'red'
  } = {}) {

    this.position = position.clone();
    this.scale = scale.clone();


    this.mesh = mesh || this.createDefaultMesh(color);
    this.mesh.position.copy(this.position);

    // Set the MESH y position to be half the height of our entity
    this.mesh.position.y += this.scale.y/2;
  }

  // Default entity mesh
  createDefaultMesh(color) {
    return new THREE.Mesh(
      new THREE.BoxGeometry(this.scale.x, this.scale.y, this.scale.z),
      new THREE.MeshStandardMaterial({ color: color })
    )
  }

}