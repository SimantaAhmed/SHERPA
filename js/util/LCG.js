// Linear Congruential Generator (LCG) for reproducible pseudorandom numbers
// Usage: const rng = new LCG(seed); rng.next();
export class LCG {
  constructor(seed = Date.now()) {
    // LCG constants (Numerical Recipes)
    this.m = 0x80000000; // 2^31
    this.a = 1664525;
    this.c = 1013904223;
    this.state = seed % this.m;
  }

  // Returns a float in [0, 1)
  next() {
    this.state = (this.a * this.state + this.c) % this.m;
    return this.state / this.m;
  }

  // Returns an integer in [min, max)
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min)) + min;
  }

  // Returns a float in [min, max)
  nextFloat(min, max) {
    return this.next() * (max - min) + min;
  }
}
