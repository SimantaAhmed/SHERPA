// Toon material helpers used across the game.

import * as THREE from 'three';

export function getToonMaterial(world, options = {}) {
  return new THREE.MeshStandardMaterial({
    color: options.color || '#ffffff',
    map: options.map || null,
    transparent: options.transparent || false,
    opacity: options.opacity !== undefined ? options.opacity : 1,
    side: options.side || THREE.FrontSide,
    vertexColors: !!options.vertexColors,
    flatShading: options.flatShading !== undefined ? options.flatShading : true,
    roughness: options.roughness !== undefined ? options.roughness : 0.92,
    metalness: options.metalness !== undefined ? options.metalness : 0.05,
  });
}

export function applyToonToObject(world, object3d) {
  return;
}
