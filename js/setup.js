import * as THREE from 'three';

// Creates and returns the scene
export function createScene() {
  const scene = new THREE.Scene();  
  scene.background = new THREE.Color('#d4eeff');
  return scene;
}

// Creates and returns the camera
export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1, 
    1000
  );

  // Move our camera to a position upwards on y
  // then look at the origin
  camera.position.y = 100;
  camera.position.z = 100;
  camera.lookAt(0, 0, 0);
  return camera;
}

// Creates and returns the renderer
export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  return renderer;
}

// Creates light and adds it to the scene
export function createLight(scene) {
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(0, 5, 5);
  scene.add(light);
}
