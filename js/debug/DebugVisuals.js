import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';

/**
 * Utility class for rendering debug visuals (spheres, lines, etc.) in the scene.
 * Used to help visualize AI, paths, and other game logic during development.
 */
export class DebugVisuals {

  /**
   * Create a new DebugVisuals helper.
   * @param {THREE.Scene} scene - The scene to add debug objects to.
   */
  constructor(scene) {
    this.scene = scene;
    this.enabled = true;
    // List of colors to use for debug objects
    this.colors = [ 'red', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink' ];
    // Map of debug object keys to meshes/lines
    this.debugObjects =  new Map();
  }

  /**
   * Create and add a debug sphere to the scene.
   * @param {string} key - Unique key for this debug object.
   * @param {THREE.Vector3} pos - Position of the sphere.
   * @param {string|number} color - Color of the sphere.
   * @param {number} size - Diameter of the sphere (default 1).
   */
  createSphere(key, pos, color, size = 1) {
    let geometry = new THREE.SphereGeometry(size/2);
    let material = new THREE.MeshStandardMaterial({ color: color });
    let mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(pos);
    mesh.position.y = 0.5;
    mesh.visible = true;
    this.debugObjects.set(key, mesh);
    this.scene.add(mesh);
  }

  /**
   * Create and add a debug line to the scene.
   * @param {string} key - Unique key for this debug object.
   * @param {THREE.Vector3} start - Start position.
   * @param {THREE.Vector3} end - End position.
   * @param {string|number} color - Color of the line.
   * @param {number} width - Line width.
   */
  createLine(key, start, end, color, width) {
    const geometry = new LineGeometry();
    geometry.setPositions([
     start.x, 0.5, start.z,
     end.x, 0.5, end.z
    ]);

    let material = new LineMaterial({
        color: color,
        linewidth: width,
        worldUnits: true
      });
    let mesh = new Line2(geometry, material);
    mesh.computeLineDistances();
    this.debugObjects.set(key, mesh);
    this.scene.add(mesh);
  }

  // Show line
  showLine(key, start, end, color = 0x000000, width = 0.1) {

    let obj = this.debugObjects.get(key);
    if (!obj) {
      this.createLine(key, start, end, color, width);
      return;
    }

    // Update positions 
    obj.geometry.setPositions([
      start.x, 0.5, start.z,
      end.x,   0.5, end.z
    ]);

    // Update color
    obj.material.color.set(color);
    obj.computeLineDistances();
    obj.visible = true;
  }

  // Show a sphere with reference key at given position
  showSphere(key, pos) {
    console.log(key)
    // if does not exist, create it
    // update its position
    let obj = this.debugObjects.get(key);
    if (!obj) {
      let color = this.colors[this.debugObjects.size%this.colors.length];
      this.createSphere(key, pos, color);
      return;
    }
    obj.position.copy(pos);
    obj.position.y = 0.5;
    obj.visible = true;
  }
  
  // Hide object with key
  hide(key) {
    let obj = this.debugObjects.get(key);
    if (obj) obj.visible = false;
  }

  // Hide multiple objects (list of keys)
  hideObjs(keys) {
    for (let key of keys) {
      this.hide(key);
    }
  }

}