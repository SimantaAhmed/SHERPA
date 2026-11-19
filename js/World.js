import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as Setup from './setup.js';
import { InputHandler } from './input/InputHandler.js';
import { TileMap } from './maps/TileMap.js';
import { TileMapRenderer } from './renderers/TileMapRenderer.js';
import { createAtmosphere, createGroundFog, createSnowSystem, spawnRuinStructures, updateFog, updateSnow } from './game/scenery.js';
import { createPlayer, updateModeTransition, updatePlayerAnimation, updatePlayerJump, updatePlayerMovement, updatePlayerStateControls, updateTracks } from './game/player.js';
import { spawnLurkers, updateLurkerProjectiles, updateLurkers } from './game/lurkers.js';
import { spawnExtractionPoint, spawnSecretCharacter, spawnTerminals, updateExtractionPoint, updateSecretCharacter, updateTerminals } from './game/objectives.js';
import { createHud, updateHud, updateMinimap } from './game/hud.js';
import { updateCamera } from './game/camera.js';

export class World {
  constructor(rng) {
    this.rng = rng; // Seedable random number generator
    this.scene = Setup.createScene();
    this.camera = Setup.createCamera();
    this.renderer = Setup.createRenderer();

    this.clock = new THREE.Clock();
    this.inputHandler = new InputHandler(this.camera);

    this.loader = new GLTFLoader();
    this.lurkerTemplate = undefined;

    this.entities = [];
    this.ruins = [];
    this.terminals = [];
    this.lurkers = [];
    this.lurkerProjectiles = [];
    this.tracks = [];
    this.snow = null;

    this.pathReplanInterval = 0.35;
    this.swarmCooldown = 0;
    this.hackDuration = 2.2;

    this.score = 0;
    this.runFinished = false;
    this.extractionUnlocked = false;

    this.hud = null;
    this.minimapCanvas = null;
    this.minimapCtx = null;
    this.speechBubbleTimer = 0;
    this.gameOver = false;
    this.endScreenType = 'over';

    this.normalFogColor = new THREE.Color('#6b8299');
    this.blackoutFogColor = new THREE.Color('#3a4451');
    this.normalFogDensity = 0.0085;
    this.blackoutFogDensity = 0.015;

    this.cameraFollowPos = null;
    this.cameraLookPos = null;
    this.cameraHeightSmooth = null;

    // Camera controls for orbiting around the player (hold left mouse)
    this.freeCameraYaw = 0; // Horizontal camera angle
    this.freeCameraPitch = 0.5; // Vertical camera angle (radians, ~30° up)
    this.freeCameraDistance = 8.2; // Camera distance from player
  }

  // Set up the world, player, enemies, and UI
  async init() {
    this.map = new TileMap(1, { width: 140, depth: 140 }, this.rng);

    Setup.createLight(this.scene);

    this.tileMapRenderer = new TileMapRenderer(this.map);
    this.tileMapRenderer.render(this.scene);

    createAtmosphere(this);
    createPlayer(this);
    await spawnRuinStructures(this);
    await spawnTerminals(this);
    await spawnLurkers(this);
    await spawnSecretCharacter(this);
    spawnExtractionPoint(this);
    createHud(this);
    // createGroundFog(this);
    createSnowSystem(this);

    window.addEventListener('resize', () => this.handleResize());
  }

  // Main game update loop (called every frame)
  update() {
    const dt = Math.min(this.clock.getDelta(), 0.033);
    this.player.projectileInvulnTimer = Math.max(0, (this.player.projectileInvulnTimer || 0) - dt);

    if (this.gameOver) {
      if (this.inputHandler.wasPressedOnce('r')) {
        window.location.reload();
      }
      updateHud(this, dt);
      this.inputHandler.endFrame();
      return;
    }

    this.swarmCooldown = Math.max(0, this.swarmCooldown - dt);
    updateModeTransition(this, dt);

    updatePlayerStateControls(this);
    updatePlayerMovement(this, dt);
    updatePlayerJump(this, dt);
    updatePlayerAnimation(this, dt);
    updateTerminals(this, dt);
    updateLurkers(this, dt);
    updateLurkerProjectiles(this, dt);

    // Throttle snow and minimap updates
    this._frameCount = (this._frameCount || 0) + 1;
    updateSnow(this, dt);
    if (this._frameCount % 4 === 0) {
      updateMinimap(this);
    }

    updateTracks(this, dt);
    updateSecretCharacter(this, dt);
    updateExtractionPoint(this, dt);
    updateCamera(this, dt);
    // updateFog(this, dt);
    updateHud(this, dt);

    this.inputHandler.endFrame();
  }

  // Raycast to check if there is a clear line of sight
  hasLineOfSight(start, end) {
    const rayDirection = end.clone().sub(start);
    const maxDistance = rayDirection.length();
    if (maxDistance <= 0.001) {
      return true;
    }

    rayDirection.normalize();
    const raycaster = new THREE.Raycaster(start.clone().add(new THREE.Vector3(0, 0.8, 0)), rayDirection, 0.1, maxDistance);

    const obstacleMeshes = this.ruins.map((ruin) => ruin.mesh);
    const hit = raycaster.intersectObjects(obstacleMeshes, false);
    return hit.length === 0;
  }

  // Push entities out of ruins if they overlap
  resolveRuinCollisions(position, velocity) {
    const pointBox = new THREE.Box3(
      new THREE.Vector3(position.x - 0.45, this.map.getHeightAtPosition(position), position.z - 0.45),
      new THREE.Vector3(position.x + 0.45, this.map.getHeightAtPosition(position) + 1.8, position.z + 0.45),
    );

    for (const ruin of this.ruins) {
      ruin.bbox.setFromObject(ruin.mesh);

      if (pointBox.intersectsBox(ruin.bbox)) {
        const center = ruin.mesh.position;
        const push = position.clone().sub(center);
        push.y = 0;

        if (push.lengthSq() < 0.001) {
          push.set(1, 0, 0);
        }

        push.setLength(0.25);
        position.add(push);
        velocity.multiplyScalar(0.3);
      }
    }
  }

  // Clamp a position to stay within the map bounds
  constrainToMap(position) {
    position.x = THREE.MathUtils.clamp(position.x, this.map.minX + 1, this.map.maxX - 1);
    position.z = THREE.MathUtils.clamp(position.z, this.map.minZ + 1, this.map.maxZ - 1);
    position.y = this.map.getHeightAtPosition(position);
  }

  // Adjust camera and renderer when the window is resized
  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Draw the current frame
  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
