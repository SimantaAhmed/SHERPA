// Gameplay tuning in one place. Most values were tuned by playtesting until
// the game felt right; comments note the ones that depend on each other.
// Distances are in world units (one tile is one unit), times in seconds.

export const WORLD = Object.freeze({
  mapSize: 140,
  // Caps a frame's time step so a slow frame can't tunnel things through walls.
  maxFrameTime: 0.033,
  minimapRedrawEveryFrames: 4,
  normalFogDensity: 0.0085,
  blackoutFogDensity: 0.015,
});

export const PLAYER = Object.freeze({
  maxHealth: 100,
  mech: Object.freeze({
    topSpeed: 9.5,
    acceleration: 34,
    drag: 5.8,
    crouchSpeedScale: 0.55,
    crouchAccelerationScale: 0.8,
    jumpHeight: 2.4,
    jumpDuration: 0.55,
  }),
  // Drive mode is far faster than any lurker, so it's the way to escape.
  drive: Object.freeze({
    topSpeed: 58.5,
    acceleration: 46,
    drag: 4.4,
    crouchSpeedScale: 0.42,
    crouchAccelerationScale: 0.4,
    jumpHeight: 1.2,
    jumpDuration: 0.38,
  }),
  water: Object.freeze({
    speedScale: 0.38,
    accelerationScale: 0.45,
    dragScale: 1.5,
  }),
  jumpForwardBoost: 7.5,
  modeSwitchDuration: 0.48,
  modeSwitchHopHeight: 1.35,
  // Brief window after a projectile hit where further shots do no damage.
  projectileInvulnerability: 0.45,
});

export const LURKER = Object.freeze({
  count: 9,
  maxForce: 13,
  // Patrol and return are slower than the mech's 9.5, so you can walk away
  // from a patrol; pursuit is faster, so on foot you can't outrun a chase.
  patrolSpeed: 7.4,
  returnSpeed: 7.8,
  baseTopSpeed: 8.5,
  pursueSpeedBonus: 4.5,
  chaseSpeed: 10.5,
  velocityDamping: 0.96,

  detectionRange: 18,
  detectionAngle: Math.PI * 0.36,
  detectionInterval: 0.09,
  // Spreads the first sight checks so all lurkers don't check on the same frame.
  firstDetectionStagger: 0.1,
  crouchSightScale: 0.6,
  blackoutSightScale: 2,
  // Time a lurker must keep seeing you before alert turns into pursuit.
  alertDelay: 0.95,
  alertSlowdown: 0.88,
  huntDuration: 10,

  meleeRange: 1.8,
  punchRange: 1.25,
  meleeDamagePerSecond: 14,
  terminalDrainPerSecond: 8,

  shootRange: 24,
  firstShotDelayMin: 0.25,
  firstShotDelayMax: 1.1,
  shotCooldownMin: 0.6,
  shotCooldownMax: 1.15,
  projectile: Object.freeze({
    speed: 18,
    lifetime: 2.2,
    damage: 4,
    hitRadius: 1.7,
  }),

  patrol: Object.freeze({
    reachDistance: 1.8,
    seekWeight: 0.7,
    wanderWeight: 0.3,
    wanderDistance: 4,
    wanderRadius: 1.8,
    wanderJitter: 0.35,
  }),
  pursuit: Object.freeze({
    replanInterval: 0.35,
    waypointReachDistance: 1.2,
    // How far ahead the lurker predicts the player's position.
    leadTime: 0.4,
    lookAhead: 0.25,
  }),
  homeReachDistance: 1.5,
  arriveSlowRadius: 10,
  arriveStopRadius: 1.2,
  returnWeight: 0.9,

  swarm: Object.freeze({
    radius: 28,
    duration: 10,
    boostDuration: 2.2,
    cooldown: 0.75,
    // Each other chasing lurker nearby adds this much to the speed boost,
    // and each whole point of boost is worth speedPerBoost extra speed.
    neighbourRadius: 12,
    boostPerNeighbour: 0.28,
    speedPerBoost: 5.2,
  }),
  backup: Object.freeze({
    count: 2,
    radius: 40,
    boostDuration: 2.8,
  }),
  chaseBoostSpeed: 3.6,

  separationDistance: 2.1,
  separationForce: 7.2,
  obstacleAvoidDistance: 3.4,
  obstacleAvoidStrength: 3.2,

  terminal: Object.freeze({
    guardRadius: 8,
    fleeSpeed: 3.6,
    fleeWeight: 0.35,
    defendWeight: 0.42,
    defendWeightWhileChasing: 0.75,
  }),
});

export const HACKING = Object.freeze({
  duration: 2.2,
  range: 3.2,
  minTerminals: 3,
  maxTerminals: 5,
  // Starting a hack calls every lurker within this radius to the terminal.
  alertRadius: 30 * 1.45,
  alertHuntDuration: 6,
  scorePerTerminal: 150,
  scorePerInterruptedHack: 45,
});

export const OBJECTIVES = Object.freeze({
  extractionRadius: 6.0,
  secretHealRadius: 10.5,
  secretHealPerSecond: 0.18,
});

export const CAMERA = Object.freeze({
  followOffset: Object.freeze({ x: 0, y: 3.6, z: 8.2 }),
  lookHeight: 1.2,
  mouseSensitivity: 0.003,
  freeLookDistance: 8.2,
  freeLookPitch: 0.5,
  // How quickly the camera catches up; higher is snappier.
  smoothing: Object.freeze({
    height: 4,
    follow: 7,
    freeLookFollow: 12,
    look: 9,
  }),
});
