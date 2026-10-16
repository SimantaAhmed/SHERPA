// Lurker spawning, the patrol/alert/pursue/return states, steering and projectiles.

import * as THREE from 'three';
import { asset } from '../util/assets.js';
import { applyToonToObject, getToonMaterial } from './materials.js';
import { triggerPlayerHitReaction } from './player.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { JPS } from '../ai/pathfinding/JPS.js';
import { SteeringBehaviours } from '../ai/steering/SteeringBehaviours.js';
import { PLAYER_STATE, LURKER_STATE } from './states.js';

export async function loadLurkerTemplate(world) {
  if (world.lurkerTemplate !== undefined) {
    return world.lurkerTemplate;
  }

  try {
    world.lurkerTemplate = await world.loader.loadAsync(asset('Astronaut.glb'));
  } catch (error) {
    world.lurkerTemplate = null;
  }

  return world.lurkerTemplate;
}

export async function spawnLurkers(world) {
  const lurkerCount = 9;
  const astronautTemplate = await loadLurkerTemplate(world);

  for (let i = 0; i < lurkerCount; i++) {
    const tile = world.map.getRandomWalkableTile();
    if (!tile) {
      continue;
    }
    spawnSingleLurkerFromTile(world, tile, astronautTemplate);
  }

  world.jps = new JPS(
    world.map,
    (a, b, weight = 1) => {
      const dr = Math.abs(a.row - b.row);
      const dc = Math.abs(a.col - b.col);
      return (dr + dc) * weight;
    },
    world.tileMapRenderer,
  );
}

export function spawnSingleLurkerFromTile(world, tile, astronautTemplate, forcePursue = false) {
  const pos = world.map.localize(tile);

  const mesh = new THREE.Group();
  mesh.position.set(pos.x, pos.y + 0.8, pos.z);
  world.scene.add(mesh);

  let mixer = null;
  let walkAction = null;
  let runAction = null;
  let shootAction = null;
  let punchAction = null;

  if (astronautTemplate) {
    const visual = SkeletonUtils.clone(astronautTemplate.scene);
    applyToonToObject(world, visual);
    visual.scale.set(1.0, 1.0, 1.0);
    visual.position.set(0, -0.8, 0);
    mesh.add(visual);

    if (astronautTemplate.animations && astronautTemplate.animations.length > 0) {
      const walkClip =
        astronautTemplate.animations.find((clip) => {
          const name = clip.name.toLowerCase();
          return name.includes('walk_gun') || name.includes('walk gun');
        })
        || astronautTemplate.animations.find((clip) => clip.name.toLowerCase().includes('walk'))
        || astronautTemplate.animations[0];

      const runClip =
        astronautTemplate.animations.find((clip) => {
          const name = clip.name.toLowerCase();
          return name.includes('run_gun') || name.includes('run gun');
        })
        || astronautTemplate.animations.find((clip) => clip.name.toLowerCase().includes('run'))
        || null;

      const shootClip =
        astronautTemplate.animations.find((clip) => {
          const name = clip.name.toLowerCase();
          return name.includes('run_gun_shoot') || name.includes('run gun shoot') || name.includes('shoot');
        })
        || null;

      const punchClip =
        astronautTemplate.animations.find((clip) => {
          const name = clip.name.toLowerCase();
          return name.includes('punch') || name.includes('melee') || name.includes('attack');
        })
        || null;

      mixer = new THREE.AnimationMixer(visual);
      walkAction = mixer.clipAction(walkClip);
      walkAction.play();
      walkAction.paused = false;

      if (runClip) {
        runAction = mixer.clipAction(runClip);
        runAction.play();
        runAction.paused = true;
      }

      if (shootClip) {
        shootAction = mixer.clipAction(shootClip);
        shootAction.play();
        shootAction.paused = true;
      }

      if (punchClip) {
        punchAction = mixer.clipAction(punchClip);
        punchAction.play();
        punchAction.paused = true;
      }
    }
  } else {
    const fallbackCube = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 1.6, 1.0),
      getToonMaterial(world, { color: '#7f261f' }),
    );
    mesh.add(fallbackCube);
  }

  const cone = createDetectionCone(world);
  mesh.add(cone);

  const alertSprite = createAlertSprite(world);
  alertSprite.visible = false;
  mesh.add(alertSprite);

  world.lurkers.push({
    mesh,
    tile,
    position: pos.clone(),
    velocity: new THREE.Vector3(),
    acceleration: new THREE.Vector3(),
    topSpeed: 8.5,
    maxForce: 13,
    state: forcePursue ? LURKER_STATE.PURSUE : LURKER_STATE.PATROL,
    runAction,
    shootAction,
    punchAction,
    isAttacking: false,
    isPunching: false,
    chaseBoostTimer: forcePursue ? 3.2 : 0,
    shootCooldown: THREE.MathUtils.randFloat(0.25, 1.1),
    alertTimer: 0,
    huntTimer: forcePursue ? 12 : 0,
    patrolTarget: world.map.getRandomWalkableTile(),
    detectionRange: 18,
    detectionAngle: Math.PI * 0.36,
    path: [],
    pathIndex: 0,
    replanTimer: 0,
    aiUpdateTimer: THREE.MathUtils.randFloat(0, 0.12),
    detectionCheckTimer: THREE.MathUtils.randFloat(0, 0.1),
    animationUpdateTimer: THREE.MathUtils.randFloat(0, 0.08),
    lodProfile: null,
    alertSprite,
    cone,
    homePosition: pos.clone(),
    mixer,
    walkAction,
    bbox: new THREE.Box3().setFromObject(mesh),
  });
}

export async function spawnReinforcementLurkers(world, count = 2, rushPlayer = true) {
  const astronautTemplate = await loadLurkerTemplate(world);

  for (let i = 0; i < count; i++) {
    const tile = world.map.getRandomWalkableTile((candidate) => {
      const local = world.map.localize(candidate);
      return local.distanceTo(world.player.position) <= 26;
    }) || world.map.getRandomWalkableTile();

    if (!tile) {
      continue;
    }

    spawnSingleLurkerFromTile(world, tile, astronautTemplate, rushPlayer);
  }

  if (rushPlayer) {
    activateSwarmPursuit(world, world.player.position, 12);
    callNearbyBackupLurkers(world, world.player.position, 2);
  }
}

export function createDetectionCone(world) {
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(4, 10, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: '#ff9933',
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );

  cone.rotation.x = Math.PI / 2;
  cone.position.set(0, 0.1, 4.8);
  return cone;
}

export function createAlertSprite(world) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 88px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', size / 2, size / 2 + 6);

  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(1.4, 1.4, 1);
  sprite.position.set(0, 2.2, 0);
  return sprite;
}

export function getLurkerLodProfile(world, distance) {
  return { name: 'near', aiInterval: 0.09, detectionInterval: 0.09, animationInterval: 0.09, obstacleAvoidance: true };
}

export function callLurkersToSignal(world, signalPos, boost = 1) {
  for (const lurker of world.lurkers) {
    const d = lurker.position.distanceTo(signalPos);
    if (d < 30 * boost) {
      lurker.state = LURKER_STATE.PURSUE;
      lurker.huntTimer = Math.max(lurker.huntTimer, 6);
    }
  }
}

export function updateLurkers(world, dt) {
  let pursuitTriggeredThisFrame = false;
  let pursuitTriggerPosition = null;

  for (const lurker of world.lurkers) {
    const toPlayer = world.player.position.clone().sub(lurker.position);
    const distance = toPlayer.length();
    const lodProfile = getLurkerLodProfile(world, distance);
    lurker.lodProfile = lodProfile;
    const playerTile = world.map.quantize(world.player.position);

    const inBlackout = playerTile ? world.map.isBlackoutTile(playerTile) : false;
    const detectionRange = lurker.detectionRange * (inBlackout ? 2 : 1);
    lurker.detectionCheckTimer = Math.max(0, (lurker.detectionCheckTimer || 0) - dt);

    if (lurker.state === LURKER_STATE.PURSUE || lurker.detectionCheckTimer <= 0) {
      lurker.detectionCheckTimer = lodProfile.detectionInterval;

      const forward = lurker.velocity.lengthSq() > 0.1
        ? lurker.velocity.clone().normalize()
        : new THREE.Vector3(0, 0, 1);

      const normalizedToPlayer = toPlayer.lengthSq() > 0 ? toPlayer.clone().normalize() : new THREE.Vector3(0, 0, 1);
      const angle = forward.angleTo(normalizedToPlayer);
      const reverseAngle = Math.PI - angle;
      const inCone = Math.min(angle, reverseAngle) <= lurker.detectionAngle;
      const hasSightLine = world.hasLineOfSight(lurker.position, world.player.position);

      const canSee = inCone && distance <= detectionRange && hasSightLine;
      lurker.canSeePlayer = canSee;
      lurker.hasSightLine = hasSightLine;
    }

  }

  for (const lurker of world.lurkers) {
    const toPlayer = world.player.position.clone().sub(lurker.position);
    const distance = toPlayer.length();
    lurker.isAttacking = distance <= 1.8;
    lurker.isPunching = distance <= 1.25;
    const lodProfile = lurker.lodProfile || getLurkerLodProfile(world, distance);
    lurker.aiUpdateTimer = Math.max(0, (lurker.aiUpdateTimer || 0) - dt);
    const runFullAi = lurker.state === LURKER_STATE.PURSUE || lodProfile.name === 'near' || lurker.aiUpdateTimer <= 0;
    if (runFullAi) {
      lurker.aiUpdateTimer = lodProfile.aiInterval;
    }
    const playerTile = world.map.quantize(world.player.position);
    const lurkerTile = world.map.quantize(lurker.position);
    const canSee = !!lurker.canSeePlayer;

    switch (lurker.state) {
      case LURKER_STATE.PATROL:
        if (canSee) {
          lurker.state = LURKER_STATE.ALERT;
          lurker.alertTimer = 0.95;
          lurker.alertSprite.visible = true;
        } else if (runFullAi) {
          updatePatrolMovement(world, lurker, dt);
          lurker.alertSprite.visible = false;
        }
        break;

      case LURKER_STATE.ALERT:
        lurker.alertSprite.visible = true;
        lurker.alertTimer -= dt;
        lurker.velocity.multiplyScalar(0.88);

        if (!canSee) {
          lurker.state = LURKER_STATE.PATROL;
          lurker.patrolTarget = world.map.getRandomWalkableTile();
          lurker.alertSprite.visible = false;
        } else if (lurker.alertTimer <= 0) {
          lurker.state = LURKER_STATE.PURSUE;
          lurker.huntTimer = Math.max(lurker.huntTimer, 10);
          lurker.alertSprite.visible = false;
          pursuitTriggeredThisFrame = true;
          pursuitTriggerPosition = pursuitTriggerPosition || lurker.position.clone();
        }
        break;

      case LURKER_STATE.PURSUE:
        lurker.huntTimer -= dt;
        if (runFullAi) {
          updatePursueMovement(world, lurker, dt, lurkerTile, playerTile);
        }

        lurker.shootCooldown = Math.max(0, (lurker.shootCooldown || 0) - dt);
        if (canSee && distance <= 24 && !lurker.isPunching && lurker.shootCooldown <= 0) {
          fireLurkerProjectile(world, lurker);
          lurker.shootCooldown = THREE.MathUtils.randFloat(0.6, 1.15);
        }

        if (!lurker.hasSightLine) {
          lurker.state = LURKER_STATE.RETURN;
          lurker.huntTimer = 0;
          lurker.alertSprite.visible = false;
          break;
        }

        if (lurker.huntTimer <= 0 && !canSee) {
          lurker.state = LURKER_STATE.RETURN;
          lurker.alertSprite.visible = false;
        }
        break;

      case LURKER_STATE.RETURN:
        lurker.alertSprite.visible = false;
        if (runFullAi) {
          updateReturnMovement(world, lurker, dt);
        }
        break;
    }

    applyLurkerSeparation(world, lurker, dt);
    if (lodProfile.obstacleAvoidance || lurker.state === LURKER_STATE.PURSUE) {
      applyLurkerObstacleAvoidance(world, lurker);
    }
    integrateLurker(world, lurker, dt);

    if (lurker.isAttacking) {
      world.player.health = Math.max(0, world.player.health - (14 * dt));
      triggerPlayerHitReaction(world, 0.12);

      if (world.player.health <= 0) {
        world.endScreenType = 'over';
        world.gameOver = true;
      }

      if (world.player.hackTarget) {
        world.player.hackTarget.integrity = Math.max(0, world.player.hackTarget.integrity - (8 * dt));

        if (world.player.state === PLAYER_STATE.HACKING) {
          world.score += Math.floor(world.player.hackTarget.hackedProgress * 45);
          world.player.hackTarget = null;
          world.player.state = PLAYER_STATE.MECH;
        }
      }
    }
  }

  if (pursuitTriggeredThisFrame && world.swarmCooldown <= 0) {
    activateSwarmPursuit(world, pursuitTriggerPosition || world.player.position, 10);
    callNearbyBackupLurkers(world, pursuitTriggerPosition || world.player.position, 2);
    world.swarmCooldown = 0.75;
  }
}

export function updatePatrolMovement(world, lurker, dt) {
  if (!lurker.patrolTarget || !world.map.isTileWalkable(lurker.patrolTarget)) {
    lurker.patrolTarget = world.map.getRandomWalkableTile();
  }

  const targetPos = lurker.patrolTarget ? world.map.localize(lurker.patrolTarget) : lurker.homePosition;

  if (lurker.position.distanceTo(targetPos) < 1.8) {
    lurker.patrolTarget = world.map.getRandomWalkableTile();
    return;
  }

  const seekForce = SteeringBehaviours.seek({
    position: lurker.position,
    velocity: lurker.velocity,
    topSpeed: 7.4,
  }, targetPos);

  const wanderEntity = {
    position: lurker.position,
    velocity: lurker.velocity,
    topSpeed: 7.4,
    wanderAngle: lurker.wanderAngle,
  };
  const wanderForce = SteeringBehaviours.wander(wanderEntity, 4, 1.8, 0.35);
  lurker.wanderAngle = wanderEntity.wanderAngle;

  lurker.acceleration.add(seekForce.multiplyScalar(0.7));
  lurker.acceleration.add(wanderForce.multiplyScalar(0.3));
  applyTerminalInfluence(world, lurker);
}

export function updatePursueMovement(world, lurker, dt, lurkerTile, playerTile) {
  if (!lurkerTile || !playerTile) {
    return;
  }

  lurker.replanTimer -= dt;

  if (lurker.replanTimer <= 0) {
    lurker.replanTimer = world.pathReplanInterval;
    lurker.path = world.jps.findPath(lurkerTile, playerTile);
    lurker.pathIndex = 0;
  }

  let pursueTarget = world.player.position.clone().addScaledVector(world.player.velocity, 0.4);

  if (lurker.path && lurker.path.length > 1) {
    lurker.pathIndex = Math.min(lurker.pathIndex, lurker.path.length - 1);
    const nextTile = lurker.path[lurker.pathIndex];
    const nextPos = world.map.localize(nextTile);

    if (lurker.position.distanceTo(nextPos) < 1.2 && lurker.pathIndex < lurker.path.length - 1) {
      lurker.pathIndex += 1;
    }

    pursueTarget = world.map.localize(lurker.path[lurker.pathIndex]);
  }

  const pursueForce = SteeringBehaviours.pursue({
    position: lurker.position,
    velocity: lurker.velocity,
    topSpeed: 10.5,
  }, {
    position: pursueTarget,
    velocity: world.player.velocity,
  }, 0.25);

  lurker.acceleration.add(pursueForce);
  applyTerminalInfluence(world, lurker, true);
}

export function calculateSwarmSpeedBoost(world, lurker) {
  let swarmCount = 0;
  const swarmDetectionRadius = 12;

  for (const other of world.lurkers) {
    if (other === lurker) continue;
    if (other.state !== LURKER_STATE.PURSUE) continue;

    const distance = lurker.position.distanceTo(other.position);
    if (distance > 0 && distance < swarmDetectionRadius) {
      swarmCount += 1;
    }
  }

  lurker.swarmCount = swarmCount;
  return 1 + (swarmCount * 0.28);
}

export function updateReturnMovement(world, lurker, dt) {
  const target = lurker.homePosition;

  if (lurker.position.distanceTo(target) < 1.5) {
    lurker.state = LURKER_STATE.PATROL;
    lurker.patrolTarget = world.map.getRandomWalkableTile();
    return;
  }

  const steer = SteeringBehaviours.arrive({
    position: lurker.position,
    velocity: lurker.velocity,
    topSpeed: 7.8,
    maxForce: lurker.maxForce,
  }, target, 10, 1.2);

  lurker.acceleration.add(steer.multiplyScalar(0.9));
  applyTerminalInfluence(world, lurker);
}

export function applyTerminalInfluence(world, lurker, prioritizeHackTerminal = false) {
  if (world.player.hackTarget && !world.player.hackTarget.hacked) {
    const toHack = world.player.hackTarget.position.clone().sub(lurker.position);
    const distance = toHack.length();
    if (distance > 0.001) {
      const seekForce = SteeringBehaviours.seek({
        position: lurker.position,
        velocity: lurker.velocity,
        topSpeed: prioritizeHackTerminal ? 10.5 : 7.8,
      }, world.player.hackTarget.position);
      lurker.acceleration.add(seekForce.multiplyScalar(prioritizeHackTerminal ? 0.75 : 0.42));
    }
    return;
  }

  let closestTerminal = null;
  let closestDistance = Infinity;

  for (const terminal of world.terminals) {
    if (terminal.hacked || terminal.integrity <= 0) {
      continue;
    }

    const distance = lurker.position.distanceTo(terminal.position);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestTerminal = terminal;
    }
  }

  if (!closestTerminal || closestDistance > 8) {
    return;
  }

  const fleeForce = SteeringBehaviours.flee({
    position: lurker.position,
    velocity: lurker.velocity,
    topSpeed: 3.6,
  }, closestTerminal.position);

  lurker.acceleration.add(fleeForce.multiplyScalar(0.35));
}

export function broadcastHunt(world, position, duration) {
  for (const unit of world.lurkers) {
    if (unit.position.distanceTo(position) <= 20) {
      unit.state = LURKER_STATE.PURSUE;
      unit.huntTimer = Math.max(unit.huntTimer, duration);
    }
  }
}

export function activateSwarmPursuit(world, position, duration) {
  for (const unit of world.lurkers) {
    if (unit.position.distanceTo(position) <= 28) {
      unit.state = LURKER_STATE.PURSUE;
      unit.huntTimer = Math.max(unit.huntTimer, duration);
      unit.chaseBoostTimer = Math.max(unit.chaseBoostTimer || 0, 2.2);
    }
  }
}

export function callNearbyBackupLurkers(world, position, count = 2) {
  const nearby = world.lurkers
    .map((lurker) => ({ lurker, d: lurker.position.distanceTo(position) }))
    .filter(({ lurker, d }) => d > 0 && d <= 40 && lurker.state !== LURKER_STATE.PURSUE)
    .sort((a, b) => a.d - b.d)
    .slice(0, count);

  for (const { lurker } of nearby) {
    lurker.state = LURKER_STATE.PURSUE;
    lurker.huntTimer = Math.max(lurker.huntTimer, 10);
    lurker.chaseBoostTimer = Math.max(lurker.chaseBoostTimer || 0, 2.8);
    lurker.alertSprite.visible = true;
  }
}

export function applyLurkerSeparation(world, lurker, dt) {
  const desired = 2.1;
  const separate = new THREE.Vector3();
  let count = 0;

  for (const other of world.lurkers) {
    if (other === lurker) {
      continue;
    }

    const d = lurker.position.distanceTo(other.position);
    if (d > 0 && d < desired) {
      const diff = lurker.position.clone().sub(other.position);
      diff.normalize();
      diff.divideScalar(d);
      separate.add(diff);
      count += 1;
    }
  }

  if (count > 0) {
    separate.divideScalar(count);
    separate.setLength(7.2);
    lurker.acceleration.add(separate);
  }
}

export function applyLurkerObstacleAvoidance(world, lurker) {
  const avoid = new THREE.Vector3();
  let hits = 0;

  for (const ruin of world.ruins) {
    if (!ruin.bbox) {
      continue;
    }

    const closest = ruin.bbox.clampPoint(lurker.position, new THREE.Vector3());
    const d = lurker.position.distanceTo(closest);
    if (d > 0 && d < 3.4) {
      const away = lurker.position.clone().sub(closest).normalize().multiplyScalar((3.4 - d) * 3.2);
      avoid.add(away);
      hits += 1;
    }
  }

  if (hits > 0) {
    avoid.divideScalar(hits);
    lurker.acceleration.add(avoid);
  }
}

export function fireLurkerProjectile(world, lurker) {
  const spawnPos = lurker.mesh.position.clone().add(new THREE.Vector3(0, 1.15, 0));
  const targetPos = world.player.entity.mesh.position.clone().add(new THREE.Vector3(0, 1.1, 0));
  const dir = targetPos.sub(spawnPos).normalize();

  const projectile = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 10),
    new THREE.MeshBasicMaterial({ color: '#ffcf66' }),
  );

  projectile.position.copy(spawnPos);
  world.scene.add(projectile);

  world.lurkerProjectiles.push({
    mesh: projectile,
    velocity: dir.multiplyScalar(18),
    life: 2.2,
    damage: 4,
    owner: lurker,
  });
}

export function updateLurkerProjectiles(world, dt) {
  for (let i = world.lurkerProjectiles.length - 1; i >= 0; i--) {
    const projectile = world.lurkerProjectiles[i];
    projectile.life -= dt;
    projectile.mesh.position.addScaledVector(projectile.velocity, dt);

    if (projectile.life <= 0) {
      world.scene.remove(projectile.mesh);
      world.lurkerProjectiles.splice(i, 1);
      continue;
    }

    const playerCore = world.player.entity.mesh.position.clone().add(new THREE.Vector3(0, 0.85, 0));
    const hitPlayerByRadius = projectile.mesh.position.distanceTo(playerCore) <= 1.7;
    const hitPlayerByBox = world.player.bbox
      ? world.player.bbox.clone().expandByScalar(-0.3).containsPoint(projectile.mesh.position)
      : false;
    const hitPlayer = hitPlayerByRadius || hitPlayerByBox;
    if (hitPlayer) {
      if ((world.player.projectileInvulnTimer || 0) > 0) {
        world.scene.remove(projectile.mesh);
        world.lurkerProjectiles.splice(i, 1);
        continue;
      }

      world.player.health = Math.max(0, world.player.health - projectile.damage);
      world.player.projectileInvulnTimer = 0.45;
      triggerPlayerHitReaction(world, 0.22);
      if (world.player.health <= 0) {
        world.endScreenType = 'over';
        world.gameOver = true;
      }
      world.scene.remove(projectile.mesh);
      world.lurkerProjectiles.splice(i, 1);
      continue;
    }

    const blockedByRuin = world.ruins.some((ruin) => ruin.bbox && ruin.bbox.containsPoint(projectile.mesh.position));
    if (blockedByRuin) {
      world.scene.remove(projectile.mesh);
      world.lurkerProjectiles.splice(i, 1);
    }
  }
}

export function integrateLurker(world, lurker, dt) {
  lurker.acceleration.clampLength(0, lurker.maxForce);
  lurker.velocity.addScaledVector(lurker.acceleration, dt);
  lurker.velocity.multiplyScalar(0.96);

  lurker.chaseBoostTimer = Math.max(0, (lurker.chaseBoostTimer || 0) - dt);

  let speedCap = lurker.topSpeed + (lurker.state === LURKER_STATE.PURSUE ? 4.5 : 0);
  if (lurker.state === LURKER_STATE.PURSUE) {
    const swarmBoost = calculateSwarmSpeedBoost(world, lurker);
    speedCap += (swarmBoost - 1) * 5.2;
  }

  if ((lurker.chaseBoostTimer || 0) > 0) {
    speedCap += 3.6;
  }

  lurker.velocity.clampLength(0, speedCap);

  const nextPos = lurker.position.clone().addScaledVector(lurker.velocity, dt);
  const currentTile = world.map.quantize(lurker.position);
  const nextTile = world.map.quantize(nextPos);

  if (nextTile && world.map.isTileWalkable(nextTile) && !world.map.isSteepTransition(currentTile, nextTile)) {
    lurker.position.copy(nextPos);
  } else {
    lurker.velocity.multiplyScalar(0.2);
  }

  world.resolveRuinCollisions(lurker.position, lurker.velocity);
  world.constrainToMap(lurker.position);

  const y = world.map.getHeightAtPosition(lurker.position);
  lurker.mesh.position.set(lurker.position.x, y + 0.8, lurker.position.z);

  // Position alert sprite above lurker's head
  if (lurker.alertSprite) {
    lurker.alertSprite.position.set(0, 2.4, 0);
  }

  if (lurker.velocity.lengthSq() > 0.02) {
    lurker.mesh.lookAt(lurker.position.x + lurker.velocity.x, lurker.mesh.position.y, lurker.position.z + lurker.velocity.z);
  }

  if (lurker.mixer && lurker.walkAction) {
    const lodProfile = lurker.lodProfile || { animationInterval: 0, name: 'near' };
    lurker.animationUpdateTimer = Math.max(0, (lurker.animationUpdateTimer || 0) - dt);
    const shouldUpdateAnimation = lurker.state === LURKER_STATE.PURSUE || lodProfile.name === 'near' || lurker.animationUpdateTimer <= 0;

    if (!shouldUpdateAnimation) {
      lurker.cone.visible = lurker.state !== LURKER_STATE.PURSUE;
      lurker.bbox.setFromObject(lurker.mesh);
      lurker.acceleration.set(0, 0, 0);
      return;
    }

    lurker.animationUpdateTimer = lodProfile.animationInterval;
    const shouldRun = lurker.state === LURKER_STATE.PURSUE || !!lurker.canSeePlayer;
    const shouldShootRun = shouldRun && !!lurker.canSeePlayer;
    const shouldPunch = !!lurker.isPunching;

    if (lurker.runAction) {
      if (shouldPunch && lurker.punchAction) {
        if (lurker.shootAction) {
          lurker.shootAction.paused = true;
        }
        lurker.punchAction.paused = false;
        lurker.runAction.paused = true;
        lurker.walkAction.paused = true;
        lurker.punchAction.timeScale = THREE.MathUtils.clamp(1.1 + (lurker.velocity.length() / 7), 1.1, 1.9);
      } else if (shouldShootRun && lurker.shootAction) {
        if (lurker.punchAction) {
          lurker.punchAction.paused = true;
        }
        lurker.shootAction.paused = false;
        lurker.runAction.paused = true;
        lurker.walkAction.paused = true;
        lurker.shootAction.timeScale = THREE.MathUtils.clamp(1.0 + (lurker.velocity.length() / 7), 1.0, 1.75);
      } else if (shouldRun) {
        if (lurker.punchAction) {
          lurker.punchAction.paused = true;
        }
        if (lurker.shootAction) {
          lurker.shootAction.paused = true;
        }
        lurker.runAction.paused = false;
        lurker.walkAction.paused = true;
        lurker.runAction.timeScale = THREE.MathUtils.clamp(1.0 + (lurker.velocity.length() / 6), 1.0, 1.9);
      } else {
        if (lurker.punchAction) {
          lurker.punchAction.paused = true;
        }
        if (lurker.shootAction) {
          lurker.shootAction.paused = true;
        }
        lurker.runAction.paused = true;
        lurker.walkAction.paused = false;
        lurker.walkAction.timeScale = THREE.MathUtils.clamp(0.9 + (lurker.velocity.length() / 4.8), 0.9, 1.35);
      }
    } else {
      lurker.walkAction.paused = false;
      lurker.walkAction.timeScale = THREE.MathUtils.clamp(0.9 + (lurker.velocity.length() / 4.8), 0.9, 1.35);
    }

    lurker.mixer.update(dt);
  }

  lurker.cone.visible = lurker.state !== LURKER_STATE.PURSUE;
  lurker.bbox.setFromObject(lurker.mesh);

  lurker.acceleration.set(0, 0, 0);
}
