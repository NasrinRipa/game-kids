// The cursor implemented as a class
export class Cursor {
    constructor() {
        this.x = 0; // current x coordinate
        this.y = 0; // current y coordinate
        this.x0 = 0; // previous x coordinate
        this.y0 = 0; // previous y coordinate
        this.dir = false; // current movement direction (angle in degrees)
        this.onTrail = false; // current state (true - trial)
        this.onTrail0 = false; // previous state
        this._tankTrailConverted = false; // when in tank mode, whether existing trail cells were converted to cleared
    }

    // reset the cursor position:
    reset(x, y, bUnlock) {
        var bPre = bUnlock && window.cellset.value(this.x, this.y) & window.CA_CLEAR;
        this.x0 = bPre? this.x : x;
        this.y0 = bPre? this.y : y;
        this.x = x;
        this.y = y;
        this.dir = this.onTrail = this.onTrail0 = false;
    }

    // update current position - move by given distance:
    update(dist) {
        if (this.dir === false) return;
        // local refs
        var cs = window.cellset;
        var gs = window.gs;
        var ls = window.ls;
        var tank = ls && ls.tankmode;

        var x = this.x, y = this.y;
        var vec = window.var_dirset.get(this.dir), vecX = vec[0], vecY = vec[1];
        var bEnd = false;

        // Ensure dist is a non-negative integer
        dist = Math.max(0, Math.floor(dist));


        for (var n = 0; n < dist; n++) {
            var nx = x + vecX, ny = y + vecY;
            if (cs.index(nx, ny) < 0) {
                // out of valid grid — stop movement
                this.dir = false; break;
            }

            // Inspect the next cell before committing the move
            var nextVal = cs.value(nx, ny);
            var nextCleared = Boolean(nextVal & window.CA_CLEAR);
            var nextTrail = Boolean(nextVal & window.CA_TRAIL);

            if (tank) {
                // Tank mode behavior:
                // - If next cell is cleared: finalize/conquer current trail
                // - If next cell is a trail cell (crossing): finalize/conquer
                // - Otherwise (regular cell): elongate trail, and convert trail cells to cleared
                if (nextCleared) {
                    if (this.onTrail) {
                        // finalize trail — let post-loop logic handle conquer
                        bEnd = true;
                        break;
                    }
                    // moving into an already cleared cell when not on a trail: just move
                    x = nx; y = ny;
                    // mark the new cell cleared (tank clears as it moves)
                    if (!(cs.value(x, y) & window.CA_CLEAR)) {
                        cs.set(x, y, window.CA_CLEAR);
                        window.gs.clearCellArea(x, y, 1, 1);
                        cs.nConquered++;
                        // console.log('Tank mode conquered cell:', x, y);
                    }
                    continue;
                }

                if (nextTrail) {
                    // Crossing own path in tank mode -> finalize trail / conquer
                    if (this.onTrail) {
                        bEnd = true;
                        break;
                    }
                    // If not currently on a trail, treat as normal move into a trail cell
                    // but convert it immediately
                    x = nx; y = ny;
                    if (!(cs.value(x, y) & window.CA_CLEAR)) {
                        cs.set(x, y, window.CA_CLEAR);
                        window.gs.clearCellArea(x, y, 1, 1);
                        cs.nConquered++;
                    }
                    continue;
                }

                // Regular cell in tank mode: elongate trail (so we keep track),
                // but convert existing trail cells to cleared only once.
                cs.add2Trail(nx, ny, this.dir);
                this.onTrail = true;
                // Convert previous trail cells to cleared on first tank move
                if (!this._tankTrailConverted && cs.aTrail.length > 1) {
                    for (var ti = 0; ti < cs.aTrail.length - 1; ti++) {
                        var idx = cs.aTrail[ti];
                        var prev = cs.aCells[idx];
                        if (!(prev & window.CA_CLEAR)) {
                            cs.aCells[idx] |= window.CA_CLEAR;
                            cs.nConquered++;
                            var ppos = cs.pos(idx);
                            window.gs.clearCellArea(ppos[0], ppos[1], 1, 1);
                        }
                    }
                    this._tankTrailConverted = true;
                }
                // Also mark the newly added cell as cleared immediately
                var lastIdx = cs.aTrail[cs.aTrail.length - 1];
                if (lastIdx !== undefined) {
                    var prev2 = cs.aCells[lastIdx];
                    if (!(prev2 & window.CA_CLEAR)) {
                        cs.aCells[lastIdx] |= window.CA_CLEAR;
                        cs.nConquered++;
                        var ppos2 = cs.pos(lastIdx);
                        window.gs.clearCellArea(ppos2[0], ppos2[1], 1, 1);
                    }
                }

                // commit move
                x = nx; y = ny;
                continue;
            } // end tank handling

            // Non-tank mode processing
            if (nextTrail) {
                // Collision with own trail
                gs.bCollision = true;
                break;
            }

            if (nextCleared) {
                // Moving into cleared cell finalizes the trail
                if (this.onTrail) {
                    bEnd = true;
                    break;
                }
                // Not on a trail: just move into cleared cell
                x = nx; y = ny;
                this.onTrail = false;
                continue;
            }

            // Regular non-tank cell: elongate trail
            cs.add2Trail(nx, ny, this.dir);
            this.onTrail = true;
            x = nx; y = ny;
        }

        this.x = x; this.y = y;
        if (!bEnd) return;
        // If we've finalized a trail (either tank or normal), reset tank conversion flag
        this._tankTrailConverted = false;
        // If in tank mode we would have exited earlier; here we're normal mode
        if ((cs.getPreTrailCell() == cs.index(x, y)))
            gs.bCollision = true;
        else {
            this.dir = this.onTrail = false;
            gs.bConquer = true;
        }
    }

    // render current position:
    render() {
        if (this.x0 == this.x && this.y0 == this.y) {
            if (window.gs.tLastFrame) return;
        }
        else {
            if (this.onTrail0) {
                var rect = window.cellset.lastTrailLine();
                // window.gs.fillCellArea.apply(null, [window.gd.cfgMain.colorTrail].concat(rect));
                window.gs.fillCellArea(window.gd.cfgMain.colorTrail,...rect);
            }
            else {
                if (window.cellset.isPosIn(this.x0, this.y0)){
                    window.gs.clearCellArea(this.x0, this.y0);

                }else{
                    var opacity = (window.ls && window.ls.ignoreCollisionBonus)? 0.5 :1
                    window.gs.fillCellArea(window.gd.cfgMain.colorBorder, this.x0, this.y0, opacity);

                }

            }
            this.x0 = this.x; this.y0 = this.y;
        }
        this.onTrail0 = this.onTrail;
        window.gs.drawCellImg(window.var_imgCursor, this.x, this.y);
    }

    // get current position:
    pos() {
        return [this.x, this.y];
    }

    // get current movement direction:
    getDir() {
        return this.dir;
    }

    // set/change movement direction:
    setDir(dir) {
        if (dir === this.dir) return;
        if (this.onTrail && this.dir !== false && dir !== false && Math.abs(dir - this.dir) == 180)
            return;
        this.dir = dir;
    }
}



