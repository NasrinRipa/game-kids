import { Enemy } from './enemy.js';
import { BonusItem } from './bonus.js';
import { CellSet } from './cellset.js';
import { Cursor } from './cursor.js';

export class GameDef {
    constructor() {
        console.log('Creating Game definition');
        this.sizeCell = 10;
        this.aLevels =  [
                        {"image": "pic1.png"},
                        {"image": "pic2.png"},
                        {"image": "pic3.png"}
                        ];

        this.cfgMain = {
            width: 600,
            height: 400,
            sizeCell: 10,
            colorFill: '#000000',
            colorBorder: '#00aaaa',
            colorBall: '#ffffff',
            colorBallIn: '#000000',
            colorWarder: '#000000',
            colorWarderIn: '#f80000',
            colorCursor: '#aa00aa',
            colorCursorIn: '#00aaaa',
            colorTrail: '#a800a8',
            timeoutCollision: 1000,
            callback: null,
            callbackOnFrame: false,
            collisionAdjacent: false
        };
        };
        // property to return nH = height  / cell size
    get nH() {
        return Math.floor(this.cfgMain.height / this.cfgMain.sizeCell);
    }
    get nW(){
        return Math.floor(this.cfgMain.width / this.cfgMain.sizeCell);
    }

}

export class LevelState{
    constructor(iLevel) {
        this.iLevel = iLevel;
        this.nBalls = 5;
        this.nWarders = 1;
        this.target_area = 80;
        this.speedEnemy = 10;
        this.speedEnemyReduce = 0;
        this.ignoreCollisionBonus = false;
        this.aBalls = [];
        this.aWarders = [];
        this.tankmode = false;

        };
        get_image(onload, onerror){
            var img = new Image();
            img.onload = onload ;
            img.onerror = onerror;
            img.src = 'pics/pic' + this.iLevel + '.png';
            return img;}
        loadImgwithLevel(){
            var img = new Image();
            img.onload = function(){window.gs.applyLevel(img)} ;
            img.onerror = function(){console.log('Error loading Image')};
            img.src = 'pics/pic' + this.iLevel + '.png';
        }
    }


export class GameState {
    constructor(gamedef) {
        // for system
        console.log('Constructing GameState');
        this.nLevels = gamedef.aLevels.length;
        this.iLevel = 0;
        this.tLevel = 0;
        this.nTimeLevel = 0;
        this.nTimeTotal = 0;
        this.bStarted = false;
        this.bPlay = false;
        this.bConquer = false;
        this.bCollision = false;
        // runtime frame/timer fields
        this.idFrame = 0;
        this.tLastFrame = 0;
        this.tLocked = 0;
        // for player
        this.score = 0;
        this.level = 0;
        this.speedCursor = 15;
        this.speedBonus = 0;
        this.nFaults = 3;
        this.ctxMain = null;
        this.ctxPic = null;
        }

     // global graphics functions
    fillCanvas() {
        const width = window.gd.cfgMain.width;
        const height = window.gd.cfgMain.height;
        const sizeCell = window.gd.cfgMain.sizeCell;
        this.ctxMain.fillStyle = window.gd.cfgMain.colorBorder;
        this.ctxMain.fillRect(0, 0, width+ 4*sizeCell, height+ 4*sizeCell);
        }

    drawCellImg(img, x, y) {
        const sizeCell = window.gd.cfgMain.sizeCell;
        this.ctxMain.drawImage(img,
            0, 0, sizeCell, sizeCell,
            (x+2)*sizeCell, (y+2)*sizeCell, sizeCell, sizeCell
        );
    }

    clearCellArea(x, y, w, h) {
        const sizeCell = window.gd.cfgMain.sizeCell;
        this.ctxMain.clearRect(
            (x+2)*sizeCell, (y+2)*sizeCell, (w || 1)* sizeCell, (h || 1)* sizeCell
        );
    }

    fillCellArea(color, x, y, w, h, opacity=1) {
        const sizeCell = window.gd.cfgMain.sizeCell;
        if(!this){
            console.log('Context NOT FOUND')
        }
        if (opacity != 1) this.ctxMain.globalAlpha = opacity;
        this.ctxMain.fillStyle = color;
        this.ctxMain.fillRect(
            (x+2)*sizeCell, (y+2)*sizeCell, (w || 1)* sizeCell, (h || 1)* sizeCell
        );
        if (opacity != 1) this.ctxMain.globalAlpha = 1;
    }

    create_imgbg(){
        var width = window.gd.cfgMain.width;
        var height = window.gd.cfgMain.height;
        var sizeCell = window.gd.cfgMain.sizeCell;
        var canvas = document.createElement('canvas');
        this.ctxPic = canvas.getContext('2d');
        console.log('Creating background image canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.style.position = 'absolute';
        canvas.style.left = canvas.style.top = (2*sizeCell) + 'px';
        this.ctxPic.fillStyle = gd.cfgMain.colorTrail;
        this.ctxPic.fillRect(0, 0, width, height);
        window.var_oWrap.appendChild(canvas);
        console.log('Background image canvas created', 'Number of child:', window.var_oWrap.childElementCount);

    }
    create_maincanvas(reset=false){
        const width = window.gd.cfgMain.width;
        const height = window.gd.cfgMain.height;
        const sizeCell = window.gd.cfgMain.sizeCell;
        var canvas = document.createElement('canvas');
        this.ctxMain = canvas.getContext('2d');
        canvas.width = width+ 4*sizeCell;
        canvas.height = height+ 4*sizeCell;
        canvas.style.position = 'absolute';
        canvas.style.left = canvas.style.top = 0;
        this.fillCanvas();
        this.ctxMain.fillStyle = window.gd.cfgMain.colorFill;
        this.ctxMain.fillRect(2*sizeCell, 2*sizeCell, width, height);
        // if not reset append to oWrap
        if (!reset){
            window.var_oWrap.appendChild(canvas);
            console.log('Main canvas created', 'Number of child:', window.var_oWrap.childElementCount);
        }
    }

    startLevelStateCells(level){
        this.iLevel = level || 0;
        window.ls = new LevelState(this.iLevel)
        window.var_cursorMoveRemainder = 0;
        window.var_enemyMoveRemainder = 0;
        window.cellset = window.cellset || new CellSet();
        window.cellset.reset()
        window.cursor = window.cursor || new Cursor();
    }

    resetCanvas(cause) {
        this.setPlayMode(false);
        this.endLevel(false);
        // this.setLevelData(width, height);
        //this.create_maincanvas(true)
        // this.ctxPic.canvas.width = width;
        // this.ctxPic.canvas.height = height;

        window.update_status_bar(cause)
    }
    applyLevel(img) {
        const width = window.gd.cfgMain.width;
        const height = window.gd.cfgMain.height;
        const sizeCell = window.gd.cfgMain.sizeCell;
        var imgPic = img;
        // merge(window.ls, data, true);
        this.setLevelData(img.width, img.height);
        window.gs.ctxMain.canvas.width = width+ 4*sizeCell;
        window.gs.ctxMain.canvas.height = height+ 4*sizeCell;
        window.gs.fillCanvas();
        window.cellset.reset();

        this.ctxPic.canvas.width = width;
        this.ctxPic.canvas.height = height;
        this.ctxPic.drawImage(imgPic, 0, 0, width, height, 0, 0, width, height);
        // window.gd.cfgMain.callback && window.gd.cfgMain.callback(3);
        // if (data.disabled) {
        //     endLevel(true); return;
        // }
        // if ('shuffle' in data)
        //     shuffleImage(data.shuffle);
        var pos = window.cellset.placeCursor();
        window.cursor.reset(pos[0], pos[1]);
        window.ls.aBalls = []; window.ls.aWarders = [];
        var i, aPos;
        aPos = window.cellset.placeBalls(window.ls.nBalls);
        for (i = 0; i < window.ls.nBalls; i++)
            window.ls.aBalls.push(new Enemy(aPos[i][0], aPos[i][1], false));
        aPos = window.cellset.placeWarders(window.ls.nWarders);
        for (i = 0; i < window.ls.nWarders; i++)
            window.ls.aWarders.push(new Enemy(aPos[i][0], aPos[i][1], true, 45));
        window.stageData.bonus = new BonusItem(0,0,'tank',5,true);
        //  BonusItem.random(5, 5, window.cellset.nW-5, window.cellset.nH-5, 'random')
        window.gs.tLevel = Date.now();
        window.gs.tLastFrame = 0;
        this.startLoop();
    }


    endLevel(bClear) {
        var sizeCell = window.gd.cfgMain.sizeCell;
        var width = window.gd.cfgMain.width;
        var height = window.gd.cfgMain.height;
        this.endLoop();  // Stop the animation loop
        window.gs.tLevel = 0;
        window.gs.tLastFrame = 0;  // ADD THIS LINE - Reset frame tracker
        window.gs.bCollision = false;  // ADD THIS LINE - Reset collision flag

        window.gs.nTimeTotal += window.gs.nTimeLevel;
        if (!bClear) return;
        setTimeout(function() {
            // Animate clearing the play area with a left-to-right sliding curtain over 2 seconds
            // Cancel any previous clear animation
            if (window.gs._clearAnimId) cancelAnimationFrame(window.gs._clearAnimId);
            const ctx = window.gs.ctxMain;
            const minmax = window.cellset.getMinxMaxx()
            const startX = minmax[0]*sizeCell
            const endX = minmax[1]*sizeCell
            const totalW = endX-startX;
            const totalH = height;
            const duration = 2000; // milliseconds
            const startTime = performance.now();

            function step(now) {
                const elapsed = now - startTime;
                const t = Math.min(1, elapsed / duration);
                const sweep = Math.ceil(totalW * t);

                // Clear the swept area from the left edge up to current sweep width
                ctx.clearRect(2*sizeCell+startX, 2*sizeCell, sweep, totalH);

                if (t < 1) {
                    window.gs._clearAnimId = requestAnimationFrame(step);
                } else {
                    // Ensure fully cleared and clear the anim id
                    ctx.clearRect(2*sizeCell, 2*sizeCell, width, height);
                    window.gs._clearAnimId = 0;
                }
            }

            window.gs._clearAnimId = requestAnimationFrame(step);
            window.postLevelComplete();
        }, 700);


    }

    setLevelData(w, h) {
        // if (w) width = w - w % (2*sizeCell);
        // if (h) height = h - h % (2*sizeCell);
        // if (window.ls.nBalls) window.ls.nBalls = window.ls.nBalls;
        // if (window.ls.nWarders) window.ls.nWarders = window.ls.nWarders;
    }

    setPlayMode(bOn) {
        if (bOn ^ !window.gs.tLastFrame) return;
        window.gs.tLastFrame? this.endLoop() : this.startLoop();
    }

    setDir(key) {
        if (!window.gs.tLastFrame) return;
        var key_code_map = { 'left': 180, 'right': 0, 'up': 270, 'down': 90, 'stop':false };
        if (key in key_code_map) window.cursor.setDir(key_code_map[key]);
        // console.log('-------------------------------------------------------',key, key_code)
    }

    setDirToward(pos) {
        const sizeCell = window.gd.cfgMain.sizeCell;
        if (!window.gs.tLastFrame || !pos || pos.length < 2) return;
        var xc = Math.floor(pos[0] / sizeCell) - 2,
            yc = Math.floor(pos[1] / sizeCell) - 2;
        var b = window.cellset.isPosValid(xc, yc);
        if (!b) return;
        var posCr = window.cursor.pos(), dirCr = window.cursor.getDir(), dir = false;
        if (dirCr === false) {
            var dx = xc - posCr[0], dy = yc - posCr[1],
                dc = Math.abs(dx) - Math.abs(dy);
            if (dc == 0) return;
            dir = window.var_dirset.find(dx, dy);
            if (dir % 90 != 0) {
                var dir1 = dir-45, dir2 = dir+45;
                dir = dir1 % 180 == 0 ^ dc < 0? dir1 : dir2;
            }
        }
        else {
            var delta = dirCr % 180? xc - posCr[0] : yc - posCr[1];
            if (!delta) return;
            dir = (delta > 0? 0 : 180) + (dirCr % 180? 0 : 90);
        }
        window.cursor.setDir(dir);
    }

    setCursorSpeed(v) {
            if (v > 0) window.gs.speedCursor = v;
        }

    setEnemySpeed(v) {
            if (typeof v === 'number' && v > 0) {
                window.ls.speedEnemy = v;
            }
        }

    startLoop() {
        if (!window.gs.tLevel) return;
        window.gs.idFrame = requestAnimationFrame(window.fn_loop);
        }

    endLoop() {
        if (window.gs.idFrame) cancelAnimationFrame(window.gs.idFrame);
        window.gs.tLastFrame = window.gs.idFrame = 0;
        }

    // The main animation loop
    buildLevelState() {
        return {
            width: width+ 4*sizeCell,
            height: height+ 4*sizeCell,
            play: Boolean(window.gs.tLastFrame),
            posCursor: window.cursor.pos(),
            warders: window.ls.nWarders,
            speedCursor: window.gs.speedCursor,
            speedEnemy: window.ls.speedEnemy,
            cleared: window.cellset.getConqueredRatio()
        };
    }

    // shuffleImage(aData) {
    //     if (aData.length < 3) return;
    //     var aShuffle = aData.slice();
    //     var wCell = aShuffle.shift();
    //     var nShuffle = aShuffle.length;
    //     var nCols = 2* Math.floor(width/ 2/ wCell);
    //     var nRows = 2* Math.floor(height/ 2/ wCell);
    //     var canvas = document.createElement('canvas');
    //     var ctxTmp = canvas.getContext('2d');
    //     canvas.width = wCell;
    //     canvas.height = wCell;
    //     for (var i = 0; i < nShuffle; i+=2) {
    //         var ic1 = aShuffle[i], ic2 = aShuffle[i+1];
    //         var x1 = ic1 % nCols * wCell, y1 = Math.floor(ic1 / nCols) * wCell;
    //         var x2 = ic2 % nCols * wCell, y2 = Math.floor(ic2 / nCols) * wCell;
    //         ctxTmp.drawImage(ctxPic.canvas, x1, y1, wCell, wCell, 0, 0, wCell, wCell);
    //         ctxPic.drawImage(ctxPic.canvas, x2, y2, wCell, wCell, x1, y1, wCell, wCell);
    //         ctxPic.drawImage(canvas, 0, 0, wCell, wCell, x2, y2, wCell, wCell);
    //     }
    // }


    // class  end next
};