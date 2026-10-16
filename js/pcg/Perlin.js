export class Perlin {
  /**
   * @param {number} size - Grid size
   * @param {Object} rng - RNG object with .next() method (returns float in [0,1))
   */
  constructor(size, rng = { next: () => Math.random() }) {
    this.size = size;
    this.rng = rng;
    this.gradients = [];
    this.createGrid();
  }

  // Create our Perlin grid
  createGrid() {
    for (let i = 0; i < this.size; i++) {
      let row = [];
      for (let j = 0; j < this.size; j++) {
        let angle = this.rng.next() * Math.PI * 2;
        let vector = { x: Math.cos(angle), y: Math.sin(angle) };
        row.push(vector);
      }
      this.gradients.push(row);
    }
  }

  // Get our noise for x, y value
  noise(x, y, frequency) {
    x = this.wrapValue(x * frequency);
    y = this.wrapValue(y * frequency);

    let x0 = Math.floor(x);
    let y0 = Math.floor(y);
    let x1 = this.wrapIndex(x0 + 1);
    let y1 = this.wrapIndex(y0 + 1);

    x0 = this.wrapIndex(x0);
    y0 = this.wrapIndex(y0);

    let dx = x - x0;
    let dy = y - y0;

    // Get gradients
    let g00 = this.gradients[x0][y0];
    let g10 = this.gradients[x1][y0];
    let g01 = this.gradients[x0][y1];
    let g11 = this.gradients[x1][y1];

    // Get our dot products to determine influence
    let dot1 = g00.x * dx + g00.y * dy;
    let dot2 = g10.x * (dx - 1) + g10.y * dy;
    let dot3 = g01.x * dx + g01.y * (dy -1);
    let dot4 = g11.x * (dx - 1) + g11.y * (dy - 1);

    // Fade our dx and dy
    let fadedDx = this.fade(dx);
    let fadedDy = this.fade(dy);

    // Lerp 
    let lerp1 = this.lerp(dot1, dot2, fadedDx);
    let lerp2 = this.lerp(dot3, dot4, fadedDx);

    let value = this.lerp(lerp1, lerp2, fadedDy);

    return (value + 1)/2;
  }

  // Octave Perlin Noise gives more realistic noise
  // since it combines fine grained details
  // with large sweeping features
  octaveNoise(x, y, baseFrequency, numOctaves, persistence, lacunarity) {
    let totalNoise = 0;
    let frequency = baseFrequency;
    let amplitude = 1;
    let maxAmplitude = 0;

    for (let i = 0; i < numOctaves; i++) {
      // Add onto our total noise the noise at this level
      totalNoise += this.noise(x, y, frequency) * amplitude;
      // Record our max amplitude for normalization
      maxAmplitude += amplitude;

      // Decrease amplitude by persistence
      amplitude *= persistence;
      // Increase frequency (number of features)
      frequency *= lacunarity;
    }

    return totalNoise / maxAmplitude;
  }

  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  lerp(a, b, t) {
    return a + t * (b - a);
  }

  wrapValue(value) {
    return ((value % this.size) + this.size) % this.size;
  }

  wrapIndex(index) {
    return ((index % this.size) + this.size) % this.size;
  }

}