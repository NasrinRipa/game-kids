import { CELL_CLEARED, CELL_TRAIL, dirs, ADJACENT_COLLISION } from './constants.js';
import { game } from './gamestate.js';

/**
 * An enemy entity.  There are two enemy types:
 *   - Ball    (isWarder = false): bounces inside the playfield interior.
 *   - Warder  (isWarder = true):  roams the border and cleared cells.
 */
export class Enemy {
    constructor(x, y, isWarder, direction) {
        this.x       = x;
        this.y       = y;
        this.prevX   = x;
        this.prevY   = y;
        this.isWarder  = Boolean(isWarder);
        // True when a ball has migrated onto cleared territory and must roam
        // like a warder — but still renders as a ball.
        this.isBallExiled = false;

        // Default to a random diagonal direction when none is provided.
        const diagonals = [45, 135, 225, 315];
        this.direction  = direction !== undefined
            ? direction
            : diagonals[Math.floor(Math.random() * 4)];
    }

    /** Teleport to (x, y) — used after a collision recovery. */
    reset(x, y) {
        this.x = x;
        this.y = y;
    }

    /** Return the current [x, y] position. */
    pos() { return [this.x, this.y]; }

    /** Advance the enemy by `dist` cells, applying bounces. */
    update(dist) {
        // If a ball has ended up on cleared territory (e.g. after sneaky conquest),
        // permanently promote it to a warder so it roams the border like one.
        if (!this.isWarder && !this.isBallExiled && (game.grid.cellValue(this.x, this.y) & CELL_CLEARED)) {
            this.isBallExiled = true;
        }
        const result   = this._movePath(this.x, this.y, dist, this.direction);
        this.x         = result.x;
        this.y         = result.y;
        this.direction = result.direction;
    }

    /** Redraw the enemy at its current position and erase the previous one. */
    render() {
        const state  = game.state;
        const cfg    = game.config;
        const grid   = game.grid;

        if (this.prevX === this.x && this.prevY === this.y) {
            if (state.lastFrameTime) return;
        } else {
            // Erase previous position.
            if ((this.isWarder || this.isBallExiled) && grid.isInsideGrid(this.prevX, this.prevY)) {
                state.clearCells(this.prevX, this.prevY);
            } else if (!this.isWarder && !this.isBallExiled && (grid.cellValue(this.prevX, this.prevY) & CELL_CLEARED)) {
                // Ball was on a cleared cell — reveal background.
                state.clearCells(this.prevX, this.prevY);
                // If a bonus overlaps the previous position, redraw it.
                if (game.bonus?.containsPoint([this.prevX, this.prevY])) game.bonus.render();
            } else if (!this.isWarder && !this.isBallExiled && (grid.cellValue(this.prevX, this.prevY) & CELL_TRAIL)) {
                // Ball was on a trail cell — restore trail appearance.
                const trailOpacity = game.level.isInvincible ? 0.5 : 1;
                if (trailOpacity < 1) state.fillCells(cfg.colorEmpty, this.prevX, this.prevY);
                state.fillCells(cfg.colorTrail, this.prevX, this.prevY, 1, 1, trailOpacity);
            } else {
                state.fillCells(
                    (this.isWarder || this.isBallExiled) ? cfg.colorBorder : cfg.colorEmpty,
                    this.prevX, this.prevY
                );
                // If a bonus overlaps the previous position, redraw it.
                if (game.bonus?.containsPoint([this.prevX, this.prevY])) game.bonus.render();
            }
            this.prevX = this.x;
            this.prevY = this.y;
        }

        state.drawCellImage(
            this.isWarder ? game.images.warder : game.images.ball,
            this.x, this.y
        );
    }

    /**
     * Erase this enemy from its current position (used when it is removed
     * mid-game, e.g. by the killwarder bonus).
     */
    eraseFromCanvas() {
        const grid = game.grid;
        if (grid.isInsideGrid(this.x, this.y))
            game.state.clearCells(this.x, this.y);
        else
            game.state.fillCells(
                (this.isWarder || this.isBallExiled) ? game.config.colorBorder : game.config.colorEmpty,
                this.x, this.y
            );
    }

    // ── Internal movement ────────────────────────────────────────────────────

    /**
     * Recursively move `dist` cells from (x, y) in `direction`, bouncing as needed.
     * Sets game.state.hasCollision when the cursor is hit.
     */
    _movePath(x, y, dist, direction) {
        const cursor = game.cursor;
        const state  = game.state;
        const level  = game.level;
        const grid   = game.grid;

        const [cx, cy] = cursor.pos();
        const cursorCellVal = grid.cellValue(cx, cy);
        // A ball collides when it enters an occupied/cleared cell; a warder collides
        // when it enters an unexplored cell.  XOR implements this toggle.
        const cursorIsTarget = !(this.isWarder || this.isBallExiled) ^ !!(cursorCellVal & CELL_CLEARED);

        const checkCursorAt = (ex, ey, dir) => {
            if (level.isInvincible) return;
            if (cursorIsTarget) {
                const hit = ADJACENT_COLLISION
                    ? Math.abs(ex - cx) <= 1 && Math.abs(ey - cy) <= 1
                    : ex === cx && ey === cy;
                if (hit) state.hasCollision = true;
            } else if (!this.isWarder && ex === cx && ey === cy) {
                // Ball landed on cleared territory (e.g. after sneaky conquest) —
                // still collide if cursor occupies the exact same cell.
                state.hasCollision = true;
            }
            if (!this.isWarder && !this.isBallExiled) this._checkTrailCollision(ex, ey, dir);
        };

        checkCursorAt(x, y, direction);

        const MAX_BOUNCES = 8;
        let bounces = 0;
        let n = 0;
        while (n < dist && !state.hasCollision) {
            const [vx, vy] = dirs.get(direction);
            const xt = x + vx, yt = y + vy;
            const bounceDir = this._getBounceDirection(x, y, direction, xt, yt);
            if (bounceDir !== false) {
                if (++bounces > MAX_BOUNCES) break;
                direction = bounceDir;
                continue;
            }

            checkCursorAt(xt, yt, direction);

            if (!this.isWarder && !this.isBallExiled && !grid.isInsideGrid(xt, yt)) break;
            x = xt;
            y = yt;
            n++;
        }

        return { x, y, direction };
    }

    /**
     * Determine the bounce direction when moving from (x, y) toward (xt, yt).
     * Returns a new angle, or false if no bounce is needed.
     */
    _getBounceDirection(x, y, direction, xt, yt) {
        const warding = this.isWarder || this.isBallExiled;

        const [left, right] = game.grid.getAdjacentCells(x, y, direction, [-45, 45]);
        const b1 = warding ^ !!(left[3]  & CELL_CLEARED);
        const b2 = warding ^ !!(right[3] & CELL_CLEARED);

        if (b1 ^ b2) return (b1 ? direction + 90 : direction + 270) % 360;

        const frontClear = warding ^ !!(game.grid.cellValue(xt, yt) & CELL_CLEARED);
        return frontClear || (b1 && b2) ? (direction + 180) % 360 : false;
    }

    /**
     * Collision check against the cursor trail (balls only).
     * Sets game.state.hasCollision if (x, y) is on or adjacent to the trail.
     */
    _checkTrailCollision(x, y, direction) {
        if (game.level.isInvincible) return;
        // If a conquest just completed this frame (e.g. sneaky mode ended on trail
        // completion), the trail is about to be cleared — skip collision.
        if (game.state.hasConquered) return;
        if (game.grid.cellValue(x, y) & CELL_TRAIL) {
            game.state.hasCollision = true;
            return;
        }
        if (!ADJACENT_COLLISION) return;

        for (const offset of [-45, 45, -90, 90]) {
            const angle    = (direction + offset + 360) % 360;
            const [vx, vy] = dirs.get(angle);
            if (game.grid.cellValue(x + vx, y + vy) & CELL_TRAIL) {
                game.state.hasCollision = true;
                return;
            }
        }
    }
}
