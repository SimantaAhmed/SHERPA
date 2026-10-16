// Entry point for the game. Sets up the world and starts the main loop.
import { World } from './World.js';
import { LCG } from './util/LCG.js';

// Optionally, allow the user to set a seed for reproducibility
const seed = Date.now(); // Replace with user input for custom seeds
const rng = new LCG(seed);

// Create the main game world instance, passing the RNG
const world = new World(rng);

// Main animation loop: updates and renders the world every frame
function loop() {
  requestAnimationFrame(loop);
  world.update(); // Advance game state
  world.render(); // Draw the scene
}

// Initialize the world, then start the game loop
world.init().then(() => loop());