/**
 * The player mech: creation, mode switching, movement, jumping and animation.
 */

import * as THREE from 'three';
import { asset } from '../util/assets.js';
import { applyToonToObject, getToonMaterial } from './materials.js';
import { spawnExtractionPoint } from './objectives.js';
import { RoundEntity } from '../entities/RoundEntity.js';
import { PLAYER_STATE } from './states.js';

export function createPlayer(world) {
  const spawnTile = world.map.getRandomWalkableTile((tile) => !tile.blackout);
  const spawnPos = world.map.localize(spawnTile);

  world.player = {
    position: new THREE.Vector3(spawnPos.x, spawnPos.y, spawnPos.z),
    velocity: new THREE.Vector3(),
    acceleration: new THREE.Vector3(),
    facing: new THREE.Vector3(0, 0, 1),
    state: PLAYER_STATE.MECH,
    isCrouch: false,
    health: 100,
    maxHealth: 100,
    hackTarget: null,
    hackTimer: 0,
    detectRadius: 16,
    baseMechSpeed: 9.5,
    baseDriveSpeed: 58.5,
    mechVisualOffsetY: -0.55,
    modeTransitionActive: false,
    modeTransitionTimer: 0,
    modeTransitionDuration: 0.48,
    modeTransitionFrom: PLAYER_STATE.MECH,
    modeTransitionTo: PLAYER_STATE.MECH,
    modeTransitionSwapped: false,
    modeJumpHeight: 1.35,
    modeJumpOffset: 0,
    jumpActive: false,
    jumpTimer: 0,
    jumpDuration: 0.55,
    jumpHeight: 2.4,
    jumpOffset: 0,
    longJumpActive: false,
    longJumpTimer: 0,
    longJumpDuration: 0.7,
    longJumpHeight: 3.2,
    longJumpDistance: 13,
    longJumpOffset: 0,
    vehicleLiftOffset: 0.38,
    hitReactionTimer: 0,
    hitBlinkTimer: 0,
    hitBlinkState: false,
    projectileInvulnTimer: 0,
    bbox: new THREE.Box3(),
  };

  const mech = new RoundEntity({
    radius: 0.9,
    height: 1.8,
    color: '#d9f2ff',
    position: world.player.position,
    mesh: new THREE.Group(),
  });

  world.player.entity = mech;
  world.scene.add(mech.mesh);
  loadMechVisual(world);
  loadSpaceshipVisual(world);

  // world.applyPlayerTransformVisualState();
}

export function loadMechVisual(world) {
  const modelPaths = [asset('Mech (1).glb'), asset('Mech%20(1).glb')];

  const tryLoad = (index) => {
    if (index >= modelPaths.length) {
      const fallback = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.5, 1.2, 6, 10),
        getToonMaterial(world, { color: '#d9f2ff' }),
      );
      world.player.entity.mesh.add(fallback);
      return;
    }

    world.loader.load(
      modelPaths[index],
      (gltf) => {
        const mechVisual = gltf.scene;

        mechVisual.scale.set(1.2, 1.2, 1.2);
        mechVisual.position.set(0, world.player.mechVisualOffsetY, 0);
        applyToonToObject(world, mechVisual);

        world.player.entity.mesh.add(mechVisual);
        world.player.mechVisual = mechVisual;

        if (gltf.animations && gltf.animations.length > 0) {
          const idleClip =
            gltf.animations.find((clip) => {
              const name = clip.name.toLowerCase();
              return name.includes('idle') || name.includes('stand');
            })
            || gltf.animations[0];

          const runClip =
            gltf.animations.find((clip) => {
              const name = clip.name.toLowerCase();
              return name.includes('run');
            })
            || gltf.animations[0];

          const walkClip =
            gltf.animations.find((clip) => {
              const name = clip.name.toLowerCase();
              return name.includes('walk');
            })
            || runClip;

          const hitClip =
            gltf.animations.find((clip) => {
              const name = clip.name.toLowerCase();
              return name.includes('hit') || name.includes('damage') || name.includes('hurt') || name.includes('impact');
            })
            || null;

          const jumpClip =
            gltf.animations.find((clip) => {
              const name = clip.name.toLowerCase();
              return name.includes('jump');
            })
            || null;

          const mixer = new THREE.AnimationMixer(mechVisual);
          const idleAction = mixer.clipAction(idleClip);
          const runAction = mixer.clipAction(runClip);
          const walkAction = mixer.clipAction(walkClip);
          const hitAction = hitClip ? mixer.clipAction(hitClip) : null;
          const jumpAction = jumpClip ? mixer.clipAction(jumpClip) : null;

          idleAction.play();
          idleAction.paused = false;

          runAction.play();
          runAction.paused = true;

          walkAction.play();
          walkAction.paused = true;

          if (hitAction) {
            hitAction.play();
            hitAction.paused = true;
          }

          if (jumpAction) {
            jumpAction.setLoop(THREE.LoopOnce, 1);
            jumpAction.clampWhenFinished = true;
            jumpAction.play();
            jumpAction.paused = true;
          }

          world.player.mechMixer = mixer;
          world.player.mechIdleAction = idleAction;
          world.player.mechRunAction = runAction;
          world.player.mechWalkAction = walkAction;
          world.player.mechHitAction = hitAction;
          world.player.mechJumpAction = jumpAction;
        }
      },
      undefined,
      () => {
        tryLoad(index + 1);
      },
    );
  };

  tryLoad(0);
}

export function loadSpaceshipVisual(world) {
  world.loader.load(
    asset('Spaceship.glb'),
    (gltf) => {
      const ship = gltf.scene;
      ship.scale.set(0.85, 0.85, 0.85);
      ship.position.set(0, -0.82, 0);
      ship.visible = false;
      applyToonToObject(world, ship);

      world.player.entity.mesh.add(ship);
      world.player.shipVisual = ship;
    },
    undefined,
    () => {
      const fallback = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 1.05, 0.32, 16),
        getToonMaterial(world, { color: '#9aa7b8' }),
      );
      fallback.position.set(0, -0.8, 0);
      fallback.visible = false;
      world.player.entity.mesh.add(fallback);
      world.player.shipVisual = fallback;
    },
  );
}

export function beginModeTransition(world, targetState) {
  if (world.player.modeTransitionActive || world.player.state === targetState) {
    return;
  }

  world.player.modeTransitionActive = true;
  world.player.modeTransitionTimer = 0;
  world.player.modeTransitionFrom = world.player.state;
  world.player.modeTransitionTo = targetState;
  world.player.modeTransitionSwapped = false;
  world.player.velocity.multiplyScalar(0.35);
}

export function updateModeTransition(world, dt) {
  if (!world.player.modeTransitionActive) {
    world.player.modeJumpOffset = 0;
    return;
  }

  world.player.modeTransitionTimer += dt;
  const t = THREE.MathUtils.clamp(
    world.player.modeTransitionTimer / world.player.modeTransitionDuration,
    0,
    1,
  );

  world.player.modeJumpOffset = Math.sin(t * Math.PI) * world.player.modeJumpHeight;

  if (!world.player.modeTransitionSwapped && t >= 0.5) {
    world.player.modeTransitionSwapped = true;
    if (world.player.shipVisual) {
      world.player.shipVisual.visible = world.player.modeTransitionTo === PLAYER_STATE.DRIVE;
    }
  }

  if (t >= 1) {
    world.player.modeTransitionActive = false;
    world.player.state = world.player.modeTransitionTo;
    world.player.modeJumpOffset = 0;
  }
}

export function updatePlayerStateControls(world) {
  if (world.inputHandler.wasPressedOnce('y') && !world.extractionUnlocked) {
    if (!world.extractionPoint) {
      spawnExtractionPoint(world);
    }
    world.extractionUnlocked = true;
    world.hud.speech.textContent = 'Quick extract enabled. Reach the blue ring.';
    world.hud.speech.style.display = 'block';
    world.speechBubbleTimer = 2.6;
  }

  if (world.player.state === PLAYER_STATE.HACKING || world.player.modeTransitionActive) {
    return;
  }

  if (world.inputHandler.wasPressedOnce('t')) {
    const targetState = world.player.state === PLAYER_STATE.MECH ? PLAYER_STATE.DRIVE : PLAYER_STATE.MECH;
    beginModeTransition(world, targetState);
  }

  // Jump logic: if moving, jump forward; else, regular jump
  const isMoving = world.player.velocity && world.player.velocity.lengthSq() > 0.1;
  if (
    world.inputHandler.wasPressedOnce(' ')
    && !world.player.jumpActive
  ) {
    world.player.jumpActive = true;
    world.player.jumpTimer = 0;
    if (isMoving) {
      // Apply a forward boost for jump
      const jumpBoost = world.player.facing.clone().normalize().multiplyScalar(7.5);
      world.player.velocity.add(jumpBoost);
    }
    if (world.player.state === PLAYER_STATE.MECH && world.player.mechJumpAction) {
      world.player.mechJumpAction.reset();
      world.player.mechJumpAction.paused = false;
    }
    if (world.player.state === PLAYER_STATE.DRIVE) {
      world.player.jumpHeight = 1.2;
      world.player.jumpDuration = 0.38;
    }
  }

  world.player.isCrouch = world.inputHandler.keys.shift;
}

export function updatePlayerMovement(world, dt) {
  const tile = world.map.quantize(world.player.position);

  if (!tile) {
    return;
  }

  if (world.player.state === PLAYER_STATE.HACKING || world.player.modeTransitionActive) {
    world.player.velocity.multiplyScalar(0.84);
    world.player.position.addScaledVector(world.player.velocity, dt);
    world.constrainToMap(world.player.position);
    syncPlayerVisuals(world);
    return;
  }

  let maxSpeed = world.player.state === PLAYER_STATE.MECH ? world.player.baseMechSpeed : world.player.baseDriveSpeed;
  let acceleration = world.player.state === PLAYER_STATE.MECH ? 34 : 46;
  let drag = world.player.state === PLAYER_STATE.MECH ? 5.8 : 4.4;

  if (world.player.isCrouch) {
    if (world.player.state === PLAYER_STATE.MECH) {
      maxSpeed *= 0.55;
      acceleration *= 0.8;
    } else {
      maxSpeed *= 0.42;
      acceleration *= 0.4;
    }
  }

  // If on water, reduce speed and acceleration
  if (tile.type && tile.type.description === 'Water') {
    maxSpeed *= 0.38; // much slower on water
    acceleration *= 0.45;
    drag *= 1.5;
  }

  const inputForce = world.inputHandler.getForce(1);
  if (inputForce.lengthSq() > 0) {
    inputForce.normalize();
    world.player.facing.copy(inputForce);
    world.player.acceleration.copy(inputForce.multiplyScalar(acceleration));
  } else {
    world.player.acceleration.set(0, 0, 0);
  }

  world.player.velocity.addScaledVector(world.player.acceleration, dt);
  world.player.velocity.addScaledVector(world.player.velocity.clone().multiplyScalar(-drag), dt);
  world.player.velocity.clampLength(0, maxSpeed);

  const nextPosition = world.player.position.clone().addScaledVector(world.player.velocity, dt);

  const fromTile = world.map.quantize(world.player.position);
  const toTile = world.map.quantize(nextPosition);

  if (toTile && world.map.isTileWalkable(toTile) && !world.map.isSteepTransition(fromTile, toTile)) {
    world.player.position.copy(nextPosition);
  } else {
    world.player.velocity.multiplyScalar(0.2);
  }

  world.resolveRuinCollisions(world.player.position, world.player.velocity);
  world.constrainToMap(world.player.position);

  if (world.player.state === PLAYER_STATE.DRIVE && world.player.velocity.lengthSq() > 5) {
    spawnTrack(world);
  }

  syncPlayerVisuals(world);
}

export function updatePlayerJump(world, dt) {
  if (!world.player.jumpActive) {
    world.player.jumpOffset = 0;
    return;
  }
  world.player.jumpTimer += dt;
  const t = THREE.MathUtils.clamp(world.player.jumpTimer / world.player.jumpDuration, 0, 1);
  world.player.jumpOffset = Math.sin(t * Math.PI) * world.player.jumpHeight;
  if (t >= 1) {
    world.player.jumpActive = false;
    world.player.jumpOffset = 0;
    if (world.player.mechJumpAction) {
      world.player.mechJumpAction.paused = true;
    }
  }
}

export function updatePlayerLongJump(world, dt) {
  // Long jump removed
}

export function updatePlayerAnimation(world, dt) {
  if (!world.player.mechMixer || !world.player.mechRunAction) {
    return;
  }

  const idleAction = world.player.mechIdleAction;
  const runAction = world.player.mechRunAction;
  const walkAction = world.player.mechWalkAction;
  const hitAction = world.player.mechHitAction;

  const isMovingInput =
    world.inputHandler.keys.w
    || world.inputHandler.keys.a
    || world.inputHandler.keys.s
    || world.inputHandler.keys.d;

  const isShiftPressed = world.inputHandler.keys.shift;
  const isJumping = world.player.jumpActive;

  // --- HIT BLINK VISUAL FEEDBACK ---
  // Only apply to MECH and DRIVE states
  // Remove duplicate isHitReacting declaration (already declared below)
  const mechVisual = world.player.mechVisual;
  const shipVisual = world.player.shipVisual;
  // Helper to set color/emissive recursively
  function setMeshColor(obj, color, emissive) {
    obj.traverse((child) => {
      if (child.isMesh && child.material) {
        if (color) child.material.color.set(color);
        if (emissive !== undefined && child.material.emissive) child.material.emissive.set(emissive);
      }
    });
  }
  // Store original color on first run
  if (!world._originalMechColor && mechVisual) {
    world._originalMechColor = {};
    mechVisual.traverse((child) => {
      if (child.isMesh && child.material) {
        world._originalMechColor[child.uuid] = {
          color: child.material.color.clone(),
          emissive: child.material.emissive ? child.material.emissive.clone() : null,
        };
      }
    });
  }
  if (!world._originalShipColor && shipVisual) {
    world._originalShipColor = {};
    shipVisual.traverse((child) => {
      if (child.isMesh && child.material) {
        world._originalShipColor[child.uuid] = {
          color: child.material.color.clone(),
          emissive: child.material.emissive ? child.material.emissive.clone() : null,
        };
      }
    });
  }
  // Apply blink effect
  if (world.player.hitReactionTimer > 0) {
    // Always blink both mech and ship visuals if present (even in DRIVE mode)
    if (mechVisual) {
      setMeshColor(mechVisual, '#ff2222', '#ff2222');
    }
    if (shipVisual) {
      setMeshColor(shipVisual, '#ff2222', '#ff2222');
    }
  } else {
    // Restore original color
    if (mechVisual && world._originalMechColor) {
      mechVisual.traverse((child) => {
        if (child.isMesh && child.material && world._originalMechColor[child.uuid]) {
          child.material.color.copy(world._originalMechColor[child.uuid].color);
          if (child.material.emissive && world._originalMechColor[child.uuid].emissive) {
            child.material.emissive.copy(world._originalMechColor[child.uuid].emissive);
          }
        }
      });
    }
    if (shipVisual && world._originalShipColor) {
      shipVisual.traverse((child) => {
        if (child.isMesh && child.material && world._originalShipColor[child.uuid]) {
          child.material.color.copy(world._originalShipColor[child.uuid].color);
          if (child.material.emissive && world._originalShipColor[child.uuid].emissive) {
            child.material.emissive.copy(world._originalShipColor[child.uuid].emissive);
          }
        }
      });
    }
  }

  const shouldMove =
    isMovingInput
    && world.player.state !== PLAYER_STATE.HACKING
    && !world.player.modeTransitionActive
    && world.player.state === PLAYER_STATE.MECH
    && !isJumping;

  world.player.hitReactionTimer = Math.max(0, (world.player.hitReactionTimer || 0) - dt);
  const isHitReacting = world.player.hitReactionTimer > 0;

  if (hitAction) {
    hitAction.paused = !isHitReacting;
    if (isHitReacting) {
      hitAction.timeScale = 1.25;
      runAction.paused = true;
      walkAction.paused = true;
      if (idleAction) idleAction.paused = true;
      if (world.player.mechJumpAction) world.player.mechJumpAction.paused = true;
    }
  }

  if (isJumping && !isHitReacting) {
    runAction.paused = true;
    walkAction.paused = true;
    if (idleAction) idleAction.paused = true;
    world.player.mechMixer.update(dt);
    return;
  }

  // Pause idle when moving
  if (idleAction && !isHitReacting) {
    idleAction.paused = shouldMove;
  }

  if (!isHitReacting && shouldMove) {
    if (isShiftPressed) {
      // Play walk animation when shift is pressed
      walkAction.paused = false;
      runAction.paused = true;
      walkAction.timeScale = 1.0;
    } else {
      // Play run animation for normal movement
      runAction.paused = false;
      walkAction.paused = true;
      const speedRatio = world.player.velocity.length() / Math.max(world.player.baseMechSpeed, 0.001);
      runAction.timeScale = THREE.MathUtils.clamp(0.85 + speedRatio, 0.85, 1.7);
    }
  } else if (!isHitReacting) {
    // Pause both run and walk when not moving
    runAction.paused = true;
    walkAction.paused = true;
    // Resume idle
    if (idleAction) {
      idleAction.paused = false;
    }
  }

  world.player.mechMixer.update(dt);
}

export function triggerPlayerHitReaction(world, duration = 0.2) {
  world.player.hitReactionTimer = Math.max(world.player.hitReactionTimer || 0, duration);

  if (world.player.mechHitAction) {
    world.player.mechHitAction.reset();
    world.player.mechHitAction.play();
    world.player.mechHitAction.paused = false;
  }
}

export function syncPlayerVisuals(world) {
  const mesh = world.player.entity.mesh;
  const h = world.map.getHeightAtPosition(world.player.position);
  let vehicleLift = world.player.state === PLAYER_STATE.DRIVE ? world.player.vehicleLiftOffset : 0;
  let jumpY = world.player.modeJumpOffset + world.player.jumpOffset;
  if (world.player.state === PLAYER_STATE.DRIVE) {
    jumpY += world.player.longJumpOffset;
  }
  mesh.position.set(
    world.player.position.x,
    h + world.player.entity.scale.y / 2 + jumpY + vehicleLift,
    world.player.position.z,
  );

  const lookAt = world.player.position.clone().add(world.player.facing);
  lookAt.y = mesh.position.y;
  mesh.lookAt(lookAt);

  world.player.bbox.setFromObject(mesh);
}

export function spawnTrack(world) {
  if (world.tracks.length > 90) {
    const oldest = world.tracks.shift();
    world.scene.remove(oldest.mesh);
  }

  const track = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 1.7),
    new THREE.MeshBasicMaterial({ color: '#2a2b2f', transparent: true, opacity: 0.45, depthWrite: false }),
  );

  track.rotation.x = -Math.PI / 2;
  track.rotation.z = Math.atan2(world.player.facing.x, world.player.facing.z);

  const h = world.map.getHeightAtPosition(world.player.position);
  track.position.set(world.player.position.x, h + 0.08, world.player.position.z);

  world.scene.add(track);
  world.tracks.push({ mesh: track, life: 1.5 });
}

export function updateTracks(world, dt) {
  for (let i = world.tracks.length - 1; i >= 0; i--) {
    const mark = world.tracks[i];
    mark.life -= dt;
    mark.mesh.material.opacity = Math.max(0, mark.life / 1.5) * 0.45;

    if (mark.life <= 0) {
      world.scene.remove(mark.mesh);
      world.tracks.splice(i, 1);
    }
  }
}
