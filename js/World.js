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
    Setup.showHelpers(this.scene, this.camera, this.renderer, this.map);

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

  // Add sky, sun, and ambient lighting
  // Returns a stylized material for cartoon-like shading
  // Placeholder for applying toon shading recursively (not used)
  // Generate decorative mountains around the map edge
  // Make a bumpy, irregular mountain mesh
  // Spawn the player at a random open tile
  // Load the 3D model and animations for the mech
  // Load the spaceship model for drive mode
  // Start the animation and logic for switching between mech/drive
  // Animate the transition between mech and drive modes
  // Load the lurker (enemy) astronaut model
  // Load decorative models for ruins (rocks, trees, etc.)
  // Place ruins randomly on the map and mark them as obstacles
  // Place hackable terminals at random open locations
  // Load the 3D model for a server rack terminal
  // Simple box used if the terminal model fails to load
  // Spawn all lurker enemies at random walkable tiles
  // Create a single lurker at a given tile
  // Spawn extra lurkers near the player (e.g. when backup is called)
  // Visualize the detection cone in front of a lurker
  // Create the '!' alert icon above lurkers
  // Place the secret healing character somewhere safe
  // Place a decorative ship near the secret character
  // Place the extraction ring at the map center
  // Build the game's HUD and minimap
  // Add atmospheric fog to the scene
  // Smoothly blend fog color/density based on blackout zones
  // LOD profiles for lurker AI/animation based on distance
  // Always use the highest AI update rate for lurkers (no distance throttling)
  // Adjust snow particle count/size for performance
  // Spawn snow particles around the player
  // Animate snow particles falling and drifting
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
  // Throttled minimap update
  // Redraw the minimap (throttled for performance)
  // Handle player input for state changes, jumping, and crouching
  // Move the player, apply speed penalties, and handle collisions
  // Animate the player's jump arc
  // Long jump for DRIVE mode
  // (Unused) Placeholder for long jump logic
  // Sync player animation state with movement and actions
  // Flash the player red and play hit animation
  // Update the player's mesh position, orientation, and bounding box
  // Leave a track mark behind the player (drive mode)
  // Fade out and remove old track marks
  // Handle hacking logic and extraction unlock
  // Animate the extraction ring and check for run completion
  // Alert nearby lurkers to pursue the player
  // Main AI loop for all lurkers (patrol, alert, pursue, return)
  // Move a lurker along its patrol route
  // Move a lurker toward the player using pathfinding and pursuit
  // Give a speed boost to lurkers when swarming
  // Guide a lurker back to its home position
  // Make lurkers avoid or seek terminals depending on state
  // Alert all lurkers in range to start hunting
  // Trigger a group pursuit for all lurkers near a position
  // Call a few nearby lurkers to join the pursuit
  // Push lurkers apart to avoid crowding
  // Steer lurkers away from ruins/obstacles
  // Make a lurker shoot a projectile at the player
  // Move and handle collisions for all lurker projectiles
  // Apply acceleration, velocity, and movement to a lurker
  // Animate and handle healing for the secret character
  // Smoothly follow the player with the camera (supports free-look)
  // Update all HUD elements and the minimap
  // Render the minimap, showing player, lurkers, and objectives
  // Convert a world position to minimap coordinates
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
