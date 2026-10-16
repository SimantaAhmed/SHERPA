# SHERPA - by Simanta Ahmed

**Play it in the browser: https://simantaahmed.github.io/SHERPA/**

Made for COMP 4303 (AI for Games) at Memorial University, Winter 2026. The AI
is built on the in-class source pack, and [Credits](#credits) says what came
from where.

A third-person stealth infiltration game built with Three.js. The term sherpa refers to a member of a Himalayan people living on the borders of Nepal and Tibet, renowned for their skill in mountaineering. The game takes place in one of the mountains of Nepal where you are infiltrating a ruin base full of Lurkers, aliens mining the mountain while damaging the landscape with a tar-like substance where man-made machines malfunction.

The player pilots a transformable mech called FOX across procedurally generated terrain. The objective each run is to locate and hack all corrupted data terminals, then reach the extraction point. The reason for doing this is to prevent the lurkers from digging out the mountains. The lurkers patrol the map and will pursue on detection. Health does not regenerate, and the full layout changes every run.

---

## How to Run

Requirements: Node.js 18 or later.

```bash
npm install
```

```bash
npm run dev
```

Open the URL shown in your terminal (typically `http://localhost:5173`).
`npm run build` produces a static build in `dist/`, which is what the link
above serves.

---

## Controls

| Key | Action |
|-----|--------|
| `W A S D` | Move |
| `T` | Toggle Mech Mode / Drive Mode |
| `Shift` | Crouch (Mech) or cut engine (Drive), reduces detection radius |
| `E` (hold) | Hack terminal while in range |
| `Space` | Jump (Mech Mode only) |
| `Hold Left Mouse` | Free-look camera, drag to orbit around player |
| `R` | Restart (on end screen) |
| `Y` | Debug shortcut, instantly unlocks extraction point (saves time when testing) |

---

## Objective

1. Find all **data terminals** (server racks) on the map, 3 to 5 per run.
2. Stand within range and hold `E` for **2.2 seconds** to complete a hack. Moving or releasing E cancels it.
3. Once all terminals are hacked, a **blue extraction ring** appears at the map centre.
4. Reach the extraction ring to finish the run.

**Optional:** Find the "hidden" figure somewhere on the map for healing. Its location is never marked on the minimap.

---

## Topics Implemented

### 1. Complex Movement: Collision Avoidance
**How to see it:** Get detected and let multiple lurkers chase you at once. They spread apart during pursuit rather than stacking on each other.

Each lurker computes a separation steering force against every other lurker within a minimum desired distance and adds it to its acceleration (`applyLurkerSeparation`). A second pass (`applyLurkerObstacleAvoidance`) pushes lurkers away from ruin bounding boxes to prevent them from clipping into obstacles.

### 2. Decision Making: State Machine
**How to see it:** Walk into a lurker's orange detection cone. A `!` sprite appears above its head. Break line-of-sight within about one second to cancel detection. If you don't, it escalates to pursuit and radios nearby units.

Two parallel state machines:
- **Player:** `MECH` ↔ `DRIVE` (press T), `HACKING` (hold E near terminal)
- **Lurkers:** `PATROL` → `ALERT` → `PURSUE` → `RETURN`

Implemented as a `switch` block in `updateLurkers` (`js/game/lurkers.js`).

### 3. Pathfinding: Jump Point Search
**How to see it:** Enter pursuit range near a ruin. Lurkers navigate around it to reach you rather than walking into the wall.

`TileMap.js` discretizes the heightmap into a 2D grid with nodes blocked for steep slopes and ruin footprints. `JPS.js` finds paths by pruning nodes that aren't directional jump points, using Manhattan distance as the heuristic. Each lurker replans every 0.35 seconds. Used in `updatePursueMovement`.

### 4. Procedural Content Generation: Perlin Noise
**How to see it:** Press `R` to restart several times after dying. Terrain, ruins, blackout zones, terminal positions, and the secret character's spawn all land differently each run.

`Perlin.js` implements gradient noise based on the in-class source code. Two key changes were made from the source: (1) the constructor now accepts an `rng` parameter so the LCG drives the gradient grid instead of `Math.random()`, enabling seed-reproducible terrain; (2) the `noise()` method uses `wrapValue`/`wrapIndex` helpers to handle negative coordinate wrapping correctly, which was necessary to support the larger map size without tiling artefacts. `TileMap.js` samples it to assign height per tile. A second independent noise pass marks **blackout zones**, where the minimap goes dark and lurker detection range doubles, shown as a fog overlay. Terminal candidates are filtered to open, non-blackout tiles.

### 5. Simple Movement: Pursue
**How to see it:** Once a lurker enters pursuit, run perpendicular to it. It leads its steering toward your predicted position rather than trailing you directly.

`SteeringBehaviours.pursue` projects the player's current velocity by a short time horizon to get a predicted future position, then seeks that point. Combined with JPS for routing and separation for spacing, lurkers can cut off escape angles. Used in `updatePursueMovement`.

---

## Pseudorandom Number Generation (PRNG): Linear Congruential Generator

All procedural generation, AI randomness, and world logic use a custom **Linear Congruential Generator (LCG)** implemented in `js/util/LCG.js` instead of `Math.random()`. The LCG is seeded at the start of each run using `Date.now()`.

**Algorithm** (Numerical Recipes constants):
```
s_(n+1) = (1664525 * s_n + 1013904223) % 2^31
```

The LCG is the single source of randomness for:
- Terrain generation (passed into `Perlin.js`, gradients built from `rng.next()` instead of `Math.random()`)
- Blackout zone generation (second independent Perlin pass, same rng instance)
- Entity spawning: ruins, terminals, lurkers, the secret character
- AI wandering angle updates (`SteeringBehaviours.wander`)
- Mountain vertex distortion (cosmetic jitter in `js/game/scenery.js`)

This fulfills the course requirement for implementing a pseudorandom number generator beyond the built-in JavaScript random function.

**How to see it:** Change `const seed = Date.now()` in `main.js` to a fixed number (e.g. `12345`). Every restart will generate the exact same world, terminal layout, and AI patrol paths.

---

## Credits

### 3D models

All models are used under their own licences, which are listed below. They are
not covered by this repository's code licence.

| Model | Used for | Author | Licence |
|---|---|---|---|
| [Mech](https://poly.pizza/m/D5wW2jDO42) | Player (FOX) | Quaternius | CC0 1.0 |
| [Spaceship](https://poly.pizza/m/uCeLfsdmNP) | Drive mode | Quaternius | CC0 1.0 |
| [Ship](https://poly.pizza/m/mEQj2wZ3GC) | Drive mode | Quaternius | CC0 1.0 |
| [Astronaut](https://poly.pizza/m/OgeSH89Nmx) | Lurkers | Quaternius | CC0 1.0 |
| [Tree Spiral](https://poly.pizza/m/poFJzEWCk8) | Scenery | Quaternius | CC0 1.0 |
| [Rock](https://poly.pizza/m/IFU6cm2Xow), [Rock 2](https://poly.pizza/m/e1rgb5i2kF) | Scenery | Quaternius | CC0 1.0 |
| [Server rack](https://poly.pizza/m/6ijQclm8jxw) | Data terminals | Jeremy Eyring | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| [Sherma](https://sketchfab.com/3d-models/sherma-hollow-knight-silksong-e1541d1c0b134b85a7da3b1bfa6cf0da) | Secret character | Lunorvyn | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

The Sherma model is fan art of a character from *Hollow Knight: Silksong*,
which belongs to Team Cherry. This project is non-commercial and not affiliated
with or endorsed by them.

### Code

Three.js only does the rendering. Nothing else is a library: the steering,
pathfinding, state machines and noise are course code or mine.

From the in-class pack: steering behaviours, pathfinding (JPS, Pathfinder,
MinHeap), the state machine base, the tile map and the Perlin implementation.
Published with the instructor's permission.

Mine: the game on top of it. The player and lurker state machines, detection
and pursuit, hacking and extraction, the minimap and fog, blackout zones,
water tiles, the animations, the seeded LCG, and everything that makes a run
reproducible from one seed. The file list further down says what I changed in
the pack files.

## Code Layout

I split the game out of `World.js` after the course ended; it had grown to
about 2,600 lines in one file.

```
js/World.js         game state, init/update/render, wiring
js/game/player.js   mech and drive modes, movement, jumping, animation
js/game/lurkers.js  spawning, the patrol/alert/pursue/return machine, steering
js/game/objectives.js  terminals, extraction point, secret character
js/game/scenery.js  atmosphere, mountains, fog, snow, ruins
js/game/hud.js      HUD and minimap
js/game/camera.js   follow and free-look camera
js/ai, js/maps, js/pcg   pathfinding, tiles and noise (see Credits)
```

---

## Creative Additions

### Water Tiles: Walkable with Speed Penalty
Water tiles are walkable, but slow the player down significantly. When the player is on a water tile, movement speed, acceleration, and drag are all penalised. Water tiles are assigned a higher movement cost in `Tile.js` and are considered walkable in both `Tile.isWalkable` and `TileMap.isTileWalkable`. This adds tactical depth. Crossing water to escape a lurker is possible but risky.

### Jump-Forward Mechanic
If the player is moving and presses jump (`Space`), they leap forward in the direction they are facing. This works in both Mech and Drive modes (Drive mode uses a lower jump height). Useful for crossing water quickly or breaking a lurker's pursuit angle.

### Drive Mode Using Two Models
Added a ship underneath the mech in Driver mode. I hope this was unique in itself.

---

## Changes from Starter / In-Class Source Code

(Referenced from [Credits](#credits).)

### `pcg/Perlin.js`
Adapted from `perlin-source-mar19`. Two changes from the original:
1. Constructor accepts an `rng` parameter (`{ next() }` interface), so the LCG is passed in, replacing all `Math.random()` calls so terrain is seed-reproducible.
2. `wrapValue` / `wrapIndex` helpers replace the raw modulo in `noise()` to correctly handle negative coordinates that appear at large map sizes.

### `util/LCG.js` (new file)
Custom LCG PRNG. Not present in any starter code zip. Written from scratch following the algorithm from the pseudorandomness lecture slides (linear congruential generator, Numerical Recipes constants).

### `maps/TileMap.js`
Extended from starter code to: pass `this.rng` into both `Perlin` instances; add water tile type, blackout zone generation, and walkability cost weighting.

### `maps/Tile.js`
Added `Water` tile type and updated `isWalkable` and movement cost logic.

### `World.js`
Major additions: full game loop (player state machine, lurker state machine, hacking system, extraction logic, minimap, health, fog overlay). The two mountain-geometry `Math.random()` calls from the prototype were updated to `this.rng.next()` to keep all randomness seed-consistent.

### No modifications to core AI files
`JPS.js`, `SteeringBehaviours.js`, `StateMachine.js`, and `State.js` were used as provided from source, with `SteeringBehaviours.wander` already accepting an optional `rng` parameter which is now supplied.

---

## Known Bugs

- After hacking a terminal while in Drive Mode, the player returns to Mech Mode while the ship model remains underneath. Intentionally kept because it looks cool and hints to press T to dash away.
- Random spawning can occasionally place the player inside geometry. Refreshing the browser resolves this; it is very rare.
- The secret character is Sherma from *Hollow Knight: Silksong*. The text displayed is lyrics from his in-game song. Audio was omitted to keep gameplay smooth.
- Camera orbit can occasionally drift; it is centred on the player rather than cursor-driven.
- Enemy detection can glitch at close range. Reaction time was intentionally increased to prevent lurkers from immediately locking onto the player.
