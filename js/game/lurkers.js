// Lurker spawning, the patrol/alert/pursue/return states, steering and projectiles.

import * as THREE from 'three';
import { asset } from '../util/assets.js';
import { applyToonToObject, getToonMaterial } from './materials.js';
import { triggerPlayerHitReaction } from './player.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { JPS } from '../ai/pathfinding/JPS.js';
import { SteeringBehaviours } from '../ai/steering/SteeringBehaviours.js';
import { PLAYER_STATE, LURKER_STATE } from './states.js';
import { HACKING, LURKER, PLAYER } from './tuning.js';

export async function loadLurkerTemplate(world) {
  if (world.lurkerTemplate !== undefined) {
    return world.lurkerTemplate;
  }

  try {
    world.lurkerTemplate = await world.loader.loadAsync(asset('astronaut.glb'));
  } catch (error) {
    world.lurkerTemplate = null;
  }

  return world.lurkerTemplate;
}

export async function spawnLurkers(world) {
  const astronautTemplate = await loadLurkerTemplate(world);

  for (let i = 0; i < LURKER.count; i++) {
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

export function spawnSingleLurkerFromTile(world, tile, astronautTemplate) {
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
    topSpeed: LURKER.baseTopSpeed,
    maxForce: LURKER.maxForce,
    state: LURKER_STATE.PATROL,
    runAction,
    shootAction,
    punchAction,
    isAttacking: false,
    isPunching: false,
    chaseBoostTimer: 0,
    shootCooldown: world.rng.nextFloat(LURKER.firstShotDelayMin, LURKER.firstShotDelayMax),
    alertTimer: 0,
    huntTimer: 0,
    patrolTarget: world.map.getRandomWalkableTile(),
    detectionRange: LURKER.detectionRange,
    detectionAngle: LURKER.detectionAngle,
    path: [],
    pathIndex: 0,
    replanTimer: 0,
    detectionCheckTimer: world.rng.nextFloat(0, LURKER.firstDetectionStagger),
    alertSprite,
    cone,
    homePosition: pos.clone(),
    mixer,
    walkAction,
    bbox: new THREE.Box3().setFromObject(mesh),
  });
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

export function callLurkersToSignal(world, signalPos, radius) {
  for (const lurker of world.lurkers) {
    const d = lurker.position.distanceTo(signalPos);
    if (d < radius) {
      lurker.state = LURKER_STATE.PURSUE;
      lurker.huntTimer = Math.max(lurker.huntTimer, HACKING.alertHuntDuration);
    }
  }
}

export function updateLurkers(world, dt) {
  let pursuitTriggeredThisFrame = false;
  let pursuitTriggerPosition = null;

  for (const lurker of world.lurkers) {
    const toPlayer = world.player.position.clone().sub(lurker.position);
    const distance = toPlayer.length();
    const playerTile = world.map.quantize(world.player.position);

    const inBlackout = playerTile ? world.map.isBlackoutTile(playerTile) : false;
    const crouchScale = world.player.isCrouch ? LURKER.crouchSightScale : 1;
    const detectionRange = lurker.detectionRange * (inBlackout ? LURKER.blackoutSightScale : 1) * crouchScale;
    lurker.detectionCheckTimer = Math.max(0, (lurker.detectionCheckTimer || 0) - dt);

    if (lurker.state === LURKER_STATE.PURSUE || lurker.detectionCheckTimer <= 0) {
      lurker.detectionCheckTimer = LURKER.detectionInterval;

      // Use the way the mesh faces so detection matches the visible cone,
      // even after the lurker stops moving.
      const forward = new THREE.Vector3();
      lurker.mesh.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();

      const normalizedToPlayer = toPlayer.lengthSq() > 0 ? toPlayer.clone().normalize() : new THREE.Vector3(0, 0, 1);
      const angle = forward.angleTo(normalizedToPlayer);
      const inCone = angle <= lurker.detectionAngle;
      const hasSightLine = world.hasLineOfSight(lurker.position, world.player.position);

      const canSee = inCone && distance <= detectionRange && hasSightLine;
      lurker.canSeePlayer = canSee;
      lurker.hasSightLine = hasSightLine;
    }

  }

  for (const lurker of world.lurkers) {
    const toPlayer = world.player.position.clone().sub(lurker.position);
    const distance = toPlayer.length();
    lurker.isAttacking = distance <= LURKER.meleeRange;
    lurker.isPunching = distance <= LURKER.punchRange;
    const playerTile = world.map.quantize(world.player.position);
    const lurkerTile = world.map.quantize(lurker.position);
    const canSee = !!lurker.canSeePlayer;

    switch (lurker.state) {
      case LURKER_STATE.PATROL:
        if (canSee) {
          lurker.state = LURKER_STATE.ALERT;
          lurker.alertTimer = LURKER.alertDelay;
          lurker.alertSprite.visible = true;
        } else {
          updatePatrolMovement(world, lurker, dt);
          lurker.alertSprite.visible = false;
        }
        break;

      case LURKER_STATE.ALERT:
        lurker.alertSprite.visible = true;
        lurker.alertTimer -= dt;
        lurker.velocity.multiplyScalar(LURKER.alertSlowdown);

        if (!canSee) {
          lurker.state = LURKER_STATE.PATROL;
          lurker.patrolTarget = world.map.getRandomWalkableTile();
          lurker.alertSprite.visible = false;
        } else if (lurker.alertTimer <= 0) {
          lurker.state = LURKER_STATE.PURSUE;
          lurker.huntTimer = Math.max(lurker.huntTimer, LURKER.huntDuration);
          lurker.alertSprite.visible = false;
          pursuitTriggeredThisFrame = true;
          pursuitTriggerPosition = pursuitTriggerPosition || lurker.position.clone();
        }
        break;

      case LURKER_STATE.PURSUE:
        lurker.huntTimer -= dt;
        updatePursueMovement(world, lurker, dt, lurkerTile, playerTile);

        lurker.shootCooldown = Math.max(0, (lurker.shootCooldown || 0) - dt);
        if (canSee && distance <= LURKER.shootRange && !lurker.isPunching && lurker.shootCooldown <= 0) {
          fireLurkerProjectile(world, lurker);
          lurker.shootCooldown = world.rng.nextFloat(LURKER.shotCooldownMin, LURKER.shotCooldownMax);
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
        updateReturnMovement(world, lurker, dt);
        break;
    }

    applyLurkerSeparation(world, lurker, dt);
    applyLurkerObstacleAvoidance(world, lurker);
    integrateLurker(world, lurker, dt);

    if (lurker.isAttacking) {
      world.player.health = Math.max(0, world.player.health - (LURKER.meleeDamagePerSecond * dt));
      triggerPlayerHitReaction(world, 0.12);

      if (world.player.health <= 0) {
        world.endScreenType = 'over';
        world.gameOver = true;
      }

      if (world.player.hackTarget) {
        world.player.hackTarget.integrity = Math.max(0, world.player.hackTarget.integrity - (LURKER.terminalDrainPerSecond * dt));

        if (world.player.state === PLAYER_STATE.HACKING) {
          world.score += Math.floor(world.player.hackTarget.hackedProgress * HACKING.scorePerInterruptedHack);
          world.player.hackTarget = null;
          world.player.state = PLAYER_STATE.MECH;
        }
      }
    }
  }

  if (pursuitTriggeredThisFrame && world.swarmCooldown <= 0) {
    activateSwarmPursuit(world, pursuitTriggerPosition || world.player.position, LURKER.swarm.duration);
    callNearbyBackupLurkers(world, pursuitTriggerPosition || world.player.position, LURKER.backup.count);
    world.swarmCooldown = LURKER.swarm.cooldown;
  }
}

export function updatePatrolMovement(world, lurker, dt) {
  if (!lurker.patrolTarget || !world.map.isTileWalkable(lurker.patrolTarget)) {
    lurker.patrolTarget = world.map.getRandomWalkableTile();
  }

  const targetPos = lurker.patrolTarget ? world.map.localize(lurker.patrolTarget) : lurker.homePosition;

  if (lurker.position.distanceTo(targetPos) < LURKER.patrol.reachDistance) {
    lurker.patrolTarget = world.map.getRandomWalkableTile();
    return;
  }

  const seekForce = SteeringBehaviours.seek({
    position: lurker.position,
    velocity: lurker.velocity,
    topSpeed: LURKER.patrolSpeed,
  }, targetPos);

  const wanderEntity = {
    position: lurker.position,
    velocity: lurker.velocity,
    topSpeed: LURKER.patrolSpeed,
    wanderAngle: lurker.wanderAngle,
  };
  const wanderForce = SteeringBehaviours.wander(
    wanderEntity,
    LURKER.patrol.wanderDistance,
    LURKER.patrol.wanderRadius,
    LURKER.patrol.wanderJitter,
    world.rng,
  );
  lurker.wanderAngle = wanderEntity.wanderAngle;

  lurker.acceleration.add(seekForce.multiplyScalar(LURKER.patrol.seekWeight));
  lurker.acceleration.add(wanderForce.multiplyScalar(LURKER.patrol.wanderWeight));
  applyTerminalInfluence(world, lurker);
}

export function updatePursueMovement(world, lurker, dt, lurkerTile, playerTile) {
  if (!lurkerTile || !playerTile) {
    return;
  }

  lurker.replanTimer -= dt;

  if (lurker.replanTimer <= 0) {
    lurker.replanTimer = LURKER.pursuit.replanInterval;
    lurker.path = world.jps.findPath(lurkerTile, playerTile);
    lurker.pathIndex = 0;
  }

  let pursueTarget = world.player.position.clone().addScaledVector(world.player.velocity, LURKER.pursuit.leadTime);

  if (lurker.path && lurker.path.length > 1) {
    lurker.pathIndex = Math.min(lurker.pathIndex, lurker.path.length - 1);
    const nextTile = lurker.path[lurker.pathIndex];
    const nextPos = world.map.localize(nextTile);

    if (lurker.position.distanceTo(nextPos) < LURKER.pursuit.waypointReachDistance && lurker.pathIndex < lurker.path.length - 1) {
      lurker.pathIndex += 1;
    }

    pursueTarget = world.map.localize(lurker.path[lurker.pathIndex]);
  }

  const pursueForce = SteeringBehaviours.pursue({
    position: lurker.position,
    velocity: lurker.velocity,
    topSpeed: LURKER.chaseSpeed,
  }, {
    position: pursueTarget,
    velocity: world.player.velocity,
  }, LURKER.pursuit.lookAhead);

  lurker.acceleration.add(pursueForce);
  applyTerminalInfluence(world, lurker, true);
}

export function calculateSwarmSpeedBoost(world, lurker) {
  let swarmCount = 0;

  for (const other of world.lurkers) {
    if (other === lurker) continue;
    if (other.state !== LURKER_STATE.PURSUE) continue;

    const distance = lurker.position.distanceTo(other.position);
    if (distance > 0 && distance < LURKER.swarm.neighbourRadius) {
      swarmCount += 1;
    }
  }

  lurker.swarmCount = swarmCount;
  return 1 + (swarmCount * LURKER.swarm.boostPerNeighbour);
}

export function updateReturnMovement(world, lurker, dt) {
  const target = lurker.homePosition;

  if (lurker.position.distanceTo(target) < LURKER.homeReachDistance) {
    lurker.state = LURKER_STATE.PATROL;
    lurker.patrolTarget = world.map.getRandomWalkableTile();
    return;
  }

  const steer = SteeringBehaviours.arrive({
    position: lurker.position,
    velocity: lurker.velocity,
    topSpeed: LURKER.returnSpeed,
    maxForce: lurker.maxForce,
  }, target, LURKER.arriveSlowRadius, LURKER.arriveStopRadius);

  lurker.acceleration.add(steer.multiplyScalar(LURKER.returnWeight));
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
        topSpeed: prioritizeHackTerminal ? LURKER.chaseSpeed : LURKER.returnSpeed,
      }, world.player.hackTarget.position);
      lurker.acceleration.add(seekForce.multiplyScalar(
        prioritizeHackTerminal ? LURKER.terminal.defendWeightWhileChasing : LURKER.terminal.defendWeight,
      ));
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

  if (!closestTerminal || closestDistance > LURKER.terminal.guardRadius) {
    return;
  }

  const fleeForce = SteeringBehaviours.flee({
    position: lurker.position,
    velocity: lurker.velocity,
    topSpeed: LURKER.terminal.fleeSpeed,
  }, closestTerminal.position);

  lurker.acceleration.add(fleeForce.multiplyScalar(LURKER.terminal.fleeWeight));
}

export function activateSwarmPursuit(world, position, duration) {
  for (const unit of world.lurkers) {
    if (unit.position.distanceTo(position) <= LURKER.swarm.radius) {
      unit.state = LURKER_STATE.PURSUE;
      unit.huntTimer = Math.max(unit.huntTimer, duration);
      unit.chaseBoostTimer = Math.max(unit.chaseBoostTimer || 0, LURKER.swarm.boostDuration);
    }
  }
}

export function callNearbyBackupLurkers(world, position, count = LURKER.backup.count) {
  const nearby = world.lurkers
    .map((lurker) => ({ lurker, d: lurker.position.distanceTo(position) }))
    .filter(({ lurker, d }) => d > 0 && d <= LURKER.backup.radius && lurker.state !== LURKER_STATE.PURSUE)
    .sort((a, b) => a.d - b.d)
    .slice(0, count);

  for (const { lurker } of nearby) {
    lurker.state = LURKER_STATE.PURSUE;
    lurker.huntTimer = Math.max(lurker.huntTimer, LURKER.huntDuration);
    lurker.chaseBoostTimer = Math.max(lurker.chaseBoostTimer || 0, LURKER.backup.boostDuration);
    lurker.alertSprite.visible = true;
  }
}

export function applyLurkerSeparation(world, lurker, dt) {
  const desired = LURKER.separationDistance;
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
    separate.setLength(LURKER.separationForce);
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
    if (d > 0 && d < LURKER.obstacleAvoidDistance) {
      const push = (LURKER.obstacleAvoidDistance - d) * LURKER.obstacleAvoidStrength;
      const away = lurker.position.clone().sub(closest).normalize().multiplyScalar(push);
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
    velocity: dir.multiplyScalar(LURKER.projectile.speed),
    life: LURKER.projectile.lifetime,
    damage: LURKER.projectile.damage,
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
    const hitPlayerByRadius = projectile.mesh.position.distanceTo(playerCore) <= LURKER.projectile.hitRadius;
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
      world.player.projectileInvulnTimer = PLAYER.projectileInvulnerability;
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
  lurker.velocity.multiplyScalar(LURKER.velocityDamping);

  lurker.chaseBoostTimer = Math.max(0, (lurker.chaseBoostTimer || 0) - dt);

  let speedCap = lurker.topSpeed + (lurker.state === LURKER_STATE.PURSUE ? LURKER.pursueSpeedBonus : 0);
  if (lurker.state === LURKER_STATE.PURSUE) {
    const swarmBoost = calculateSwarmSpeedBoost(world, lurker);
    speedCap += (swarmBoost - 1) * LURKER.swarm.speedPerBoost;
  }

  if ((lurker.chaseBoostTimer || 0) > 0) {
    speedCap += LURKER.chaseBoostSpeed;
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
