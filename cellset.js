// The playing field grid (set of available cells) implemented as a class
export class CellSet {
    constructor() {
        this.nW = 0; // width of image in cells
        this.nH = 0; // height of image in cells
        this.nWx = 0; // width of grid in cells
        this.nConquered = 0; // number of conquered cells
        // this.allConqueredRect = [];
        this.dirTrail = 0; // last direction of the cursor trail (movement)
        this.cellPreTrail = 0; // index of cell preceding the cursor trail cells
        this.aCells = []; // array mapping cell index in the grid to a value indicating type of this cell
        this.aTrail = []; // array of the cursor trail cells' indices
        this.aTrailNodes = []; // array of the cursor trail node cells' indices
        this.aTrailRects = []; // array of rectangles comprising the cursor trail line
        //this.reset();
    }

    reset() {
        this.nW = window.gd.nW;
        this.nH = window.gd.nH;
        var n = (this.nWx = this.nW+4)* (this.nH+4);
        this.nConquered = 0;
        this.aCells = [];
        var aAll = [];
        for (var i = 0; i < n; i++) {
            var pos = this.pos(i), x = pos[0], y = pos[1];
            this.aCells.push(x >= 0 && x < this.nW && y >= 0 && y < this.nH? 0 : window.CA_CLEAR);
            aAll.push(i);
        }
        this.aTrail = [];
        this.aTrailNodes = [];
        this.aTrailRects = [];
        window.gs.fillCellArea(window.gd.cfgMain.colorFill, 0, 0, this.nW, this.nH);
    }

    render() {
        if (this.aTrailRects.length) {
            for (var i = this.aTrailRects.length-1; i >= 0; i--) {
                window.gs.fillCellArea(window.gd.cfgMain.colorFill, ...this.aTrailRects[i]);
                // window.gs.fillCellArea.apply(null, [window.gd.cfgMain.colorFill].concat(this.aTrailRects[i]));
            }
            this.aTrailRects = [];
        }
    }

    isPosIn(x, y) {
        return x >= 0 && x < this.nW && y >= 0 && y < this.nH;
    }

    isPosValid(x, y) {
        return x >= -2 && x < this.nW+2 && y >= -2 && y < this.nH+2;
    }

    // get index of given cell in the grid
    index(x, y) {
        return this.isPosValid(x, y) ? (this.nWx)*(y+2) + x+2 : -1;
    }

    // convert index of a cell to appropriate position (coordinates) in the grid
    pos(i) {
        return [i % this.nWx - 2, Math.floor(i / this.nWx)-2];
    }

    posMap(arr) {
        var _this = this;
        return arr.map(function(v) { return _this.pos(v) });
    }

    value(x, y) {
        var i = this.index(x,y);
        return i >= 0? this.aCells[i] : 0;
    }

    set(x, y, v) {
        var i = this.index(x,y);
        if (i >= 0) this.aCells[i] = v;
        return i;
    }

    setOn(x, y, v) {
        var i = this.index(x,y);
        if (i >= 0) this.aCells[i] |= v;
        return i;
    }

    setOff(x, y, v) {
        var i = this.index(x,y);
        if (i >= 0) this.aCells[i] &= ~v;
        return i;
    }

    placeCursor() {
        return [Math.floor(this.nW/2), -2];
    }

    placeBalls(n) {
        var a = [], ret = [];
        for (var i = 0; i < n; i++) {
            var k;
            do k = Math.floor(Math.random() * this.nW * this.nH);
            while (a.indexOf(k) >= 0);
            a.push(k);
            var x = k % this.nW, y = Math.floor(k / this.nW);
            ret.push([x, y]);
        }
        return ret;
    }

    placeWarders(n) {
        var z;
        var aPos = [
            [Math.floor(this.nW/2), this.nH+1],
            [-1, this.nH+1], [this.nW, this.nH+1], [-1, -2], [this.nW, -2],
            [-1, z = Math.floor(this.nH/2)], [this.nW, z],
            [z = Math.floor(this.nW/4), this.nH+1], [3*z, this.nH+1]
        ];
        var i0 = (n+ 1)% 2;
        return aPos.slice(i0, Math.min(n+ i0, 9));
    }

    placeSpawned() {
        if (window.ls.nWarders >= 9) return false;
        function dist(pos1, pos2) {
            return Math.pow(pos1[0]- pos2[0], 2) + Math.pow(pos1[1]- pos2[1], 2);
        }
        function find(pos0) {
            var n = window.ls.nWarders;
            for (var l = 0; l < x0; l++) {
                for (var dx = -1; dx <= 1; dx+= 2) {
                    var p = [pos0[0]+ l* dx, pos0[1]];
                    for (var i = 0; i < n && dist(window.ls.aWarders[i].pos(), p) >= 4; i++) ;
                    if (i >= n) return p;
                }
            }
            return pos0;
        }
        var x0 = Math.floor(this.nW/2);
        var aPos = [[x0, this.nH+1], [x0, -2]];
        var posCr = window.cursor.pos();
        var posSt = dist(aPos[0], posCr) > dist(aPos[1], posCr)? aPos[0] : aPos[1];
        var ret = find(posSt);
        return ret;
    }

    applyRelDirs(x, y, dir, aDeltas) {
        var ret = [];
        for (var n = aDeltas.length, i = 0; i < n; i++) {
            var d = (dir + aDeltas[i] + 360) % 360;
            var vec = window.var_dirset.get(d), xt, yt;
            ret.push([xt = x + vec[0], yt = y + vec[1], d, this.value(xt, yt)]);
        }
        return ret;
    }

    add2Trail(x, y, dir) {
        var i = this.setOn(x, y, window.CA_TRAIL);
        console.log('add to trail', x, y, i);
        if (i < 0) return;
        var n = this.aTrail.length;
        if (!n || dir !== this.dirTrail) {
            var iNode = n? this.aTrail[n-1] : i;
            if (!n || iNode != this.aTrailNodes[this.aTrailNodes.length-1])
                this.aTrailNodes.push(iNode);
            if (!n) {
                var aPos = this.applyRelDirs(x, y, dir, [180]);
                this.cellPreTrail = this.index(aPos[0][0], aPos[0][1]);
            }
        }
        this.aTrail.push(i);
        this.dirTrail = dir;
    }

    lastTrailLine() {
        var pos0 = this.pos(this.aTrailNodes[this.aTrailNodes.length-1]),
            pos = this.pos(this.aTrail[this.aTrail.length-1]);
        return [
            Math.min(pos[0], pos0[0]), Math.min(pos[1], pos0[1]),
            Math.abs(pos[0] - pos0[0])+1, Math.abs(pos[1] - pos0[1])+1
        ];
    }

    clearTrail(clear_graphics = false) {
        // Clear trail cells first. If clear_graphics is true this means
        // tank mode or forced clearing: mark those cells as conquered
        // (set CA_CLEAR) so enemies treat them as cleared.
        for (var n = this.aTrail.length, i = 0; i < n; i++) {
            var idx = this.aTrail[i];
            // position before we change the cell state
            var pos = this.pos(idx);
            var prev = this.aCells[idx];
            // remove trail flag
            this.aCells[idx] &= ~window.CA_TRAIL;
            if (clear_graphics) {
                // if cell was not already marked clear, mark it and count it
                if (!(prev & window.CA_CLEAR)) {
                    this.aCells[idx] |= window.CA_CLEAR;
                    this.nConquered++;
                }
                window.gs.clearCellArea(pos[0], pos[1], 1, 1);
                console.log('clear trail cell', pos[0], pos[1]);
            }
        }
        // After all cells are cleared, reset trail state
        this.aTrailRects = [];
        this.aTrail = []; this.aTrailNodes = [];
    }

    getPreTrailCell() {
        return this.cellPreTrail;
    }

    // wrapper of conquered regions detection
    conquer(points=[]) {
        var nTrail = this.aTrail.length;
        if (!nTrail) return new Array(points.length).fill(false);
        if (nTrail > 1)
            this.aTrailNodes.push(this.aTrail[nTrail-1]);// add last point as node
        var aConqRects = this._conquer() || this._buildTrailRects();
        this.aTrail = []; this.aTrailNodes = [];
        if (!aConqRects || !aConqRects.length) return new Array(points.length).fill(false);

        // Initialize result array for points
        var pointsInside = new Array(points.length).fill(false);

        for (var n = aConqRects.length, i = 0; i < n; i++) {
            var rect = aConqRects[i];
            var x0 = rect[0], y0 = rect[1], w = rect[2], h = rect[3];

            // Check each point against current rectangle
            for (var p = 0; p < points.length; p++) {
                if (!pointsInside[p]) { // Only check if not already inside
                    var px = points[p][0], py = points[p][1];
                    if (px >= x0 && px < x0 + w && py >= y0 && py < y0 + h) {
                        pointsInside[p] = true;
                    }
                }
            }

            for (var x = 0; x < w; x++) {
                for (var y = 0; y < h; y++) {
                    if (this.value(x + x0, y + y0, window.CA_CLEAR) & window.CA_CLEAR) continue;
                    this.set(x + x0, y + y0, window.CA_CLEAR);
                    this.nConquered++;
                }
            }
        }
        for (i = 0; i < n; i++) {
            window.gs.clearCellArea(...aConqRects[i]);
            // this.allConqueredRect.push(aConqRects[i]);
        }
        aConqRects = [];
        return pointsInside;
    }
    getMinxMaxx(){
        // Return minimum and maximum x (inclusive) for columns that contain
        // at least one unconquered cell. If all cells are conquered return null.
        //
        // This scans columns x=0..nW-1 and checks rows y=0..nH-1 for any cell
        // where the CA_CLEAR bit is NOT set (i.e. unconquered).
        var minX = -1, maxX = -1;
        for (var x = 0; x < this.nW; x++) {
            var colHasUnconquered = false;
            for (var y = 0; y < this.nH; y++) {
                if (!(this.value(x, y) & window.CA_CLEAR)) { // unconquered
                    colHasUnconquered = true;
                    break;
                }
            }
            if (colHasUnconquered) {
                if (minX === -1) minX = x;
                maxX = x;
            }
        }
        return minX === -1 ? null : [minX, maxX];
    }
    getConqueredRatio() {
        return this.nConquered / (this.nW * this.nH) * 100;
    }

    // conquered regions (polygons) detection:
    _conquer() {
        var nTrail = this.aTrail.length, nNodes = this.aTrailNodes.length;
        var aOutlineset = []; // outlines (boundaries) of found regions
        var delta;
        var bClosedTrail = nNodes >= 4 &&
            ((delta = Math.abs(this.aTrailNodes[0] - this.aTrailNodes[nNodes-1])) == 1 || delta == this.nWx);
        if (bClosedTrail) { // if the cursor trail is self-closed
            aOutlineset.push([this.aTrailNodes, 1]);
        }
        var bAddTrailRects = false;
        var posPre = this.pos(this.cellPreTrail), posCr = window.cursor.pos();
        var aDeltas = [-90, 90];
        for (var side = 0; side < 2; side++) {
            delta = aDeltas[side];
            var iLastNode = 0;
            var sum = 0, bNonTangent = false, bEndAtNode = false;
            for (var l = 0; l < nTrail && sum < nTrail; l++) {
                var cellStart = this.aTrail[l];
                var pos = this.pos(cellStart);
                var pos0 = l? this.pos(this.aTrail[l - 1]) : posPre;
                var x = pos[0], y = pos[1];
                var dir = (window.var_dirset.find(x - pos0[0], y - pos0[1]) + delta + 360) % 360;
                var aDirs = bEndAtNode? [] : [dir];
                if (this.aTrailNodes.indexOf(cellStart) >= 0) {
                    var pos2 = l < nTrail - 1? this.pos(this.aTrail[l + 1]) : posCr;
                    dir = (window.var_dirset.find(pos2[0] - x, pos2[1] - y) + delta + 360) % 360;
                    if (dir != aDirs[0]) aDirs.push(dir);
                }
                if (this.aTrail[l] == this.aTrailNodes[iLastNode+1]) ++iLastNode;
                var ret = 0;
                for (var nDs = aDirs.length, j = 0; j < nDs && !ret; j++) {
                    dir = aDirs[j];
                    var vec = window.var_dirset.get(dir);
                    var xt = x + vec[0], yt = y + vec[1];
                    var v = this.value(xt, yt);
                    if (v & window.CA_CLEAR || v & window.CA_TRAIL) continue;
                    ret = this._findOutline(xt, yt, dir, l, iLastNode);
                }
                bEndAtNode = false;
                if (!ret) continue;
                var aNodes = ret[0], len = ret[1], lenTangent = ret[2];
                if (ret.length > 3) {
                    iLastNode = ret[3];
                    l = ret[4];
                    bEndAtNode = ret[5];
                }
                aOutlineset.push([aNodes, len]);
                sum += lenTangent;
                if (!lenTangent) bNonTangent = true;
            }
            if (!sum && !bNonTangent && !bClosedTrail) return false;
            if (sum < nTrail && !bClosedTrail) bAddTrailRects = true;
        }
        if (!aOutlineset.length)
            return false;
        aOutlineset.sort(function (el1, el2) {
            return el1[1] - el2[1];
        });
        var aRects = [], n = aOutlineset.length, bUnbroken = true;
        for (var i = 0; i < (bUnbroken? n-1 : n); i++) {
            ret = this._buildConquerRects(aOutlineset[i][0]);
            if (ret)
                aRects = aRects.concat(ret);
            else
                bUnbroken = false;
        }
        if (!aRects.length)
            return false;
        return bAddTrailRects? aRects.concat(this._buildTrailRects()) : aRects;
    }

    // find outline of conquered region (polygon)
    //  from given cell position (x0, y0) and starting direction (dir)
    //  as well as indices of starting cell and last node cell in the trail:
    _findOutline(x0, y0, dir, iStartCell, iLastNode) {
        function isClear(arr) {
            return arr[3] & window.CA_CLEAR;
        }
        var aNodes = [], aUniqNodes = [], aUsedDirs = [], aBackDirs = [];
        var x = x0, y = y0,
            lim = 6 * (this.nW + this.nH), n = 0, bClosed = false;
        do {
            bClosed = n && x == x0 && y == y0;
            var cellCurr = this.index(x,y), iUniq = aUniqNodes.indexOf(cellCurr);
            var aCurrUsed = iUniq >= 0? aUsedDirs[iUniq] : [];
            var aCurrBack = iUniq >= 0? aBackDirs[iUniq] : [];
            var aPosOpts = this.applyRelDirs(x,y, dir, [-90, 90, 0]);
            var aTestDirs = [180+45, -45, 45, 180-45, -45, 45];
            var aPassIdx = [], aPassWeight = [];
            for (var i = 0; i < 3; i++) {
                var d = aPosOpts[i][2];
                if (aCurrUsed.indexOf(d) >= 0) continue;
                if (isClear(aPosOpts[i])) continue;
                var aTestOpts = this.applyRelDirs(x,y, dir, aTestDirs.slice(i*2,i*2+2));
                var b1 = isClear(aTestOpts[0]), b2 = isClear(aTestOpts[1]);
                var b = b1 || b2 || (i == 2? isClear(aPosOpts[0]) || isClear(aPosOpts[1]) : isClear(aPosOpts[2]));
                if (!b) continue;
                aPassIdx.push(i);
                aPassWeight.push(
                    (b1 && b2? 0 : b1 || b2? 1 : 2) + (aCurrBack.indexOf(d) >= 0? 3 : 0)
                );
            }
            var nPass = aPassIdx.length;
            var min = false, idx = false;
            for (i = 0; i < nPass; i++) {
                if (!i || aPassWeight[i] < min) {
                    min = aPassWeight[i]; idx = aPassIdx[i];
                }
            }
            var pos = nPass? aPosOpts[idx] : this.applyRelDirs(x,y, dir, [180])[0];
            var dir0 = dir;
            x = pos[0]; y = pos[1]; dir = pos[2];
            if (pos[2] == dir0) continue;
            nPass? aNodes.push(cellCurr) : aNodes.push(cellCurr, cellCurr);
            dir0 = (dir0 + 180) % 360;
            if (iUniq < 0) {
                aUniqNodes.push(cellCurr);
                aUsedDirs.push([dir]);
                aBackDirs.push([dir0]);
            }
            else {
                aUsedDirs[iUniq].push(dir);
                aBackDirs[iUniq].push(dir0);
            }
        }
        while (n++ < lim && !(this.value(x, y) & window.CA_TRAIL));
        if (!(n < lim)) return false;
        if (bClosed) {
            aNodes.push(cellCurr);
            if (aNodes[0] != (cellCurr = this.index(x0,y0))) aNodes.unshift(cellCurr);
            var nNodes = aNodes.length;
            if (nNodes % 2 && aNodes[0] == aNodes[nNodes-1]) aNodes.pop();
            return [aNodes, n+1, 0];
        }
        var cellStart = this.aTrail[iStartCell], cellEnd = this.index(x,y);
        aNodes.push(cellEnd);
        var nTrail = this.aTrail.length;
        var aTangentNodes = [cellStart];
        for (var l = iStartCell+1; l < nTrail && this.aTrail[l] != cellEnd; l++) {
            if (this.aTrail[l] == this.aTrailNodes[iLastNode+1])
                aTangentNodes.push(this.aTrailNodes[++iLastNode]);
        }
        var bEndAtNode = this.aTrail[l] == this.aTrailNodes[iLastNode+1];
        if (bEndAtNode) l++;
        var lenTangent = l - iStartCell;
        return [
            aNodes.concat(aTangentNodes.reverse()), n+1+lenTangent, lenTangent,
            iLastNode, l, bEndAtNode
        ];
    }

    // break the cursor trail line into a set of rectangles:
    _buildTrailRects() {
        if (this.aTrailNodes.length == 1)
            this.aTrailNodes.push(this.aTrailNodes[0]);
        var aRects = [];
        for (var n = this.aTrailNodes.length, i = 0; i < n-1; i++) {
            var pos1 = this.pos(this.aTrailNodes[i]), pos2 = this.pos(this.aTrailNodes[i+1]);
            var x0 = Math.min(pos1[0], pos2[0]), y0 = Math.min(pos1[1], pos2[1]);
            var w = Math.max(pos1[0], pos2[0]) - x0 + 1, h = Math.max(pos1[1], pos2[1]) - y0 + 1;
            var rect = [x0, y0, w, h];
            aRects.push(rect);
        }
        return aRects;
    }

    // break region specified by its outline into a set of rectangles:
    _buildConquerRects(aOutline) {
        // checks if rectangle contains at least one ball (enemy):
        function containBall(rect) {
            var x1 = rect[0], x2 = x1+ rect[2] - 1;
            var y1 = rect[1], y2 = y1+ rect[3] - 1;
            for (var i = 0; i < window.ls.nBalls; i++) {
                var o = window.ls.aBalls[i], x = o.x, y = o.y;
                if (x >= x1 && x <= x2 && y >= y1 && y <= y2) return true;
            }
            return false;
        }
        if (aOutline.length < 4) return false;
        var aNodes = this.posMap(aOutline);
        var n = aNodes.length;
        if (n > 4 && n % 2 != 0) {
            var b1 = aNodes[0][0] == aNodes[n-1][0], b2;
            if (b1 ^ aNodes[0][1] == aNodes[n-1][1]) {
                b2 = aNodes[n-2][0] == aNodes[n-1][0];
                if (!(b2 ^ b1) && b2 ^ aNodes[n-2][1] == aNodes[n-1][1])
                    aNodes.pop();
                b2 = aNodes[0][0] == aNodes[1][0];
                if (!(b2 ^ b1) && b2 ^ aNodes[0][1] == aNodes[1][1])
                    aNodes.shift();
            }
            b1 = aNodes[0][0] == aNodes[1][0]; b2 = aNodes[1][0] == aNodes[2][0];
            if (!(b1 ^ b2) && b1 ^ aNodes[0][1] == aNodes[1][1] && b2 ^ aNodes[1][1] == aNodes[2][1])
                aNodes.shift();
        }
        if (aNodes.length % 2 != 0) return false;
        var aRects = [];
        for (var l = 0; l < 10 && aNodes.length > 4; l++) {
            n = aNodes.length;
            var dim1 = 0, dim2 = 0, iBase = 0, iCo = 0;
            var posB1, posB2, posT1, posT2;
            for (var i = 0; i < n; i++) {
                posB1 = aNodes[i]; posB2 = aNodes[(i+1)%n];
                posT1 = aNodes[(i-1+n)%n]; posT2 = aNodes[(i+2)%n];
                var dir = window.var_dirset.find(posT1[0]-posB1[0], posT1[1]-posB1[1]);
                if (dir != window.var_dirset.find(posT2[0]-posB2[0], posT2[1]-posB2[1])) continue;
                var dirTest = Math.floor((window.var_dirset.find(posB2[0]-posB1[0], posB2[1]-posB1[1])+ dir) / 2);
                var vec = window.var_dirset.get(dirTest - dirTest% 45);
                // pass x and y as separate arguments (was passing an array by mistake)
                if (this.value(posB1[0] + vec[0], posB1[1] + vec[1]) & window.CA_CLEAR) continue;
                var b = false, t, w, k;
                if ((t = Math.abs(posB1[0]-posB2[0])) > dim1) {
                    b = true; k = 0; w = t;
                }
                if ((t = Math.abs(posB1[1]-posB2[1])) > dim1) {
                    b = true; k = 1; w = t;
                }
                if (!b) continue;
                var k2 = (k+1)%2;
                vec = window.var_dirset.get(dir);
                var sgn = vec[k2];
                var co2 = posB1[k2];
                var left = Math.min(posB1[k], posB2[k]), right = Math.max(posB1[k], posB2[k]);
                var min = Math.min(sgn* (posT1[k2]- co2), sgn* (posT2[k2]- co2));
                for (var j = i% 2; j < n; j+= 2) {
                    if (j == i) continue;
                    var pos = aNodes[j], pos2 = aNodes[(j+1)%n], h;
                    if (pos[k2] == pos2[k2] && (h = sgn*(pos[k2]- co2)) >= 0 && h < min &&
                        pos[k] > left && pos[k] < right && pos2[k] > left && pos2[k] < right)
                        break;
                }
                if (j < n) continue;
                dim1 = w; dim2 = sgn*min;
                iBase = i; iCo = k;
            }
            var iB2 = (iBase+1)%n, iT1 = (iBase-1+n)%n, iT2 = (iBase+2)%n;
            posB1 = aNodes[iBase];
            posB2 = aNodes[iB2];
            posT1 = aNodes[iT1];
            posT2 = aNodes[iT2];
            var aDim = [0, 0], pos0 = [];
            var iCo2 = (iCo+1)%2;
            aDim[iCo] = dim1;
            aDim[iCo2] = dim2;
            pos0[iCo] = Math.min(posB1[iCo], posB2[iCo]);
            pos0[iCo2] = Math.min(posB1[iCo2], posB2[iCo2]) + (aDim[iCo2] < 0? aDim[iCo2]: 0);
            var rect = [pos0[0], pos0[1], Math.abs(aDim[0])+1, Math.abs(aDim[1])+1];
            var bC = Math.abs(posT1[iCo2] - posB1[iCo2]) == Math.abs(dim2);
            if (containBall(rect)) return false;
            aRects.push(rect);
            if (bC) {
                posB2[iCo2] += dim2;
                aNodes.splice(iBase,1);
                aNodes.splice(iT1 < iBase? iT1 : iT1-1, 1);
            }
            else {
                posB1[iCo2] += dim2;
                aNodes.splice(iT2,1);
                aNodes.splice(iB2 < iT2? iB2 : iB2-1, 1);
            }
        }
        var aX = aNodes.map(function(v) {return v[0]});
        var aY = aNodes.map(function(v) {return v[1]});
        var x0 = Math.min.apply(null, aX);
        var y0 = Math.min.apply(null, aY);
        rect = [x0, y0, Math.max.apply(null, aX)-x0+1, Math.max.apply(null, aY)-y0+1];
        if (containBall(rect)) return false;
        aRects.push(rect);
        return aRects;
    }
}

