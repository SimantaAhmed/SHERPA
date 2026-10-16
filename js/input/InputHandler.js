import * as THREE from 'three';

/**
 * Handles all keyboard and mouse input for the player and camera.
 * Supports WASD movement, action keys, and mouse look.
 */
export class InputHandler {

    /**
     * Create a new InputHandler.
     * @param {THREE.Camera} camera - The camera to use for camera-relative movement.
     */
    constructor(camera) {
        this.camera = camera;

        // Tracks which keys are currently pressed
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            shift: false,
            t: false,
            e: false,
            r: false,
            y: false,
            ' ': false,
        };

        // Tracks keys that were just pressed this frame (for single-action triggers)
        this.justPressed = {
            t: false,
            e: false,
            r: false,
            y: false,
            ' ': false,
        };

        // Mouse state for camera control
        this.mouse = {
            leftDown: false,
            x: 0,
            y: 0,
            deltaX: 0,
            deltaY: 0,
        };

        // --- Keyboard event listeners ---

        // Mark keys as pressed on keydown
        window.addEventListener('keydown', (e) => {
            let key = e.key.toLowerCase();
            if (key === 'shift') {
                this.keys.shift = true;
                return;
            }
            if (key in this.keys) {
                // Mark as just pressed for single-action keys
                if ((key === 't' || key === 'e' || key === 'r' || key === 'y' || key === ' ') && !this.keys[key]) {
                    this.justPressed[key] = true;
                }
                this.keys[key] = true;
            }
        });

        // Mark keys as released on keyup
        window.addEventListener('keyup', (e) => {
            let key = e.key.toLowerCase();
            if (key === 'shift') {
                this.keys.shift = false;
                return;
            }
            if (key in this.keys)
                this.keys[key] = false;
        });

        // --- Mouse event listeners ---

        // Track left mouse button state
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // left click
                this.mouse.leftDown = true;
            }
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) { // left click
                this.mouse.leftDown = false;
            }
        });

        // Track mouse movement for camera look
        window.addEventListener('mousemove', (e) => {
            this.mouse.deltaX = e.movementX;
            this.mouse.deltaY = e.movementY;
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
    }

    /**
     * Get a movement force vector based on WASD keys and camera direction.
     * @param {number} strength - The magnitude of the force.
     * @param {boolean} cameraRelative - If true, force is relative to camera heading.
     * @returns {THREE.Vector3} The movement force vector.
     */
    getForce(strength, cameraRelative = true) {
        let force = new THREE.Vector3();
        // WASD for forward/back/left/right movement
        if (this.keys.w) force.z += 1;
        if (this.keys.s) force.z -= 1;
        if (this.keys.a) force.x += 1;
        if (this.keys.d) force.x -= 1;

        // Only process if there is input
        if (force.length() > 0) {
            if (cameraRelative) {
                // Map movement to camera heading on the XZ plane.
                const cameraDirection = new THREE.Vector3();
                this.camera.getWorldDirection(cameraDirection);
                cameraDirection.y = 0;
                if (cameraDirection.lengthSq() > 0.0001) {
                    cameraDirection.normalize();
                    const cameraAngle = Math.atan2(cameraDirection.x, cameraDirection.z);
                    force.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngle);
                }
            }
            // Set force to strength argument
            force.setLength(strength);
        }
        return force;
    }

    /**
     * Returns true if the given key was just pressed this frame (single-action trigger).
     * @param {string} key - The key to check.
     * @returns {boolean}
     */
    wasPressedOnce(key) {
        if (!this.justPressed[key]) {
            return false;
        }
        this.justPressed[key] = false;
        return true;
    }

    /**
     * Resets all justPressed keys at the end of the frame.
     */
    endFrame() {
        this.justPressed.t = false;
        this.justPressed.e = false;
        this.justPressed.r = false;
        this.justPressed.y = false;
        this.justPressed[' '] = false;
    }
}