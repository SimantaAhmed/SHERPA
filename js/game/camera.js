// Camera follow and free-look orbit.

import * as THREE from 'three';
import { CAMERA } from './tuning.js';

export function updateCamera(world, dt) {
  const followOffset = new THREE.Vector3(CAMERA.followOffset.x, CAMERA.followOffset.y, CAMERA.followOffset.z);
  const desiredTarget = world.player.position.clone().add(new THREE.Vector3(0, CAMERA.lookHeight, 0));

  // Free camera mode when left mouse button is held
  if (world.inputHandler.mouse.leftDown) {
    // Update camera angles based on mouse movement
    const sensitivity = CAMERA.mouseSensitivity;
    world.freeCameraYaw -= world.inputHandler.mouse.deltaX * sensitivity;
    world.freeCameraPitch -= world.inputHandler.mouse.deltaY * sensitivity;

    // Clamp pitch to prevent flipping
    world.freeCameraPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, world.freeCameraPitch));

    // Calculate camera position based on yaw/pitch around player
    const camHeight = world.player.position.y + CAMERA.followOffset.y;
    const horizontalDist = world.freeCameraDistance * Math.cos(world.freeCameraPitch);
    const verticalDist = world.freeCameraDistance * Math.sin(world.freeCameraPitch);

    const desiredPosition = new THREE.Vector3(
      world.player.position.x + horizontalDist * Math.sin(world.freeCameraYaw),
      camHeight + verticalDist,
      world.player.position.z + horizontalDist * Math.cos(world.freeCameraYaw)
    );

    // Smooth camera position
    if (!world.cameraFollowPos) {
      world.cameraFollowPos = desiredPosition.clone();
      world.cameraLookPos = desiredTarget.clone();
      world.cameraHeightSmooth = desiredPosition.y;
    }

    world.cameraHeightSmooth = THREE.MathUtils.lerp(
      world.cameraHeightSmooth,
      desiredPosition.y,
      1 - Math.exp(-dt * CAMERA.smoothing.height),
    );

    world.cameraFollowPos.lerp(desiredPosition, 1 - Math.exp(-dt * CAMERA.smoothing.freeLookFollow));
    world.cameraFollowPos.y = world.cameraHeightSmooth;

    world.cameraLookPos.lerp(desiredTarget, 1 - Math.exp(-dt * CAMERA.smoothing.look));
  } else {
    // Normal follow camera mode
    const desiredPosition = world.player.position.clone().add(followOffset);

    if (!world.cameraFollowPos) {
      world.cameraFollowPos = desiredPosition.clone();
      world.cameraLookPos = desiredTarget.clone();
      world.cameraHeightSmooth = desiredPosition.y;
    }

    // Reset camera angles when exiting free camera
    const camDir = desiredPosition.clone().sub(world.player.position);
    world.freeCameraYaw = Math.atan2(camDir.x, camDir.z);
    world.freeCameraPitch = Math.atan2(camDir.y, new THREE.Vector3(camDir.x, 0, camDir.z).length());

    // Height changes from tile quantization can jitter; smooth Y separately.
    world.cameraHeightSmooth = THREE.MathUtils.lerp(
      world.cameraHeightSmooth,
      desiredPosition.y,
      1 - Math.exp(-dt * CAMERA.smoothing.height),
    );

    world.cameraFollowPos.lerp(desiredPosition, 1 - Math.exp(-dt * CAMERA.smoothing.follow));
    world.cameraFollowPos.y = world.cameraHeightSmooth;

    world.cameraLookPos.lerp(desiredTarget, 1 - Math.exp(-dt * CAMERA.smoothing.look));
  }

  world.camera.position.copy(world.cameraFollowPos);
  world.camera.lookAt(world.cameraLookPos);
}
