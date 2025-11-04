/**
 * PicXonix
 * https://github.com/hindmost/picxonix
 * @author   Savr Goryaev
 * @license  MIT http://www.opensource.org/licenses/MIT
 */
// picxonix.js
import { BonusItem } from './bonus.js';
import { GameDef, LevelState, GameState } from './gamestate.js';
import { Cursor } from './cursor.js';
import { CellSet } from './cellset.js';
import { Enemy } from './enemy.js';

export function test_function(){
    console.log('Test func called');
}

// Call the test_function to avoid compile error
test_function();

(function() {
    var tLast = 0;
    var vendors = ['webkit', 'moz'];
    for(var i = 0; i < vendors.length && !window.requestAnimationFrame; ++i) {
        var v = vendors[i];
        window.requestAnimationFrame = window[v+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[v+'CancelAnimationFrame'] ||
            window[v+'CancelRequestAnimationFrame'];
    }
    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var tNow = Date.now();
            var dt = Math.max(0, 17 - tNow + tLast);
            var id = setTimeout(function() { callback(tNow + dt); }, dt);
            tLast = tNow + dt;
            return id;
        };
    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());

(function() {

    window.picxonix = function(v1, v2) {
        console.log('picxonix called:', v1, v2);
        switch (v1) {
            case 'init':
                init(v2)
                break;
            case 'quit': // quit game
                window.gs.resetCanvas('quit');
                break;
            case 'reset': // reset game
                window.gs.resetCanvas('reset');
                break;
            case 'end': // finish the current level
                window.gs.endLevel(v2);
                if(v2){

                }
                else{
                    $('#banner').html('Game Over :( ')
                }
                break;
            case 'newgame':
                newGameInit(v2);
                break;
            case 'cursorDir': // set the cursor movement direction
                typeof v2 == 'string'? window.gs.setDir(v2) : window.gs.setDirToward(v2);
                break;
            case 'cursorSpeed': // set the cursor speed
                setCursorSpeed(v2);
                break;
            case 'enemySpeed': // set enemy speed
                setEnemySpeed(v2);
                break;
            case 'enemySpawn': // introduce extra warder object
                spawn();
                break;
            case 'setFaults':
                window.gs.nFaults = v2;
                window.update_status_bar();
                break;

            default:
        }
        return 0;
    }
    function newGameInit(origin){
        window.gd = new GameDef();
        window.gs = new GameState(window.gd);
        init_canvas_container()
        window.gs.iLevel = 1;
        window.gs.startLevelStateCells(1);

    }
    window.CA_CLEAR = 1 << 0;
    window.CA_TRAIL = 1 << 1;
    // dimensions:
    var sizeCell;
    var width, height;
    // Accumulators for fractional movement
    var cursorMoveRemainder = 0;
    var enemyMoveRemainder = 0;
    // host objects:
    // var elContainer;
    // var ctxPic;

    var imgPic;
    var imgBall;
    var imgWarder;
    var imgCursor;

    // Ensure arrays and counters exist without clobbering any previously populated state
    // window.ls.aBalls = window.ls.aBalls || [];
    // window.ls.aWarders = window.ls.aWarders || [];
    // window.ls.nBalls = (typeof window.ls.nBalls === 'number') ? window.ls.nBalls : 0;
    // window.ls.nWarders = (typeof window.ls.nWarders === 'number') ? window.ls.nWarders : 0;
    window.flashEffect = function({ color='white', opacity=1, duration=400, repeat=1 } = {}) {
        // find div by id flashOverlay.id = 'flash-overlay';
        const f = document.getElementById('flash-overlay');
        if (!f) return;
        f.style.background = color;
        f.style.transition = `opacity ${duration}ms ease-in-out`;
        let n = 0;
        const doFlash = () => {
            f.style.opacity = opacity;
            setTimeout(() => { f.style.opacity = 0; }, duration / 2);
            if (++n < repeat) setTimeout(doFlash, duration);
        };
        doFlash();
    }

    function add_flash_overlay(){
        const flashOverlay = document.createElement('div');
        flashOverlay.id = 'flash-overlay';
        // The canvases are appended with position:absolute, so their parent
        // (`window.var_oWrap`) may collapse to zero size. Compute explicit
        // dimensions so the overlay covers the main canvas area.
        const sizeCell = window.gd && window.gd.cfgMain? window.gd.cfgMain.sizeCell : 10;
        const mainW = window.gd && window.gd.cfgMain? window.gd.cfgMain.width + 4 * sizeCell : 600 + 4 * sizeCell;
        const mainH = window.gd && window.gd.cfgMain? window.gd.cfgMain.height + 4 * sizeCell : 400 + 4 * sizeCell;
        Object.assign(flashOverlay.style, {
            position: 'absolute',
            left: '0px',
            top: '0px',
            width: mainW + 'px',
            height: mainH + 'px',
            background: 'white',
            opacity: 0,
            pointerEvents: 'none',
            zIndex: 9999,
            transition: 'opacity 0.3s ease-in-out'
        });
        window.var_oWrap.appendChild(flashOverlay);
     }

    function init_canvas_container() {
        sizeCell = window.gd.cfgMain.sizeCell;
        //setLevelData(window.gd.cfgMain.width, window.gd.cfgMain.height);
        window.gs.create_imgbg()
        window.gs.create_maincanvas()
        add_flash_overlay()
        // create temp canvas:
        var canvas = document.createElement('canvas');
        var ctxTmp = canvas.getContext('2d');
        canvas.width = sizeCell;
        canvas.height = sizeCell;
        // prepare ball image:
        var r = sizeCell / 2, q = sizeCell / 4;
        ctxTmp.clearRect(0, 0, sizeCell, sizeCell);
        ctxTmp.beginPath();
        ctxTmp.arc(r, r, r, 0, Math.PI * 2, false);
        ctxTmp.fillStyle = window.gd.cfgMain.colorBall;
        ctxTmp.fill();
        if (window.gd.cfgMain.colorBallIn) {
            ctxTmp.beginPath();
            ctxTmp.arc(r, r, q, 0, Math.PI * 2, false);
            ctxTmp.fillStyle = window.gd.cfgMain.colorBallIn;
            ctxTmp.fill();
        }
        imgBall = new Image();
        imgBall.src = ctxTmp.canvas.toDataURL();
        function prepareSquare(colorOut, colorIn, opacity=1) {
            ctxTmp.clearRect(0, 0, sizeCell, sizeCell);
            ctxTmp.globalAlpha = opacity;
            ctxTmp.fillStyle = colorOut;
            ctxTmp.fillRect(0, 0, sizeCell, sizeCell);
            if (colorIn) {
            ctxTmp.fillStyle = colorIn;
            ctxTmp.fillRect(q, q, sizeCell - r, sizeCell - r);
            }
            ctxTmp.globalAlpha = 1;
        }
        // prepare warder image:
        prepareSquare(window.gd.cfgMain.colorWarder, window.gd.cfgMain.colorWarderIn);
        imgWarder = new Image();
        imgWarder.src = ctxTmp.canvas.toDataURL();
        // prepare cursor image:
        var opacity = window.ls? (window.ls.ignoreCollisionBonus? 0.5 : 1) : 1
        prepareSquare(window.gd.cfgMain.colorCursor, window.gd.cfgMain.colorCursorIn, opacity);
        imgCursor = new Image();
        imgCursor.src = ctxTmp.canvas.toDataURL();
        window.var_imgCursor = imgCursor
        window.var_imgWarder = imgWarder
        window.var_imgBall = imgBall
        window.update_status_bar('init')
        return true;
    }

    window.loadLevel = function() {
        // Always reset state before loading a new level (for Try Again)
        window.gs.endLevel(false); // Ensure previous animation loop and state are cleared
        window.ls.loadImgwithLevel()

        window.stageData = window.stageData || {};
        window.stageData.area = window.stageData.area || 0;
        window.stageData.cum_area = window.stageData.cum_area || 0;
        window.stageData.bonus = window.stageData.bonus || 'not set';
    }

window.update_status_bar = function(stage='update') {
    if(stage == 'init' || stage == 'quit'){
        $("#status-progress-current").html('-');
        $("#status-time").html('--:--');
        $("#status-points").html('-');
        $('#status-speed').html('-');
        $('#status-enemy').html('-');
        $('#status-life').html('-');
        $('#status-score').html('-');

    }else if(stage == 'reset'){
        $("#status-progress-current").html('1');
        $("#status-time").html('00:00');
        $("#status-points").html('0');
        $('#status-speed').html(window.gs.speedCursor);
        $('#status-enemy').html(window.ls.speedEnemy);
        $('#status-life').html(window.gs.nFaults);
        $('#status-score').html(window.gs.score.toFixed(0));

    }else{
        $('#status-speed').html(window.gs.speedCursor+window.gs.speedBonus);
        $('#status-enemy').html((window.ls.speedEnemy - window.ls.speedEnemyReduce).toFixed(1));
        $('#status-life').html(window.gs.nFaults);
        $('#status-score').html(window.gs.score.toFixed(0));
    }
}

window.render = function() {
        window.cellset.render();
        window.stageData.bonus.render(window.gd.cfgMain, window.gs.ctxMain);
        window.cursor.render();
        var i;
        for (i = 0; i < window.ls.nBalls; i++) window.ls.aBalls[i].render();
        for (i = 0; i < window.ls.nWarders; i++) window.ls.aWarders[i].render();
    }

window.fn_lock = function() {
        window.gs.tLastFrame = 0;
        window.gs.bCollision = false;
        var posCr = window.cursor.pos();
        window.cellset.add2Trail(posCr[0], posCr[1], false);
        setTimeout(window.fn_unlock, window.gd.cfgMain.timeoutCollision);
    }

window.fn_unlock = function() {
        if (!window.gs.tLevel) return;
        window.cellset.clearTrail();
        var pos = window.cellset.placeCursor();
        window.cursor.reset(pos[0], pos[1], true);
        var aPos = window.cellset.placeWarders(window.ls.nWarders);
        for (var i = 0; i < window.ls.nWarders; i++)
            window.ls.aWarders[i].reset(aPos[i][0], aPos[i][1]);
        window.gs.startLoop();
    }

window.fn_spawn = function() {
        if (!window.gs.tLevel) return;
        var pos = window.cellset.placeSpawned();
        if (!pos) return;
        window.ls.aWarders.push(new Enemy(pos[0], pos[1], true));
        window.ls.nWarders++;
    }

window.fn_loop = function(now) {
        var dt = window.gs.tLastFrame? (now - window.gs.tLastFrame) / 1000 : 0;
        // console.log(window.gs.tLastFrame , dt)
        window.gs.bCollision = window.gs.bConquer = false;

        var need_render = !window.gs.tLastFrame || window.fn_update(dt) && window.gs.bPlay
        var need_timeUpdate = !window.gs.tLastFrame || window.gs.bPlay
        if (need_render)
            {
                window.render();
                // console.log('---------------------------------------------------------rendered')
            }
        if(need_timeUpdate) window.gs.tLastFrame = now;
        if (window.gs.bCollision) {
            window.fn_lock();
            window.afterFault();
            return;
        }
        if (window.gs.bConquer) {
            window.gs.bConquer = false;
            window.gs.tLastFrame = 0;
            const points_check = [[window.stageData.bonus.x, window.stageData.bonus.y ]];
            const bonus_captured = window.cellset.conquer(points_check);
            if (bonus_captured[0]){
                window.stageData.bonus.active = false
                console.log('----- Bonus conquered area, removed.')
            }
            // var data = buildLevelState();
            var cleared = window.cellset.getConqueredRatio()
            window.gs.bConquer = true;

            window.fn_postConquer(cleared, window.ls.target_area)
        }
        else{
            window.fn_updateTime();
        }
        window.gs.startLoop();
    }

    // The set of available directions:
window.var_dirset = {
        vecs: {
            0: [1, 0], 45: [1, 1], 90: [0, 1], 135: [-1, 1], 180: [-1, 0], 225: [-1, -1], 270: [0, -1], 315: [1, -1]
        },
        get: function(v) {
            return v in this.vecs? this.vecs[v] : [0, 0];
        },
        find: function(x, y) {
            x = x == 0? 0 : (x > 0? 1 : -1);
            y = y == 0? 0 : (y > 0? 1 : -1);
            for (var v in this.vecs) {
                var vec = this.vecs[v];
                if (vec[0] == x && vec[1] == y) return parseInt(v);
            }
            return false;
        }
    };

    function merge(dest, src, bFilter) {
        if (!src) return dest;
        for(var key in dest) {
            if (!dest.hasOwnProperty(key) || !src.hasOwnProperty(key)) continue;
            var v = src[key];
            if ((!bFilter || v) && (typeof v != 'number' || v >= 0))
                dest[key] = v;
        }
        return dest;
    }

})();
