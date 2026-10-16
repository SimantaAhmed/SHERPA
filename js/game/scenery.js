// World dressing: atmosphere, mountains, fog, snow, ruins and props.

import * as THREE from 'three';
import { asset } from '../util/assets.js';
import { applyToonToObject, getToonMaterial } from './materials.js';

export function createAtmosphere(world) {
  world.scene.background = new THREE.Color('#8fa3b5');

  const hemi = new THREE.HemisphereLight(0xd9ecff, 0x41524a, 0.7);
  world.scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xeaf4ff, 0.2);
  world.scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff6e5, 0.9);
  sun.position.set(55, 95, -25);
  world.scene.add(sun);

  createDistantMountains(world);
}

export function createDistantMountains(world) {
  const ringRadius = Math.max(world.map.width, world.map.depth) * 0.72;
  const peakCount = 26;

  for (let i = 0; i < peakCount; i++) {
    const angle = (i / peakCount) * Math.PI * 2;
    const baseRadius = THREE.MathUtils.randFloat(18, 30);
    const height = THREE.MathUtils.randFloat(22, 54);

    const x = Math.cos(angle) * ringRadius + THREE.MathUtils.randFloatSpread(14);
    const z = Math.sin(angle) * ringRadius + THREE.MathUtils.randFloatSpread(14);

    const mountain = new THREE.Mesh(
      createRockyMountainGeometry(world, baseRadius, height),
      getToonMaterial(world, {
        color: '#737a81',
        flatShading: true,
      }),
    );

    mountain.position.set(x, (height / 2) - 2, z);
    mountain.rotation.y = world.rng.next() * Math.PI * 2;
    world.scene.add(mountain);

    const snowCap = new THREE.Mesh(
      createRockyMountainGeometry(world, baseRadius * 0.5, height * 0.3),
      getToonMaterial(world, { color: '#e9eff5', flatShading: true }),
    );

    snowCap.position.set(x, mountain.position.y + (height * 0.31), z);
    snowCap.rotation.y = mountain.rotation.y;
    world.scene.add(snowCap);
  }
}

export function createRockyMountainGeometry(world, baseRadius, height) {
  const geometry = new THREE.CylinderGeometry(
    baseRadius * 0.16,
    baseRadius,
    height,
    10,
    10,
    false,
  );

  const positions = geometry.attributes.position;
  const temp = new THREE.Vector3();

  for (let i = 0; i < positions.count; i++) {
    temp.fromBufferAttribute(positions, i);

    const y01 = (temp.y + height / 2) / height;
    const radial = Math.hypot(temp.x, temp.z);
    const angle = Math.atan2(temp.z, temp.x);

    const ridge = Math.sin(angle * 3.0 + y01 * 7.0) * 0.22;
    const shard = Math.sin(angle * 8.0 + y01 * 15.0) * 0.1;
    const rough = (world.rng.next() - 0.5) * 0.2;

    const profile = THREE.MathUtils.lerp(1.0, 0.35, y01);
    const distortion = (ridge + shard + rough) * profile;
  // ...existing code...

    const targetRadius = radial * (1 + distortion);
    const dirX = radial > 0.0001 ? temp.x / radial : 0;
    const dirZ = radial > 0.0001 ? temp.z / radial : 0;

    temp.x = dirX * targetRadius;
    temp.z = dirZ * targetRadius;

    temp.y += (world.rng.next() - 0.5) * 0.35;

    positions.setXYZ(i, temp.x, temp.y, temp.z);
  }

  geometry.computeVertexNormals();
  return geometry;
}

export function createGroundFog(world) {
  const fog = new THREE.FogExp2(world.normalFogColor.clone(), world.normalFogDensity);
  world.scene.fog = fog;
}

export function updateFog(world, dt) {
  if (!world.scene.fog || !world.player) {
    return;
  }

  const playerTile = world.map.quantize(world.player.position);
  const inBlackout = playerTile ? world.map.isBlackoutTile(playerTile) : false;
  const targetColor = inBlackout ? world.blackoutFogColor : world.normalFogColor;
  const targetDensity = inBlackout ? world.blackoutFogDensity : world.normalFogDensity;
  const blend = 1 - Math.exp(-dt * 3.5);

  world.scene.fog.color.lerp(targetColor, blend);
  world.scene.fog.density = THREE.MathUtils.lerp(world.scene.fog.density, targetDensity, blend);
}

export function getSnowQualityProfile(world) {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reduce snow intensity by lowering count and size
  if (prefersReduced || cores <= 4 || memory <= 4) {
    return { count: 180, radius: 28, height: 22, size: 0.12 };
  }

  if (cores <= 8 || memory <= 8) {
    return { count: 320, radius: 32, height: 26, size: 0.13 };
  }

  return { count: 480, radius: 36, height: 28, size: 0.14 };
}

export function createSnowSystem(world) {
  const profile = getSnowQualityProfile(world);
  const positions = new Float32Array(profile.count * 3);
  const fallSpeeds = new Float32Array(profile.count);
  const driftSpeeds = new Float32Array(profile.count);

  const center = world.player ? world.player.position : new THREE.Vector3();

  for (let i = 0; i < profile.count; i++) {
    const i3 = i * 3;
    positions[i3] = center.x + THREE.MathUtils.randFloatSpread(profile.radius * 2);
    positions[i3 + 1] = center.y + THREE.MathUtils.randFloat(2, profile.height);
    positions[i3 + 2] = center.z + THREE.MathUtils.randFloatSpread(profile.radius * 2);
    fallSpeeds[i] = THREE.MathUtils.randFloat(2.8, 4.6);
    driftSpeeds[i] = THREE.MathUtils.randFloat(-0.85, 0.85);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: '#f6fbff',
    size: profile.size,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  world.scene.add(points);

  world.snow = {
    points,
    geometry,
    positions,
    fallSpeeds,
    driftSpeeds,
    count: profile.count,
    radius: profile.radius,
    height: profile.height,
    windTime: 0,
  };
}

export function updateSnow(world, dt) {
  // Throttle snow updates for performance
  if (!world.snow || !world.player) {
    return;
  }
  world._snowFrame = (world._snowFrame || 0) + 1;
  if (world._snowFrame % 3 !== 0) return; // Only update every 3rd frame

  const snow = world.snow;
  const center = world.player.position;
  const radius = snow.radius;
  const groundY = center.y - 1.2;

  snow.windTime += dt * 3; // compensate for less frequent updates
  const wind = Math.sin(snow.windTime * 0.7) * 0.32;

  for (let i = 0; i < snow.count; i++) {
    const i3 = i * 3;

    snow.positions[i3 + 1] -= snow.fallSpeeds[i] * dt * 3;
    snow.positions[i3] += (snow.driftSpeeds[i] + wind) * dt * 3;
    snow.positions[i3 + 2] += wind * 0.42 * dt * 3;

    let dx = snow.positions[i3] - center.x;
    let dz = snow.positions[i3 + 2] - center.z;

    if (dx > radius) snow.positions[i3] -= radius * 2;
    else if (dx < -radius) snow.positions[i3] += radius * 2;

    if (dz > radius) snow.positions[i3 + 2] -= radius * 2;
    else if (dz < -radius) snow.positions[i3 + 2] += radius * 2;

    if (snow.positions[i3 + 1] < groundY) {
      snow.positions[i3] = center.x + THREE.MathUtils.randFloatSpread(radius * 2);
      snow.positions[i3 + 1] = center.y + snow.height + THREE.MathUtils.randFloat(0, 4.5);
      snow.positions[i3 + 2] = center.z + THREE.MathUtils.randFloatSpread(radius * 2);
    }
  }

  snow.geometry.attributes.position.needsUpdate = true;
}

export async function spawnRuinStructures(world) {
  const ruinCount = 24;
  const decorativeModels = await loadDecorativeModels(world);
  const modelKeys = Object.keys(decorativeModels);

  for (let i = 0; i < ruinCount; i++) {
    const tile = world.map.getRandomWalkableTile((candidate) => !candidate.blackout);
    if (!tile) {
      continue;
    }

    const center = world.map.localize(tile);
    const modelKey = modelKeys[Math.floor(world.rng.next() * modelKeys.length)];
    const modelScene = decorativeModels[modelKey];
    const scale = THREE.MathUtils.randFloat(0.7, 1.5);

    let ruin;
    if (modelScene) {
      ruin = modelScene.clone(true);
      applyToonToObject(world, ruin);
      ruin.scale.setScalar(scale);
      ruin.position.set(center.x, center.y, center.z);
      ruin.rotation.y = world.rng.next() * Math.PI * 2;
    } else {
      const fallbackIdx = ['Rock', 'Tree', 'SpiralTree'].indexOf(modelKey);
      const fallbackGeo = [
        () => new THREE.BoxGeometry(2.2, 3.0, 2.2),
        () => new THREE.CylinderGeometry(0.6, 0.8, 5.0, 8),
        () => new THREE.ConeGeometry(0.8, 5.5, 6),
      ];
      const geoCreator = fallbackGeo[fallbackIdx % fallbackGeo.length];
      ruin = new THREE.Mesh(
        geoCreator(),
        getToonMaterial(world, { color: '#5a5653' }),
      );
      ruin.scale.setScalar(scale);
      const h = ruin.geometry.boundingBox?.max.y || 3.0;
      ruin.geometry.computeBoundingBox();
      ruin.position.set(center.x, center.y + (h / 2) * scale, center.z);
    }

    world.scene.add(ruin);

    const bbox = new THREE.Box3().setFromObject(ruin);
    world.ruins.push({ mesh: ruin, bbox });

    world.map.markBlockedArea(center, 2);
  }

  world.map.rebuildWalkables();
}

export async function loadDecorativeModels(world) {
  const models = {};
  const modelFiles = [
    { key: 'Rock', file: 'Rocks.glb' },
    { key: 'Tree', file: 'Dead Tree.glb' },
    { key: 'SpiralTree', file: 'Tree Spiral.glb' },
  ];
  const fallbackGeo = [
    () => new THREE.BoxGeometry(2.2, 3.0, 2.2),
    () => new THREE.CylinderGeometry(0.6, 0.8, 5.0, 8),
    () => new THREE.ConeGeometry(0.8, 5.5, 6),
  ];

  for (let i = 0; i < modelFiles.length; i++) {
    const { key, file } = modelFiles[i];
    try {
      const gltf = await world.loader.loadAsync(asset(file));
      models[key] = gltf.scene;
    } catch (error) {
      console.warn(`Failed to load ${file}, using fallback:`, error);
      models[key] = null;
    }
  }

  return models;
}
