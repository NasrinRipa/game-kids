// Cell bitmask flags
export const CELL_CLEARED = 1 << 0;  // cell has been conquered / revealed
export const CELL_TRAIL   = 1 << 1;  // cell is part of the active cursor trail

// Gameplay timing (milliseconds)
export const COLLISION_TIMEOUT           = 1000;  // pause duration after a fault collision
export const LEVEL_CLEAR_DELAY           = 700;   // delay before the level-clear animation starts
export const LEVEL_CLEAR_DURATION        = 2000;  // length of the level-clear sweep animation
export const LEVEL_COMPLETE_DISPLAY_DELAY = 1500; // delay before showing the "Next Level" button
export const FAULT_DISPLAY_DELAY         = 1000;  // delay before showing the "Play" button after fault

// Enemy / collision behaviour
export const ADJACENT_COLLISION = false;  // true → diagonal-adjacent cells also count as collision
export const MAX_WARDERS        = 9;      // maximum warder enemies on the field at once

// Bonus spawning
export const MAX_BONUS_TRY                 = 5;     // max placement attempts before giving up
export const BONUS_MARGIN                  = 5;     // min cell distance from grid edge for bonus spawn
export const BONUS_SPAWN_CLEARED_THRESHOLD = 80;    // stop spawning new bonuses above this % cleared
export const BONUS_WARNING_TIME            = 1000;  // ms before expiry when withEffect turns off

// Direction map: clockwise angle in degrees → [dx, dy] movement vector
// 0 = right, 90 = down, 180 = left, 270 = up; diagonals at 45° intervals
const ANGLE_TO_VEC = {
      0: [ 1,  0],
     45: [ 1,  1],
     90: [ 0,  1],
    135: [-1,  1],
    180: [-1,  0],
    225: [-1, -1],
    270: [ 0, -1],
    315: [ 1, -1],
};

/** Direction utilities used by the cursor, enemies, and grid algorithms. */
export const dirs = {
    /** Return [dx, dy] for the given angle, or [0,0] if unknown. */
    get(angle) {
        return ANGLE_TO_VEC[angle] ?? [0, 0];
    },

    /** Return the angle (degrees) whose vector matches the given (dx, dy). */
    find(dx, dy) {
        const nx = Math.sign(dx);
        const ny = Math.sign(dy);
        for (const angle in ANGLE_TO_VEC) {
            const [vx, vy] = ANGLE_TO_VEC[angle];
            if (vx === nx && vy === ny) return +angle;
        }
        return false;
    },
};
