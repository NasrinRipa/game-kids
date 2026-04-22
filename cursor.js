import { CELL_CLEARED, CELL_TRAIL, dirs, BONUS_WARNING_TIME } from './constants.js';
import { game } from './gamestate.js';
import { rebuildCursorSprite, _finishTankConquer } from './bonus.js';

/** The player-controlled cursor that traces a trail across the playfield. */
export class Cursor {
    constructor() {
        this.x    = 0;      // current grid column
        this.y    = 0;      // current grid row
        this.prevX = 0;     // position at the start of the last render step
        this.prevY = 0;
        this.direction = false;   // movement angle in degrees, or false when stopped
        this.isOnTrail  = false;  // true while the cursor is drawing a trail
        this.wasOnTrail = false;  // isOnTrail value from the previous render step

    }

    /**
     * Place the cursor at (x, y).
     * @param {boolean} unlock - When true (after a collision recovery) keep the
     *   previous position as prevX/prevY so the border cell gets redrawn.
     */
    reset(x, y, unlock = false) {
        const stayAtPrev = unlock && (game.grid.cellValue(this.x, this.y) & CELL_CLEARED);
        this.prevX = stayAtPrev ? this.x : x;
        this.prevY = stayAtPrev ? this.y : y;
        this.x = x;
        this.y = y;
        this.direction = this.isOnTrail = this.wasOnTrail = false;
    }

    /** Return the current [x, y] position. */
    pos() { return [this.x, this.y]; }

    /** Return the current movement direction (angle or false). */
    getDirection() { return this.direction; }

    /**
     * Set the movement direction.
     * Reversing direction while on a trail is not allowed (it would cross
     * the trail and cause an immediate collision).
     */
    setDirection(angle) {
        if (angle === this.direction) return;
        if (this.isOnTrail && this.direction !== false && angle !== false &&
            Math.abs(angle - this.direction) === 180) return;
        this.direction = angle;
    }

    /**
     * Advance the cursor by `dist` cells in the current direction.
     * Updates game.state.hasCollision / hasConquered as appropriate.
     */
    update(dist) {
        if (this.direction === false) return;

        const grid  = game.grid;
        const state = game.state;
        const level = game.level;
        const tank  = level.tankMode;

        let x = this.x, y = this.y;
        const [vx, vy] = dirs.get(this.direction);
        let finalized = false;

        dist = Math.max(0, Math.floor(dist));

        for (let n = 0; n < dist; n++) {
            const nx = x + vx, ny = y + vy;

            if (grid.cellIndex(nx, ny) < 0) {
                // Stepped outside the valid grid — stop.
                this.direction = false;
                break;
            }

            if (tank) {
                const nextVal     = grid.cellValue(nx, ny);
                const nextCellIdx = grid.cellIndex(nx, ny);
                // End tank mode when stepping onto any already-cleared cell
                const clearedBeforeTank = !!(nextVal & CELL_CLEARED);
                if (clearedBeforeTank) {
                    level.tankMode = false;
                    game.bonusTimerActive = false;
                    if (level.tankTimeout) {
                        clearTimeout(level.tankTimeout);
                        level.tankTimeout = null;
                    }
                    rebuildCursorSprite(false);
                }

                x = nx; y = ny;
                const cellIdx = grid.cellIndex(x, y);
                if (!(grid.cellValue(x, y) & CELL_CLEARED)) {
                    grid.setCell(x, y, CELL_CLEARED);
                    state.clearCells(x, y);
                    grid.conqueredCount++;
                    // Track as cleared during tank mode so re-visiting it won't end tank mode
                    level.tankClearedCells?.add(cellIdx);
                    // Add to saved trail, mirroring addToTrail node logic exactly:
                    // node is the last-already-added cell (end of previous segment),
                    // or the first cell itself when the trail is empty.
                    if (level.saved_copy_trail) {
                        const tn = level.saved_copy_trail.length;
                        if (!tn || this.direction !== level.saved_copy_trail_direction) {
                            const nodeIndex = tn ? level.saved_copy_trail[tn - 1] : cellIdx;
                            if (!tn || nodeIndex !== level.saved_copy_trail_nodes[level.saved_copy_trail_nodes.length - 1])
                                level.saved_copy_trail_nodes.push(nodeIndex);
                            level.saved_copy_trail_direction = this.direction;
                        }
                        level.saved_copy_trail.push(cellIdx);
                    }
                }
                if (level.tankMode === false) {
                    this.direction = false;
                    _finishTankConquer();
                    break;
                }
                continue;
            }

            // ── Normal (non-tank) movement ──────────────────────────────────

            const nextVal     = grid.cellValue(nx, ny);
            const nextCleared = !!(nextVal & CELL_CLEARED);
            const nextTrail   = !!(nextVal & CELL_TRAIL);

            if (nextTrail) {
                // Check if cursor is retracing its own trail backward.
                const nextIdx = grid.cellIndex(nx, ny);
                const trailLen = grid.trail.length;
                if (this.isOnTrail && trailLen >= 2 && nextIdx === grid.trail[trailLen - 2]) {
                    grid.popTrailCell();
                    this.isOnTrail = grid.trail.length > 0;
                    x = nx; y = ny;
                    continue;
                }
                // Crossing own trail from a different direction → collision.
                state.hasCollision = true;
                break;
            }

            if (nextCleared) {
                if (this.isOnTrail) { x = nx; y = ny; finalized = true; break; }
                x = nx; y = ny;
                this.isOnTrail = false;
                continue;
            }

            // Unexplored cell: elongate the trail.
            grid.addToTrail(nx, ny, this.direction);
            this.isOnTrail = true;
            x = nx; y = ny;
        }

        this.x = x;
        this.y = y;

        if (!finalized) return;

        if (grid.trail.length > 1 && grid.getPreTrailCellIndex() === grid.cellIndex(x, y))
            state.hasCollision = true;
        else if (grid.trail.length === 1 && grid.getPreTrailCellIndex() === grid.cellIndex(x, y)) {
            // Single-cell trail returning to origin — treat as backtrack, not conquest.
            grid.popTrailCell();
            this.isOnTrail = false;
        } else {
            this.direction = this.isOnTrail = false;

            // End sneaky (invincible) mode when the trail is completed.
            if (game.level.isInvincible) {
                game.sneakyConquer = true;
                game.level.isInvincible = false;
                if (game.level.sneakyTimeout != null) {
                    clearTimeout(game.level.sneakyTimeout);
                    game.activeEffectTimers = game.activeEffectTimers.filter(x => x !== game.level.sneakyTimeout);
                    game.level.sneakyTimeout = null;
                    game.bonusTimerActive = false;
                    game.bonusTimerExpiresAt = 0;
                }
                rebuildCursorSprite(false);
            }

            state.hasConquered = true;
        }
    }

    /** Redraw the cursor and erase its previous position. */
    render() {
        const state = game.state;
        const cfg   = game.config;
        const cs    = cfg.cellSize;

        if (this.prevX === this.x && this.prevY === this.y) {
            // Cursor hasn't moved — only redraw on the very first frame.
            if (state.lastFrameTime) return;
        } else {
            if (this.wasOnTrail) {
                // Erase the trail line segment that was just completed.
                const trailOpacity = game.level.isInvincible ? 0.5 : 1;
                const trailRect = game.grid.getLastTrailRect();
                if (trailOpacity < 1) state.fillCells(cfg.colorEmpty, ...trailRect);
                state.fillCells(cfg.colorTrail, ...trailRect, trailOpacity);
            } else if (game.grid.isInsideGrid(this.prevX, this.prevY)) {
                state.clearCells(this.prevX, this.prevY);
            } else {
                state.fillCells(cfg.colorBorder, this.prevX, this.prevY);
            }
            this.prevX = this.x;
            this.prevY = this.y;
        }

        this.wasOnTrail = this.isOnTrail;

        // Draw cursor directly on the canvas (avoids async Image loading issues).
        // Use effect color while a timed bonus is active, but stop BONUS_WARNING_TIME
        // before it expires so the cursor visually warns the player.
        const withEffect = game.bonusTimerActive &&
            (game.bonusTimerExpiresAt === 0 || Date.now() < game.bonusTimerExpiresAt - BONUS_WARNING_TIME);
        const q   = Math.floor(cs / 4);
        const ctx = state.mainCtx;
        ctx.fillStyle = withEffect ? cfg.colorCursorEffect : cfg.colorCursor;
        ctx.fillRect((this.x + 2) * cs, (this.y + 2) * cs, cs, cs);
        ctx.fillStyle = cfg.colorCursorCenter;
        ctx.fillRect((this.x + 2) * cs + q, (this.y + 2) * cs + q, cs - 2 * q, cs - 2 * q);
    }
}
