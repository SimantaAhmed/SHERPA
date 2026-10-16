/**
 * Run objectives: data terminals, the extraction point and the secret character.
 */

import * as THREE from 'three';
import { asset } from '../util/assets.js';
import { applyToonToObject, getToonMaterial } from './materials.js';
import { callLurkersToSignal } from './lurkers.js';
import { PLAYER_STATE } from './states.js';

export async function spawnTerminals(world) {
  const terminalCount = THREE.MathUtils.randInt(3, 5);
  const baseScene = await loadServerRackModel(world);

  for (let i = 0; i < terminalCount; i++) {
    const margin = Math.floor(world.map.rows * 0.15);
    const tile = world.map.getRandomWalkableTile((candidate) => {
      if (candidate.blackout) return false;
      if (candidate.row < margin || candidate.row > world.map.rows - margin) return false;
      if (candidate.col < margin || candidate.col > world.map.cols - margin) return false;
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      const openNeighbours = dirs.filter(([dr, dc]) => {
        const n = world.map.getTile(candidate.row + dr, candidate.col + dc);
        return n && world.map.isTileWalkable(n);
      }).length;
      return openNeighbours >= 3;
    });
    if (!tile) {
      continue;
    }

    const pos = world.map.localize(tile);
    const mesh = baseScene ? baseScene.clone(true) : createFallbackTerminal(world);
    applyToonToObject(world, mesh);

    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.scale.setScalar(0.8);
    mesh.rotation.y = world.rng.next() * Math.PI * 2;
    world.scene.add(mesh);

    world.terminals.push({
      mesh,
      tile,
      position: pos.clone(),
      integrity: 100,
      hackedProgress: 0,
      hacked: false,
      bbox: new THREE.Box3().setFromObject(mesh),
    });
  }
}

export async function loadServerRackModel(world) {
  try {
    const gltf = await world.loader.loadAsync(asset('server rack.glb'));
    return gltf.scene;
  } catch (error) {
    return null;
  }
}

export function createFallbackTerminal(world) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 2.2, 1.0),
    getToonMaterial(world, { color: '#57606a' }),
  );
}

export function updateTerminals(world, dt) {
  if (!world.terminals.length || world.runFinished) {
    return;
  }

  const isHoldingHack = world.inputHandler.keys.e;

  if (world.player.state !== PLAYER_STATE.HACKING && isHoldingHack) {
    const candidate = world.terminals.find((terminal) => {
      if (terminal.hacked || terminal.integrity <= 0) {
        return false;
      }
      return terminal.position.distanceTo(world.player.position) <= 3.2;
    });

    if (candidate) {
      world.player.state = PLAYER_STATE.HACKING;
      world.player.hackTarget = candidate;
      world.player.hackTimer = world.hackDuration;
      world.player.velocity.set(0, 0, 0);

      callLurkersToSignal(world, candidate.position, 1.45);
    }
  }

  if (world.player.state === PLAYER_STATE.HACKING && world.player.hackTarget) {
    const target = world.player.hackTarget;
    const stillInRange = target.position.distanceTo(world.player.position) <= 3.2;

    if (!isHoldingHack || !stillInRange || target.hacked || target.integrity <= 0) {
      target.hackedProgress = 0;
      world.player.hackTimer = world.hackDuration;
      world.player.hackTarget = null;
      world.player.state = PLAYER_STATE.MECH;
      return;
    }

    world.player.hackTimer -= dt;
    target.hackedProgress = THREE.MathUtils.clamp(1 - (world.player.hackTimer / world.hackDuration), 0, 1);

    if (world.player.hackTimer <= 0) {
      target.hacked = true;
      target.integrity = Math.max(target.integrity, 1);
      world.score += Math.round(150 * target.integrity / 100);

      world.player.hackTarget = null;
      world.player.state = world.player.state === PLAYER_STATE.DRIVE ? PLAYER_STATE.DRIVE : PLAYER_STATE.MECH;
    }
  }

  const allComplete = world.terminals.every((terminal) => terminal.hacked || terminal.integrity <= 0);
  if (allComplete && !world.extractionUnlocked) {
    world.extractionUnlocked = true;
    if (world.extractionPoint) {
      world.extractionPoint.ring.visible = true;
      world.extractionPoint.pillar.visible = true;
      world.extractionPoint.light.visible = true;
    }
    world.hud.speech.textContent = 'Extraction point unlocked. Get to the centre.';
    world.hud.speech.style.display = 'block';
    world.speechBubbleTimer = 3.6;
  }
}

export function spawnExtractionPoint(world) {
  const centerRow = Math.floor(world.map.rows / 2);
  const centerCol = Math.floor(world.map.cols / 2);
  const tile = world.map.walkableTiles
    .filter(t => !t.blackout)
    .sort((a, b) => {
      const da = (a.row - centerRow) ** 2 + (a.col - centerCol) ** 2;
      const db = (b.row - centerRow) ** 2 + (b.col - centerCol) ** 2;
      return da - db;
    })[0] || world.map.walkableTiles[0];

  if (!tile) return;

  const pos = world.map.localize(tile);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.5, 0.15, 10, 48),
    new THREE.MeshBasicMaterial({ color: '#4cc9ff', transparent: true, opacity: 0.9 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(pos.x, pos.y + 0.18, pos.z);
  ring.visible = false;
  world.scene.add(ring);

  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 30, 8),
    new THREE.MeshBasicMaterial({ color: '#4cc9ff', transparent: true, opacity: 0.55 }),
  );
  pillar.position.set(pos.x, pos.y + 15, pos.z);
  pillar.visible = false;
  world.scene.add(pillar);

  const light = new THREE.PointLight(0x4cc9ff, 2.5, 20);
  light.position.set(pos.x, pos.y + 2, pos.z);
  light.visible = false;
  world.scene.add(light);

  world.extractionPoint = { ring, pillar, light, position: pos.clone() };
}

export function updateExtractionPoint(world, dt) {
  if (!world.extractionPoint || !world.extractionPoint.ring) {
    return;
  }

  if (world.extractionUnlocked) {
    world.extractionPoint.ring.visible = true;
    world.extractionPoint.pillar.visible = true;
    world.extractionPoint.light.visible = true;
    world.extractionPoint.ring.rotation.z += dt * 1.2;

    const ringY = world.map.getHeightAtPosition(world.extractionPoint.position) + 0.18;
    world.extractionPoint.ring.position.set(world.extractionPoint.position.x, ringY, world.extractionPoint.position.z);

    const distance = world.player.position.distanceTo(world.extractionPoint.position);
    if (distance <= 6.0 && !world.runFinished) {
      world.runFinished = true;
      world.endScreenType = 'clear';
      world.gameOver = true;
    }
  } else {
    world.extractionPoint.ring.visible = false;
    world.extractionPoint.pillar.visible = false;
    world.extractionPoint.light.visible = false;
  }
}

export async function spawnSecretCharacter(world) {
  const isReachableCandidate = (candidate) => {
    if (!candidate || !world.map.isTileWalkable(candidate)) {
      return false;
    }

    const candidatePos = world.map.localize(candidate);
    const probe = new THREE.Vector3(candidatePos.x, candidatePos.y + 1.0, candidatePos.z);
    const tooCloseToObstacle = world.ruins.some((r) => {
      if (!r.bbox) {
        return false;
      }
      const expanded = r.bbox.clone().expandByScalar(0.65);
      return expanded.containsPoint(probe);
    });

    return !tooCloseToObstacle;
  };

  const tile = world.map.getRandomWalkableTile(isReachableCandidate);
  if (!tile) {
    return;
  }

  const pos = world.map.localize(tile);

  let mesh;
  let secretModel = 'fallback';
  try {
    const gltf = await world.loader.loadAsync(asset('sherma__-_hollow_knight_silksong.glb'));
    mesh = gltf.scene;
    mesh.scale.setScalar(1.15);
    applyToonToObject(world, mesh);
    mesh.position.set(pos.x, pos.y + 0.05, pos.z);
    secretModel = 'sherma';
  } catch (error) {
    mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.2, 20),
      new THREE.MeshBasicMaterial({ color: '#8ff0ff' }),
    );
    mesh.position.set(pos.x, pos.y + 0.3, pos.z);
  }

  world.scene.add(mesh);

  const glow = new THREE.PointLight(0x8ff0ff, 1.3, 8);
  glow.position.copy(mesh.position);
  world.scene.add(glow);

  world.secretCharacter = {
    mesh,
    glow,
    model: secretModel,
    used: false,
    position: pos.clone(),
  };

  spawnShipNearSecret(world, pos);
}

export async function spawnShipNearSecret(world, secretPos) {
  try {
    const gltf = await world.loader.loadAsync(asset('Ship.glb'));
    const ship = gltf.scene;

    let shipPos = secretPos.clone().add(new THREE.Vector3(6, 0, 0));
    for (let i = 0; i < 14; i++) {
      const angle = world.rng.next() * Math.PI * 2;
      const distance = THREE.MathUtils.randFloat(5.2, 9.0);
      const candidate = secretPos.clone().add(new THREE.Vector3(
        Math.cos(angle) * distance,
        0,
        Math.sin(angle) * distance,
      ));

      const tile = world.map.quantize(candidate);
      if (tile && world.map.isTileWalkable(tile) && !world.map.isBlackoutTile(tile)) {
        shipPos = world.map.localize(tile);
        break;
      }
    }
    
    ship.position.copy(shipPos);
    ship.rotation.y = world.rng.next() * Math.PI * 2;
    ship.scale.setScalar(1.2);
    
    world.scene.add(ship);

    const bbox = new THREE.Box3().setFromObject(ship);
    world.ruins.push({ mesh: ship, bbox });
  } catch (error) {
    console.warn('Failed to load Ship.glb:', error);
  }
}

export function updateSecretCharacter(world, dt) {

  if (!world.secretCharacter) return;

  const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.12;
  world.secretCharacter.mesh.scale.setScalar(pulse);

  const d = world.secretCharacter.mesh.position.distanceTo(world.player.entity.mesh.position);
  const healRadius = 10.5;
  if (d <= healRadius) {
    // Heal gradually while in radius
    const healRate = world.player.maxHealth * 0.18 * dt; // 18% per second
    world.player.health = Math.min(world.player.maxHealth, world.player.health + healRate);
    world.hud.speech.textContent = world.secretCharacter.model === 'sherma'
      ? 'fa-ri-doo-la-see-ma-net do-ni-pwa-nah-vo-li-net pi-nah-so-mi-ma-ni-set da-na-fo-su-lo-bon!(Yes, Silksong reference.)'
      : 'Resting near the secret character.'; // Custom message for non-Sherma character but forgot to remove it noticed very late in development, oops
    world.hud.speech.style.display = 'block';
    world.speechBubbleTimer = 1.0;
  }

  if (world.speechBubbleTimer > 0) {
    world.speechBubbleTimer -= dt;
    if (world.speechBubbleTimer <= 0) {
      world.hud.speech.style.display = 'none';
    }
  }
}
