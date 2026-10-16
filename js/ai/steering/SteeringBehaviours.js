import * as THREE from 'three';


// This is our static namespace essentially
// for creating static steering behaviours
// that we can use on our NPCs
export class SteeringBehaviours {

  // Seek
  static seek(entity, target) {

    // This way we can pass in either 
    // an entity or a position itself
    let targetPos = target.position || target;

    let desired = targetPos.clone().sub(entity.position);
    desired.setLength(entity.topSpeed);

    let force = desired.sub(entity.velocity);
    return force;

  }

  // Flee
  static flee(entity, target) {
    let targetPos = target.position || target;

    let desired = entity.position.clone().sub(targetPos);
    desired.setLength(entity.topSpeed);

    let force = desired.sub(entity.velocity);

    return force;
  }

  // Pursue
  static pursue(entity, target, lookAhead) {
    // Target will always be a dynamic entity

    let futureLocation = target.position.clone();
    futureLocation.addScaledVector(target.velocity, lookAhead);

    return SteeringBehaviours.seek(entity, futureLocation);
  }

  // Evade
  static evade(entity, target, lookAhead) {
    // Target will always be a dynamic entity

    let futureLocation = target.position.clone();
    futureLocation.addScaledVector(target.velocity, lookAhead);

    return SteeringBehaviours.flee(entity, futureLocation);
  }

  // Arrive
  static arrive(entity, target, radius, stopRadius) {

    let targetPos = target.position || target;

    let desired = targetPos.clone().sub(entity.position);
    let distance = desired.length();

    // If the distance is REALLY close
    // Then stop
    if (distance < stopRadius) {
      return entity.velocity.clone().multiplyScalar(-entity.maxForce);
    }


    let speed = entity.topSpeed;
    if (distance < radius) {
      speed = speed * (distance / radius);
    }

    desired.setLength(speed);

    // Steering = desired velocity - current velocity
    let steer = desired.sub(entity.velocity);
    return steer;

  }

  // Wander
  // Accepts an optional rng argument for reproducibility
  static wander(entity, d = 5, r = 2, a = 0.3, rng = { next: () => Math.random() }) {
    // First iteration, set to random angle between 0 and 2PI
    if (!entity.wanderAngle) {
      entity.wanderAngle = rng.next() * 2 * Math.PI;
    }
    // Predict a future position d away
    let target = entity.velocity.clone().setLength(d);
    target.add(entity.position);
    // Convert polar to cartesian
    let x = r * Math.sin(entity.wanderAngle);
    let z = r * Math.cos(entity.wanderAngle);
    // Add to future prediction
    target.add(new THREE.Vector3(x, 0, z));
    // Update wander angle
    entity.wanderAngle += rng.next() * 2 * a - a;
    // Return seek to target
    return SteeringBehaviours.seek(entity, target);
  }

}