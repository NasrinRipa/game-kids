import { CELL_CLEARED, CELL_TRAIL, dirs, MAX_WARDERS } from './constants.js';
import { game } from './gamestate.js';

/**
 * The playing-field grid.
 *
 * The physical grid is (cols + 4) x (rows + 4) cells: the extra 2-cell border
 * on every side allows enemies and the cursor to exist just outside the visible
 * area.  Cell (x, y) with x in [-2, cols+1] / y in [-2, rows+1] is valid.
 */
export class Grid {
    constructor() {
        this.cols  = 0;   // playfield width in cells
        this.rows  = 0;   // playfield height in cells
        this.stride = 0;  // row stride = cols + 4  (width of the extended grid)

        this.conqueredCount = 0;   // number of cells that have been cleared
        this.lastConquerRectCount = 0;

        this.trailDirection    = 0;   // movement angle of the most-recent trail segment
        this.preTrailCellIndex = 0;   // index of the cell immediately before the trail

        this.cells      = [];   // flat array: one uint per extended-grid cell
        this.trail      = [];   // indices of cells in the active cursor trail
        this.trailNodes = [];   // indices of direction-change points in the trail
        this.trailRects = [];   // dirty rectangles queued for repaint
    }

    /** Re-initialise grid state for a new level. */
    reset() {
        this.cols   = game.config.gridCols;
        this.rows   = game.config.gridRows;
        this.stride = this.cols + 4;

        const total = this.stride * (this.rows + 4);
        this.conqueredCount = 0;
        this.lastConquerRectCount = 0;
        this.cells = [];

        for (let i = 0; i < total; i++) {
            const [x, y] = this.cellPos(i);
            // Border cells are pre-cleared; interior cells start as unexplored (0).
            this.cells.push(x >= 0 && x < this.cols && y >= 0 && y < this.rows
                ? 0 : CELL_CLEARED);
        }

        this.trail      = [];
        this.trailNodes = [];
        this.trailRects = [];

        game.state.fillCells(game.config.colorEmpty, 0, 0, this.cols, this.rows);
    }

    /**
     * Repaint any trail segments that were queued during the last update step.
     * Called once per frame before drawing sprites.
     */
    render() {
        for (let i = this.trailRects.length - 1; i >= 0; i--) {
            game.state.fillCells(game.config.colorEmpty, ...this.trailRects[i]);
        }
        this.trailRects = [];
    }

    // ── Position helpers ────────────────────────────────────────────────────

    /** True when (x, y) is within the visible playfield. */
    isInsideGrid(x, y) {
        return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
    }

    /** True when (x, y) is anywhere in the extended grid (including the border). */
    isPositionValid(x, y) {
        return x >= -2 && x < this.cols + 2 && y >= -2 && y < this.rows + 2;
    }

    /** Convert grid coordinates to a flat array index (-1 if out of bounds). */
    cellIndex(x, y) {
        return this.isPositionValid(x, y) ? this.stride * (y + 2) + (x + 2) : -1;
    }

    /** Convert a flat array index back to [x, y] grid coordinates. */
    cellPos(i) {
        return [i % this.stride - 2, Math.floor(i / this.stride) - 2];
    }

    /** Map an array of cell indices to their [x, y] positions. */
    indicesToPositions(indices) {
        return indices.map(i => this.cellPos(i));
    }

    /** Return the bitmask value of the cell at (x, y), or 0 if out of bounds. */
    cellValue(x, y) {
        const i = this.cellIndex(x, y);
        return i >= 0 ? this.cells[i] : 0;
    }

    /** Set the cell at (x, y) to an exact value. Returns its index. */
    setCell(x, y, v) {
        const i = this.cellIndex(x, y);
        if (i >= 0) this.cells[i] = v;
        return i;
    }

    /** OR the given flag bits into the cell at (x, y). Returns its index. */
    setCellFlag(x, y, flag) {
        const i = this.cellIndex(x, y);
        if (i >= 0) this.cells[i] |= flag;
        return i;
    }

    /** Clear (AND-NOT) the given flag bits from the cell at (x, y). */
    clearCellFlag(x, y, flag) {
        const i = this.cellIndex(x, y);
        if (i >= 0) this.cells[i] &= ~flag;
        return i;
    }

    // ── Placement helpers ────────────────────────────────────────────────────

    /** Starting position for the cursor (top edge, centred horizontally). */
    getInitialCursorPos() {
        return [Math.floor(this.cols / 2), -2];
    }

    /** n random positions inside the playfield for ball enemies. */
    getRandomBallPositions(n) {
        const used = [], result = [];
        for (let i = 0; i < n; i++) {
            let k;
            do { k = Math.floor(Math.random() * this.cols * this.rows); }
            while (used.includes(k));
            used.push(k);
            result.push([k % this.cols, Math.floor(k / this.cols)]);
        }
        return result;
    }

    /**
     * Starting positions for n warder enemies along the outer border.
     * Positions are drawn from a fixed pool; the first pool entry depends on n.
     */
    getWarderStartPositions(n) {
        const mid = Math.floor(this.cols / 2);
        const q   = Math.floor(this.cols / 4);
        const pool = [
            [mid, this.rows + 1],
            [-1,  this.rows + 1], [this.cols,     this.rows + 1],
            [-1,  -2],            [this.cols,     -2],
            [-1,  Math.floor(this.rows / 2)], [this.cols, Math.floor(this.rows / 2)],
            [q,   this.rows + 1], [3 * q, this.rows + 1],
        ];
        const offset = (n + 1) % 2;
        return pool.slice(offset, Math.min(n + offset, 9));
    }

    /**
     * Find a safe spawn position for an extra warder.
     * Returns false if the warder cap (9) has already been reached.
     */
    getSpawnPosition() {
        if (game.level.warderCount >= MAX_WARDERS) return false;

        function squaredDist(p1, p2) {
            return (p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2;
        }

        const halfCols = Math.floor(this.cols / 2);

        /** Walk left/right from pos0 until a position far enough from all warders. */
        const findClearPos = (pos0) => {
            const n = game.level.warderCount;
            for (let l = 0; l < halfCols; l++) {
                for (const dx of [-1, 1]) {
                    const candidate = [pos0[0] + l * dx, pos0[1]];
                    let i = 0;
                    while (i < n && squaredDist(game.level.warders[i].pos(), candidate) >= 4) i++;
                    if (i >= n) return candidate;
                }
            }
            return pos0;
        };

        const candidatePositions = [
            [halfCols, this.rows + 1],
            [halfCols, -2],
        ];
        const cursorPos = game.cursor.pos();
        const start = squaredDist(candidatePositions[0], cursorPos) >
                      squaredDist(candidatePositions[1], cursorPos)
            ? candidatePositions[0] : candidatePositions[1];

        return findClearPos(start);
    }

    // ── Trail management ─────────────────────────────────────────────────────

    /**
     * Compute the neighbouring cells in directions relative to `dir`.
     * @param {number[]} angleOffsets - Offsets added to `dir` to derive each neighbour's angle.
     * @returns {Array} Each entry is [nx, ny, angle, cellValue].
     */
    getAdjacentCells(x, y, dir, angleOffsets) {
        return angleOffsets.map(offset => {
            const angle    = (dir + offset + 360) % 360;
            const [vx, vy] = dirs.get(angle);
            const nx = x + vx, ny = y + vy;
            return [nx, ny, angle, this.cellValue(nx, ny)];
        });
    }

    /** Mark cell (x, y) as part of the trail and update trail bookkeeping. */
    addToTrail(x, y, dir) {
        const i = this.setCellFlag(x, y, CELL_TRAIL);
        if (i < 0) return;

        const n = this.trail.length;
        if (!n || dir !== this.trailDirection) {
            const nodeIndex = n ? this.trail[n - 1] : i;
            if (!n || nodeIndex !== this.trailNodes[this.trailNodes.length - 1])
                this.trailNodes.push(nodeIndex);
            if (!n) {
                // Record the cell just before the trail so we can detect if the
                // cursor comes back to where it started (which would be a collision).
                const before = this.getAdjacentCells(x, y, dir, [180]);
                this.preTrailCellIndex = this.cellIndex(before[0][0], before[0][1]);
            }
        }

        this.trail.push(i);
        this.trailDirection = dir;
    }

    /**
     * Return the bounding rectangle [x, y, w, h] of the last trail segment
     * (from the second-to-last node to the current trail tip).
     */
    getLastTrailRect() {
        const [x0, y0] = this.cellPos(this.trailNodes[this.trailNodes.length - 1]);
        const [x1, y1] = this.cellPos(this.trail[this.trail.length - 1]);
        return [
            Math.min(x0, x1), Math.min(y0, y1),
            Math.abs(x0 - x1) + 1, Math.abs(y0 - y1) + 1,
        ];
    }

    /**
     * Return an array of [x, y, w, h] rects covering all trail segments.
     */
    getAllTrailRects() {
        if (!this.trail.length) return [];
        const rects = [];
        const nodes = this.trailNodes;
        const tip   = this.trail[this.trail.length - 1];
        // Each segment: from nodes[i] to nodes[i+1], last segment: nodes[last] to tip.
        for (let i = 0; i < nodes.length; i++) {
            const [x0, y0] = this.cellPos(nodes[i]);
            const endIdx   = i + 1 < nodes.length ? nodes[i + 1] : tip;
            const [x1, y1] = this.cellPos(endIdx);
            rects.push([
                Math.min(x0, x1), Math.min(y0, y1),
                Math.abs(x0 - x1) + 1, Math.abs(y0 - y1) + 1,
            ]);
        }
        return rects;
    }

    /**
     * Clear all trail state.
     * @param {boolean} clearGraphics - When true (tank mode) each trail cell is
     *   also marked as conquered and erased on the canvas.
     */
    resetTrail(clearGraphics = false) {
        for (let i = 0; i < this.trail.length; i++) {
            const idx  = this.trail[i];
            const prev = this.cells[idx];
            this.cells[idx] &= ~CELL_TRAIL;

            const [x, y] = this.cellPos(idx);
            if (clearGraphics) {
                if (!(prev & CELL_CLEARED)) {
                    this.cells[idx] |= CELL_CLEARED;
                    this.conqueredCount++;
                }
                game.state.clearCells(x, y);
            } else {
                // Always fill with default color to erase trail
                game.state.fillCells(game.config.colorEmpty, x, y);
            }
        }
        this.trailRects = [];
        this.trail = [];
        this.trailNodes = [];
    }

    /** Return the index of the cell just before the trail (used for collision detection). */
    getPreTrailCellIndex() {
        return this.preTrailCellIndex;
    }

    /**
     * Remove the last cell from the trail (cursor is retracing backward).
     * Clears the CELL_TRAIL flag, repaints the cell, and updates trailNodes.
     */
    popTrailCell() {
        if (!this.trail.length) return;

        const removedIdx = this.trail.pop();
        this.cells[removedIdx] &= ~CELL_TRAIL;
        const [rx, ry] = this.cellPos(removedIdx);
        game.state.fillCells(game.config.colorEmpty, rx, ry);

        if (this.trail.length === 0) {
            this.trailNodes = [];
            this.trailDirection = 0;
        } else {
            // Pop last node if it now equals the new trail tip (was start-of-segment
            // for the segment we just removed the last cell from).
            if (this.trailNodes.length > 1 &&
                this.trailNodes[this.trailNodes.length - 1] === this.trail[this.trail.length - 1]) {
                this.trailNodes.pop();
            }
            // Recompute direction from last two remaining trail cells.
            if (this.trail.length >= 2) {
                const [x1, y1] = this.cellPos(this.trail[this.trail.length - 2]);
                const [x2, y2] = this.cellPos(this.trail[this.trail.length - 1]);
                this.trailDirection = dirs.find(x2 - x1, y2 - y1) || this.trailDirection;
            }
        }
    }

    // ── Conquest ─────────────────────────────────────────────────────────────

    /**
     * Attempt to conquer all regions enclosed by the current trail.
     * @param {Array<[number,number]>} checkPoints - Grid coordinates to test for
     *   containment in conquered rectangles.
     * @returns {boolean[]} One entry per checkPoint: true if that point was inside
     *   a conquered rectangle.
     */
    conquerRegions(checkPoints = []) {
        const trailLen = this.trail.length;
        if (!trailLen) {
            this.lastConquerRectCount = 0;
            return new Array(checkPoints.length).fill(false);
        }

        if (trailLen > 1) this.trailNodes.push(this.trail[trailLen - 1]);

        const savedTrail = this.trail.slice();
        const rects = this._findConquerRects();
        this.trail      = [];
        this.trailNodes = [];

        if (!rects || !rects.length) {
            this.lastConquerRectCount = 0;
            // Still must strip CELL_TRAIL from all trail cells so they don't
            // cause false collisions when the cursor revisits them.
            for (const idx of savedTrail) {
                this.cells[idx] &= ~CELL_TRAIL;
                if (!(this.cells[idx] & CELL_CLEARED)) {
                    this.cells[idx] |= CELL_CLEARED;
                    this.conqueredCount++;
                }
                const [tx, ty] = this.cellPos(idx);
                game.state.clearCells(tx, ty, 1, 1);
            }
            return new Array(checkPoints.length).fill(false);
        }

        const pointInside = new Array(checkPoints.length).fill(false);
    this.lastConquerRectCount = rects.length;

        for (const rect of rects) {
            const [rx, ry, rw, rh] = rect;

            for (let p = 0; p < checkPoints.length; p++) {
                if (!pointInside[p]) {
                    const [px, py] = checkPoints[p];
                    if (px >= rx && px < rx + rw && py >= ry && py < ry + rh)
                        pointInside[p] = true;
                }
            }

            for (let x = 0; x < rw; x++) {
                for (let y = 0; y < rh; y++) {
                    const cx = rx + x, cy = ry + y;
                    if (this.cellValue(cx, cy) & CELL_CLEARED) continue;
                    this.setCell(cx, cy, CELL_CLEARED);
                    this.conqueredCount++;
                }
            }
            game.state.clearCells(...rect);
        }

        // Strip CELL_TRAIL from trail cells and repaint them cleared.
        for (const idx of savedTrail) {
            if (this.cells[idx] & CELL_TRAIL) {
                this.cells[idx] &= ~CELL_TRAIL;
                if (!(this.cells[idx] & CELL_CLEARED)) {
                    this.cells[idx] |= CELL_CLEARED;
                    this.conqueredCount++;
                }
                const [tx, ty] = this.cellPos(idx);
                game.state.clearCells(tx, ty, 1, 1);
            }
        }

        return pointInside;
    }

    /**
     * Return [minX, maxX] of the column range that still has unconquered cells,
     * or null if the whole field is cleared.
     */
    getActiveColumnRange() {
        let minX = -1, maxX = -1;
        for (let x = 0; x < this.cols; x++) {
            for (let y = 0; y < this.rows; y++) {
                if (!(this.cellValue(x, y) & CELL_CLEARED)) {
                    if (minX === -1) minX = x;
                    maxX = x;
                    break;
                }
            }
        }
        return minX === -1 ? null : [minX, maxX];
    }

    /** Percentage of playfield cells that have been conquered. */
    getConqueredPercent() {
        return this.conqueredCount / (this.cols * this.rows) * 100;
    }

    // ── Internal conquest algorithms ─────────────────────────────────────────

    /**
     * Flood-fill conquest algorithm.
     * 1. Pre-mark CLEARED + TRAIL cells as visited.
     * 2. In normal mode, BFS from each ball to mark its reachable region as visited
     *    (excluded from conquest). In tank/sneaky mode this step is skipped so every
     *    unvisited region is conquered unconditionally.
     * 3. All remaining unvisited components are conquered. Balls that end up on
     *    cleared cells are handled by the isBallExiled mechanism in Enemy.update().
     * Always returns an array (never false).
     */
    _findConquerRects() {
        const { cols, rows } = this;
        const visited = new Uint8Array(this.cells.length);
        const balls = game.level.balls;

        // Step 1: Pre-mark cleared and trail cells as visited.
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const i = this.cellIndex(x, y);
                if (this.cells[i] & (CELL_CLEARED | CELL_TRAIL)) visited[i] = 1;
            }
        }

        // Step 2: BFS from each ball to mark its reachable region visited (those
        // regions won't be conquered). Tank mode skips this for immediate full conquer.
        if (!game.level.tankMode) {
            for (const ball of balls) {
                const bi = this.cellIndex(ball.x, ball.y);
                if (bi < 0 || visited[bi]) continue;
                visited[bi] = 1;
                const queue = [[ball.x, ball.y]];
                for (let qi = 0; qi < queue.length; qi++) {
                    const [cx, cy] = queue[qi];
                    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                        const nx = cx + dx, ny = cy + dy;
                        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
                        const ni = this.cellIndex(nx, ny);
                        if (visited[ni]) continue;
                        visited[ni] = 1;
                        queue.push([nx, ny]);
                    }
                }
            }
        }

        // Step 3: All remaining unvisited components — conquer all of them.
        const rects = [];
        for (let sy = 0; sy < rows; sy++) {
            for (let sx = 0; sx < cols; sx++) {
                const si = this.cellIndex(sx, sy);
                if (visited[si]) continue;

                const region = [];
                const queue  = [[sx, sy]];
                visited[si]  = 1;

                for (let qi = 0; qi < queue.length; qi++) {
                    const [cx, cy] = queue[qi];
                    region.push(cx, cy);
                    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                        const nx = cx + dx, ny = cy + dy;
                        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
                        const ni = this.cellIndex(nx, ny);
                        if (visited[ni]) continue;
                        visited[ni] = 1;
                        queue.push([nx, ny]);
                    }
                }

                const byRow = new Map();
                for (let i = 0; i < region.length; i += 2) {
                    const rx = region[i], ry = region[i + 1];
                    if (!byRow.has(ry)) byRow.set(ry, []);
                    byRow.get(ry).push(rx);
                }
                for (const [ry, xs] of byRow) {
                    xs.sort((a, b) => a - b);
                    let start = xs[0], len = 1;
                    for (let i = 1; i <= xs.length; i++) {
                        if (i < xs.length && xs[i] === start + len) {
                            len++;
                        } else {
                            rects.push([start, ry, len, 1]);
                            if (i < xs.length) { start = xs[i]; len = 1; }
                        }
                    }
                }
            }
        }

        return rects;
    }

    /** Build rectangles covering the current trail line segments. */
    _buildTrailRectangles() {
        if (this.trailNodes.length === 1) this.trailNodes.push(this.trailNodes[0]);
        const rects = [];
        for (let i = 0; i < this.trailNodes.length - 1; i++) {
            const [x0, y0] = this.cellPos(this.trailNodes[i]);
            const [x1, y1] = this.cellPos(this.trailNodes[i + 1]);
            rects.push([
                Math.min(x0, x1), Math.min(y0, y1),
                Math.abs(x0 - x1) + 1, Math.abs(y0 - y1) + 1,
            ]);
        }
        return rects;
    }

    /**
     * @deprecated No longer used — kept for reference only.
     * Decompose the polygon described by `outline` (array of cell indices) into
     * axis-aligned rectangles.  Returns false if the polygon contains a ball.
     */
    _buildOutlineRectangles(outline) {
        const containsBall = (rect) => {
            const [x1, y1, w, h] = rect;
            for (const ball of game.level.balls) {
                if (ball.x >= x1 && ball.x < x1 + w &&
                    ball.y >= y1 && ball.y < y1 + h) return true;
            }
            return false;
        };

        if (outline.length < 4) return false;
        let pts = this.indicesToPositions(outline);
        let n   = pts.length;

        if (n > 4 && n % 2 !== 0) {
            const b1 = pts[0][0] === pts[n - 1][0];
            if (b1 ^ (pts[0][1] === pts[n - 1][1])) {
                let b2 = pts[n - 2][0] === pts[n - 1][0];
                if (!(b2 ^ b1) && (b2 ^ (pts[n - 2][1] === pts[n - 1][1]))) pts.pop();
                b2 = pts[0][0] === pts[1][0];
                if (!(b2 ^ b1) && (b2 ^ (pts[0][1] === pts[1][1]))) pts.shift();
            }
            n = pts.length;
            const b1n = pts[0][0] === pts[1][0], b2n = pts[1][0] === pts[2][0];
            if (!(b1n ^ b2n) && (b1n ^ (pts[0][1] === pts[1][1])) && (b2n ^ (pts[1][1] === pts[2][1])))
                pts.shift();
        }

        if (pts.length % 2 !== 0) return false;

        const rects = [];
        for (let iter = 0; iter < 10 && pts.length > 4; iter++) {
            n = pts.length;
            let bestDim1 = 0, bestDim2 = 0, iBase = 0, iCoord = 0;
            let pB1, pB2, pT1, pT2;

            for (let i = 0; i < n; i++) {
                pB1 = pts[i]; pB2 = pts[(i + 1) % n];
                pT1 = pts[(i - 1 + n) % n]; pT2 = pts[(i + 2) % n];

                const outDir   = dirs.find(pT1[0] - pB1[0], pT1[1] - pB1[1]);
                if (outDir !== dirs.find(pT2[0] - pB2[0], pT2[1] - pB2[1])) continue;

                const edgeDir  = Math.floor((dirs.find(pB2[0] - pB1[0], pB2[1] - pB1[1]) + outDir) / 2);
                const [vx, vy] = dirs.get(edgeDir - edgeDir % 45);
                if (this.cellValue(pB1[0] + vx, pB1[1] + vy) & CELL_CLEARED) continue;

                let found = false, k = -1, w = 0;
                let t = Math.abs(pB1[0] - pB2[0]);
                if (t > bestDim1) { found = true; k = 0; w = t; }
                t = Math.abs(pB1[1] - pB2[1]);
                if (t > bestDim1) { found = true; k = 1; w = t; }
                if (!found) continue;

                const k2  = (k + 1) % 2;
                const [dvx, dvy] = dirs.get(outDir);
                const sgn = k2 === 0 ? dvx : dvy;
                const co2 = pB1[k2];
                const left  = Math.min(pB1[k], pB2[k]);
                const right = Math.max(pB1[k], pB2[k]);
                const minH  = Math.min(sgn * (pT1[k2] - co2), sgn * (pT2[k2] - co2));

                let j = i % 2;
                for (; j < n; j += 2) {
                    if (j === i) continue;
                    const p = pts[j], p2 = pts[(j + 1) % n];
                    const dh = sgn * (p[k2] - co2);
                    if (p[k2] === p2[k2] && dh >= 0 && dh < minH &&
                        p[k]  > left && p[k]  < right &&
                        p2[k] > left && p2[k] < right) break;
                }
                if (j < n) continue;

                bestDim1 = w;
                bestDim2 = sgn * minH;
                iBase    = i;
                iCoord   = k;
            }

            const iB2 = (iBase + 1) % n;
            const iT1 = (iBase - 1 + n) % n;
            const iT2 = (iBase + 2) % n;
            pB1 = pts[iBase]; pB2 = pts[iB2];
            pT1 = pts[iT1];   pT2 = pts[iT2];

            const dim = [0, 0], pos0 = [0, 0];
            const c2 = (iCoord + 1) % 2;
            dim[iCoord] = bestDim1;
            dim[c2]     = bestDim2;
            pos0[iCoord] = Math.min(pB1[iCoord], pB2[iCoord]);
            pos0[c2]     = Math.min(pB1[c2], pB2[c2]) + (dim[c2] < 0 ? dim[c2] : 0);

            const rect = [pos0[0], pos0[1], Math.abs(dim[0]) + 1, Math.abs(dim[1]) + 1];
            const shrinkC = Math.abs(pT1[c2] - pB1[c2]) === Math.abs(bestDim2);

            if (containsBall(rect)) return false;
            rects.push(rect);

            if (shrinkC) {
                pB2[c2] += bestDim2;
                pts.splice(iBase, 1);
                pts.splice(iT1 < iBase ? iT1 : iT1 - 1, 1);
            } else {
                pB1[c2] += bestDim2;
                pts.splice(iT2, 1);
                pts.splice(iB2 < iT2 ? iB2 : iB2 - 1, 1);
            }
        }

        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        const rx = Math.min(...xs), ry = Math.min(...ys);
        const finalRect = [rx, ry, Math.max(...xs) - rx + 1, Math.max(...ys) - ry + 1];
        if (containsBall(finalRect)) return false;
        rects.push(finalRect);
        return rects;
    }
}
