import { game } from './gamestate.js';
import { CELL_TRAIL, MAX_BONUS_TRY, BONUS_MARGIN, BONUS_WARNING_TIME } from './constants.js';

const _bonusImageCache = {};

/**
 * A bonus item that appears on the playfield.
 *
 * When the cursor occupies any cell covered by the bonus, pply() is called
 * and the corresponding effect is granted to the player.
 *
 * Available bonus types:
 *   speed    – temporarily increases cursor speed
 *   slow     – reduces enemy speed
 *   sneaky   – makes the cursor immune to collisions for a few seconds
 *   killward – removes one warder enemy
 *   life     – grants an extra life
 *   freez    – freezes all enemies temporarily
 *   tank     – enables tank mode (cursor clears cells as it moves)
 */
export class Bonus {
    constructor(x = 0, y = 0, type = 'speed', value = 10, isActive = true) {
        this.x        = x;
        this.y        = y;
        this.type     = type;
        this.value    = value;    // magnitude / duration of the bonus effect
        this.isActive = isActive;
        this.size     = 2;        // side length in cells (per-type override possible)
        this._image   = null;     // cached Image element for icon-based types
    }

    /** Return a randomly-positioned bonus at a random or specified type. */
    static random(minX = 0, minY = 0, maxX = 60, maxY = 40, type = 'random') {
        const types  = ['speed', 'slow', 'sneaky', 'killward', 'life', 'freez', 'tank'];
        const values = [5,       5,      7,         1,          3,      2,       5];
        const idx    = Math.floor(Math.random() * types.length);
        const t      = type === 'random' ? types[idx]  : type;
        const v      = type === 'random' ? values[idx] : 5;

        for (let attempt = 0; attempt < MAX_BONUS_TRY; attempt++) {
            const x = Math.floor(Math.random() * (maxX - minX)) + minX;
            const y = Math.floor(Math.random() * (maxY - minY)) + minY;

            const sz = new Bonus(0, 0, t, v).size;
            let allUncleared = true;
            for (let dx = 0; dx < sz; dx++) {
                for (let dy = 0; dy < sz; dy++) {
                    const val = game.grid.cellValue(x + dx, y + dy);
                    // CELL_CLEARED is defined in constants.js or accessible via game.grid
                    // If cellValue returns 0 for unexplored (uncleared)
                    if (val !== 0) {
                        console.log('bonuss spawn blocked by cleared cell at', x + dx, y + dy);
                        allUncleared = false;
                        break;
                    }
                }
                if (!allUncleared) break;
            }

            if (allUncleared) {
                return new Bonus(x, y, t, v, true);
            }
        }

        console.log('bonus not spawning');
        return null;
    }


    /**
     * Draw the bonus item on the main canvas.
     * Icon-based types ('life', 'freez') cache their Image so it is only
     * decoded once.
     */
    render() {
        if (!this.isActive) return;

        const { cellSize: cs } = game.config;
        const ctx  = game.state.mainCtx;
        const w    = cs * this.size;
        const h    = cs * this.size;
        const left = (this.x + 2) * cs;
        const top  = (this.y + 2) * cs;

        if (!this._image) {
            if (!_bonusImageCache[this.type]) {
                const img = new Image();
                img.src = `assets/${this.type}.png`;
                _bonusImageCache[this.type] = img;
            }
            this._image = _bonusImageCache[this.type];
        }
        const img = this._image;
        if (img.complete && img.naturalWidth)
            ctx.drawImage(img, left, top, w, h);
        else
            img.onload = () => ctx.drawImage(img, left, top, w, h);
        }

    /**
     * True when the given grid position [x, y] overlaps the bonus area.
     * Used every frame to detect cursor–bonus collision.
     */
    containsPoint([px, py]) {
        return px >= this.x && px < this.x + this.size &&
               py >= this.y && py < this.y + this.size;
    }

    /**
     * Deactivate the bonus, erase it from the canvas, and apply its effect to
     * the player/level state.
     */
    apply() {
        game.bonus = null;

        const { cellSize: cs, colorEmpty } = game.config;
        game.state.mainCtx.fillStyle = colorEmpty;
        game.state.mainCtx.fillRect(
            (this.x + 2) * cs, (this.y + 2) * cs,
            this.size * cs, this.size * cs
        );

        const state = game.state;
        const level = game.level;
        let hasTimer      = false;
        let timedDuration = 0;
        let isEffectActive = null;
        let getRemainingMs = null;

        const startTimedEffect = (onEnd, durationInSec) => {
            game.bonusTimerActive = true;
            game.bonusTimerExpiresAt = Date.now() + durationInSec * 1000;
            rebuildCursorSprite(true);

            let finished = false;
            const cleanup = () => {
                if (finished) return;
                finished = true;
                onEnd();
            };

            const t = setTimeout(() => {
                cleanup();
                game.bonusTimerActive = false;
                game.bonusTimerExpiresAt = 0;
                rebuildCursorSprite(false);
                game.activeEffectTimers = game.activeEffectTimers.filter(x => x !== t);
                game.activeEffectCleanups = game.activeEffectCleanups.filter(x => x !== cleanup);
            }, durationInSec * 1000);

            game.activeEffectTimers.push(t);
            game.activeEffectCleanups.push(cleanup);
            return t;
        };

        switch (this.type) {
            case 'speed':
                state.bonusSpeed += this.value;
                break;

            case 'slow': {
                const slowDelta = (level.enemySpeed - level.enemySlowdown) * 0.3;
                level.enemySlowdown += slowDelta;
                break;
            }

            case 'sneaky':
                level.isInvincible = true;
                hasTimer      = true;
                timedDuration = this.value;
                isEffectActive = () => !!game.level?.isInvincible;
                getRemainingMs = () => Math.max(0, game.bonusTimerExpiresAt - Date.now());
                // Repaint any existing trail at 50% opacity immediately.
                for (const rect of game.grid.getAllTrailRects()) {
                    game.state.fillCells(game.config.colorEmpty, ...rect);
                    game.state.fillCells(game.config.colorTrail, ...rect, 0.5);
                }
                level.sneakyTimeout = startTimedEffect(() => {
                    level.isInvincible = false;
                    level.sneakyTimeout = null;
                }, this.value);
                break;

            case 'killward':
                if (level.warders.length > 0) {
                    const removed = level.warders.pop();
                    removed.eraseFromCanvas();
                    level.warderCount = Math.max(0, level.warderCount - 1);
                }
                break;

            case 'life':
                state.lives++;
                break;

            case 'freez': {
                hasTimer      = true;
                timedDuration = this.value;
                isEffectActive = () => !!game.level && game.level.enemySlowdown === game.level.enemySpeed;
                getRemainingMs = () => Math.max(0, game.bonusTimerExpiresAt - Date.now());
                if (level.enemySlowdown !== level.enemySpeed) {
                    const saved = level.enemySlowdown;
                    level.enemySlowdown = level.enemySpeed;
                    startTimedEffect(() => {
                        level.enemySlowdown = saved;
                    }, this.value);
                }
                break;
            }

            case 'tank':
                if (!level.tankMode) {
                    // Save current trail before removing it
                    level.saved_copy_trail = game.grid.trail.slice();
                    level.saved_copy_trail_nodes = game.grid.trailNodes.slice();
                    level.saved_copy_trail_direction = game.grid.trailDirection;
                    level.saved_copy_trail_pre_index = game.grid.preTrailCellIndex;
                    // Track cells cleared during tank mode (so we don't end on them)
                    level.tankClearedCells = new Set();

                    // Immediately convert any existing trail to cleared territory.
                    game.grid.resetTrail(true);
                    game.cursor.isOnTrail = false;
                    game.cursor.tankTrailConverted = false;
                    level.tankMode = true;
                    hasTimer      = true;
                    timedDuration = this.value;
                    isEffectActive = () => !!game.level?.tankMode;
                    getRemainingMs = () => Math.max(0, game.bonusTimerExpiresAt - Date.now());
                    level.tankTimeout = startTimedEffect(() => {
                        const wasActive = level.tankMode;
                        level.tankMode = false;
                        level.tankTimeout = null;
                        // Discard saved trail without triggering conquest.
                        level.tankClearedCells = null;
                        level.saved_copy_trail = null;
                        level.saved_copy_trail_nodes = null;
                        level.saved_copy_trail_direction = null;
                        level.saved_copy_trail_pre_index = null;
                        // Only reset the trail if tank mode was still running when this
                        // cleanup fired. If conquest (cursor.js) already ended tank mode,
                        // tankMode is already false and the trail belongs to the new
                        // (post-conquest) cursor movement — do not erase it.
                        if (wasActive) {
                            game.grid.resetTrail(false);
                            game.cursor.isOnTrail = false;
                            if (game.config.tankAutoStop) game.cursor.direction = false;
                        }
                    }, this.value);
                }
                break;
        }

        game.ui.updateStatus('update');
        if (game.ui.showBonusCaptured) {
            game.ui.showBonusCaptured(this.type, hasTimer, timedDuration, isEffectActive, getRemainingMs);
        } else {
            game.ui.setBanner('Bonus: ' + this.type);
        }
    }
}

/**
 * Handle post-conquer process after tank mode ends.
 * Restores the saved trail as the grid trail, marks trail cells with CELL_TRAIL
 * so the conquer algorithm can detect boundaries, then signals the game loop
 * to run conquerRegions using that trail.
 */
export function _finishTankConquer() {
    const level = game.level;

    level.tankClearedCells = null;

    if (!level.saved_copy_trail || level.saved_copy_trail.length === 0) {
        level.saved_copy_trail = null;
        level.saved_copy_trail_nodes = null;
        level.saved_copy_trail_direction = null;
        level.saved_copy_trail_pre_index = null;
        return;
    }

    // Install the saved trail into the grid so conquerRegions uses it
    game.grid.trail = level.saved_copy_trail.slice();
    game.grid.trailNodes = level.saved_copy_trail_nodes.slice();
    if (level.saved_copy_trail_pre_index != null) {
        game.grid.preTrailCellIndex = level.saved_copy_trail_pre_index;
    }

    // Mark each trail cell with CELL_TRAIL so the boundary-tracing algorithm
    // can detect them. Cells are already CELL_CLEARED from tank movement.
    for (const idx of game.grid.trail) {
        game.grid.cells[idx] |= CELL_TRAIL;
    }

    // Signal the game loop to run conquerRegions on this trail
    game.state.hasConquered = true;

    level.saved_copy_trail = null;
    level.saved_copy_trail_nodes = null;
    level.saved_copy_trail_direction = null;
    level.saved_copy_trail_pre_index = null;
}

/** Rebuild the cursor sprite image to reflect the current invincibility state. */
/** Rebuild the cursor sprite image to reflect the current invincibility state. */
export function rebuildCursorSprite(withEffect = false) {
    const cfg    = game.config;
    const cs     = cfg.cellSize;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = cs;
    const ctx = canvas.getContext('2d');
    const q   = cs / 4;
    const opacity = game.level.isInvincible ? 0.5 : 1;
    ctx.globalAlpha = opacity;
    ctx.fillStyle   = withEffect ? cfg.colorCursorEffect : cfg.colorCursor;
    ctx.fillRect(0, 0, cs, cs);
    ctx.fillStyle   = cfg.colorCursorCenter;
    ctx.fillRect(q, q, cs - cs / 2, cs - cs / 2);
    ctx.globalAlpha = 1;
    const img = new Image();
    img.src = canvas.toDataURL();
    game.images.cursor = img;
}
