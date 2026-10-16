import * as THREE from 'three';

// Tile map renderer
export class TileMapRenderer {

  constructor(tileMap) {
    this.map = tileMap;
    this.terrainResolutionScale = 3;

    this.terrainMesh = null;
    this.blackoutOverlay = null;

    this.buildTerrain();
    this.buildBlackoutOverlay();
  }

  buildTerrain() {
    const terrainCols = (this.map.cols - 1) * this.terrainResolutionScale;
    const terrainRows = (this.map.rows - 1) * this.terrainResolutionScale;
    const geometry = new THREE.PlaneGeometry(
      this.map.width,
      this.map.depth,
      terrainCols,
      terrainRows,
    );

    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;
    const colors = [];

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);

      const tile = this.map.quantize(new THREE.Vector3(x, 0, z));
      const h = this.map.sampleHeight(x, z);
      const heightRatio = THREE.MathUtils.clamp(h / this.map.maxHeight, 0, 1);

      positions.setY(i, h);

      let color = new THREE.Color('#f2f6fb');

      if (tile) {
        if (tile.type.description === 'Sand') {
          color = new THREE.Color('#8b8d80');
        } else if (tile.type.description === 'Water') {
          color = new THREE.Color('#4c6d9a');
        }

        // Everest-style gradient: bright snowfield -> rock -> snowcaps.
        if (heightRatio > 0.52) {
          const t = THREE.MathUtils.smoothstep(heightRatio, 0.52, 0.82);
          color.lerp(new THREE.Color('#8f948e'), t);
        }

        if (heightRatio > 0.74) {
          const snowT = THREE.MathUtils.smoothstep(heightRatio, 0.74, 1.0);
          color.lerp(new THREE.Color('#f2f6fb'), snowT);
        }

        if (tile.blackout) {
          color = new THREE.Color('#050608');
        }
      }

      colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.05,
    });

    this.terrainMesh = new THREE.Mesh(geometry, material);
    this.terrainMesh.receiveShadow = true;
  }

  buildBlackoutOverlay() {
    const terrainCols = (this.map.cols - 1) * this.terrainResolutionScale;
    const terrainRows = (this.map.rows - 1) * this.terrainResolutionScale;
    const geometry = new THREE.PlaneGeometry(
      this.map.width,
      this.map.depth,
      terrainCols,
      terrainRows,
    );

    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;
    const colors = [];

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const tile = this.map.quantize(new THREE.Vector3(x, 0, z));

      const h = this.map.sampleHeight(x, z) + 0.12;
      positions.setY(i, h);

      if (tile && tile.blackout) {
        colors.push(0.08, 0.1, 0.16);
      } else {
        colors.push(0, 0, 0);
      }
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    });

    this.blackoutOverlay = new THREE.Mesh(geometry, material);
  }

  render(scene) {
    scene.add(this.terrainMesh);
    scene.add(this.blackoutOverlay);
  }

  // JPS calls this when visualizing jump points; noop for plane renderer.
  setTileColor(tile, color) {
    return;
  }
}
