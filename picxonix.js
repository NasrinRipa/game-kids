/**
 * picxonix.js – Game engine
 *
 * Owns the main game loop, canvas setup, level loading, and all game-event
 * handling (collision, conquest, fault, level-complete).
 *
 * Public API (imported by main.js):
 *   initWrapperEl(el)            – create the DOM wrapper div inside `el`
 *   newGame()                    – initialise a fresh game (GameConfig + GameState)
 *   quitGame()                   – stop gameplay and reset status bar
 *   loadCurrentLevel()           – load the current level image and start the loop
 *   endLevel(success)            – stop the current level; animate clear when success=true
 *   setCursorDirection(keyName)  – keyboard input ('left'|'right'|'up'|'down'|'stop')
 *   setCursorDirectionToward(pos)– mouse/touch input: [canvasX, canvasY]
 *   setCursorSpeed(n)            – set base cursor speed
 *   setEnemySpeed(n)             – set base enemy speed
 *   spawnWarder()                – add an extra warder to the field
 *   flashEffect(options)         – brief visual flash on the canvas overlay
 */

import { Bonus, rebuildCursorSprite }   from './bonus.js';
import { GameConfig, GameState, LevelConfig, game } from './gamestate.js';
import { Cursor }                        from './cursor.js';
import { Grid }                          from './cellset.js';
import { Enemy }                         from './enemy.js';
import { dirs, COLLISION_TIMEOUT, LEVEL_CLEAR_DELAY, LEVEL_CLEAR_DURATION, BONUS_MARGIN, BONUS_SPAWN_CLEARED_THRESHOLD } from './constants.js';

// ── Public API ────────────────────────────────────────────────────────────────

/** Fetch settings.json and store game settings + level definitions in game. */
export async function loadLevels() {
    const response = await fetch('settings.json');
    const data = await response.json();
    game.settingsData = data.game ?? {};
    game.levelsData   = data.levels ?? [];
}

/** Attach the canvas container div to the given DOM element. */
export function initWrapperEl(el) {
    game.wrapEl = document.createElement('div');
    game.wrapEl.style.position = 'relative';
    el.appendChild(game.wrapEl);
}

/** Create a fresh GameConfig + GameState; wire up the game loop reference. */
export function newGame() {
    game.config = new GameConfig();

    // Apply game-wide settings from settings.json
    const s = game.settingsData;
    if (s) {
        if (s.gridCols != null)  game.config.gridCols  = s.gridCols;
        if (s.gridRows != null)  game.config.gridRows  = s.gridRows;
        if (s.cellSize != null)  game.config.cellSize  = s.cellSize;
        if (s.image_folder)      game.config.imageFolder = s.image_folder;
        if (s.initial_lives != null) game.config.initialLives = s.initial_lives;
        if (s.fullscreen_statusbar != null) game.config.fullscreenStatusbar = s.fullscreen_statusbar;
        if (s.tank_auto_stop != null) game.config.tankAutoStop = s.tank_auto_stop;
        const colorKeys = ['colorEmpty','colorBorder','colorBall','colorBallCenter',
            'colorWarder','colorWarderCenter','colorCursor','colorCursorCenter',
            'colorCursorEffect','colorTrail'];
        for (const k of colorKeys) {
            if (s[k] != null) game.config[k] = s[k];
        }
    }

    if (game.levelsData.length) game.config.levels = game.levelsData;
    game.state  = new GameState(game.config);
    game.state.lives = game.config.initialLives;
    game.loopFn = _gameLoop;

    _initCanvasContainer();

    game.state.levelIndex = 1;
    _initLevelState(1);
}

/** Stop play and reset the status bar to its idle state. */
export function quitGame() {
    game.state.isPlaying  = false;
    game.state.isStarted  = false;
    game.state.stopLoop();
    game.state.levelStartTime = 0;
    game.ui.updateStatus('quit');
}

/**
 * Load the background image for the current level, then start the game loop.
 * Always resets level state so "Try Again" starts cleanly.
 */
export function loadCurrentLevel() {
    endLevel(false);   // stop any running loop first
    _initLevelState(game.state.levelIndex);
    game.clearedArea = 0;
    game.level.loadImage(_applyLevelImage);
}

/**
 * Stop the current level.
 * @param {boolean} success – when true, animate the field clearing and call
 *   game.ui.onLevelComplete() afterwards.
 */
export function endLevel(success) {
    game.state.stopLoop();
    game.state.totalElapsedSeconds += game.state.levelElapsedSeconds;
    game.state.levelStartTime = 0;
    game.state.lastFrameTime  = 0;
    game.state.hasCollision   = false;

    // Cancel any in-flight timed bonus effects (sneaky, freez, tank).
    _deactivateActiveTimedBonus();

    if (!success) return;

    setTimeout(() => {
        _animateLevelClear(() => game.ui.onLevelComplete());
    }, LEVEL_CLEAR_DELAY);
}

/** Handle a keyboard direction input. */
export function setCursorDirection(keyName) {
    if (!game.state.lastFrameTime) return;
    const map = { left: 180, right: 0, up: 270, down: 90, stop: false };
    if (keyName in map) game.cursor.setDirection(map[keyName]);
}

/** Point the cursor toward a canvas pixel position [canvasX, canvasY]. */
export function setCursorDirectionToward(canvasPos) {
    if (!game.state.lastFrameTime || !canvasPos || canvasPos.length < 2) return;

    const cs = game.config.cellSize;
    const xc = Math.floor(canvasPos[0] / cs) - 2;
    const yc = Math.floor(canvasPos[1] / cs) - 2;
    if (!game.grid.isPositionValid(xc, yc)) return;

    const [cx, cy] = game.cursor.pos();
    const curDir   = game.cursor.getDirection();
    let newDir     = false;

    if (curDir === false) {
        const dx = xc - cx, dy = yc - cy;
        const dc = Math.abs(dx) - Math.abs(dy);
        if (dc === 0) return;
        newDir = dirs.find(dx, dy);
        if (newDir % 90 !== 0) {
            const d1 = newDir - 45, d2 = newDir + 45;
            newDir = (d1 % 180 === 0) ^ (dc < 0) ? d1 : d2;
        }
    } else {
        const dx = xc - cx;
        const dy = yc - cy;
        if (!dx && !dy) return;
        if (Math.abs(dx) >= Math.abs(dy)) {
            newDir = dx >= 0 ? 0 : 180;
        } else {
            newDir = dy >= 0 ? 90 : 270;
        }
    }

    game.cursor.setDirection(newDir);
}

export function setCursorSpeed(n) {
    if (n > 0) game.state.cursorSpeed = n;
}

export function setEnemySpeed(n) {
    if (typeof n === 'number' && n > 0) game.level.enemySpeed = n;
}

/** Place an extra warder on the field (up to 9 total). */
export function spawnWarder() {
    const pos = game.grid.getSpawnPosition();
    if (!pos) return;
    game.level.warders.push(new Enemy(pos[0], pos[1], true));
    game.level.warderCount++;
}

/**
 * Flash the canvas overlay briefly.
 * @param {object} opts  color, opacity, duration (ms), repeat count
 */
export function flashEffect({ color = 'white', opacity = 1, duration = 400, repeat = 1 } = {}) {
    const overlay = document.getElementById('flash-overlay');
    if (!overlay) return;
    overlay.style.background   = color;
    overlay.style.transition   = `opacity ${duration}ms ease-in-out`;
    let count = 0;
    const doFlash = () => {
        overlay.style.opacity = opacity;
        setTimeout(() => { overlay.style.opacity = 0; }, duration / 2);
        if (++count < repeat) setTimeout(doFlash, duration);
    };
    doFlash();
}

// ── Canvas / level setup ───────────────────────────────────────────────────────

function _initLevelState(levelIndex) {
    game.state.levelIndex = levelIndex;
    const ld = game.levelsData[levelIndex - 1];
    const imageFile = ld && ld.image ? ld.image : null;
    game.level = new LevelConfig(levelIndex, imageFile);

    if (ld) {
        game.level.ballCount          = ld.ballCount          ?? game.level.ballCount;
        game.level.warderCount        = ld.warderCount        ?? game.level.warderCount;
        game.level.targetAreaPercent  = ld.targetAreaPercent  ?? game.level.targetAreaPercent;
        game.level.bonusTypes         = ld.bonusTypes         ?? ['tank'];

        // Use game-wide carry_over_speed setting.
        const carryOver = game.settingsData?.carry_over_speed ?? false;
        if (!carryOver || levelIndex === 1) {
            game.level.enemySpeed  = ld.enemySpeed  ?? game.level.enemySpeed;
            if (ld.cursorSpeed != null) game.state.cursorSpeed = ld.cursorSpeed;
        }
    } else {
        game.level.bonusTypes = ['tank'];
    }

    game.cursorMoveAcc = 0;
    game.enemyMoveAcc  = 0;
    game.grid   = game.grid   || new Grid();
    game.cursor = game.cursor || new Cursor();
    game.grid.reset();

    game.ui.updateStatus('update');
}

function _initCanvasContainer() {
    // Clear any canvases from a previous game (Play Again).
    game.wrapEl.innerHTML = '';

    const cfg = game.config;
    const cs  = cfg.cellSize;
    const totalW = cfg.canvasWidth  + 4 * cs;
    const totalH = cfg.canvasHeight + 4 * cs;

    // Give the wrapper explicit dimensions so CSS zoom/transform scales correctly.
    game.wrapEl.style.position = 'relative';
    game.wrapEl.style.width    = totalW + 'px';
    game.wrapEl.style.height   = totalH + 'px';

    // ── Background canvas (level image / revealed cells) ──────────────────────
    const bgCanvas    = document.createElement('canvas');
    game.state.bgCtx  = bgCanvas.getContext('2d');
    bgCanvas.width    = cfg.canvasWidth;
    bgCanvas.height   = cfg.canvasHeight;
    bgCanvas.style.cssText = `position:absolute; left:${2 * cs}px; top:${2 * cs}px;`;
    game.state.bgCtx.fillStyle = cfg.colorTrail;
    game.state.bgCtx.fillRect(0, 0, cfg.canvasWidth, cfg.canvasHeight);
    game.wrapEl.appendChild(bgCanvas);

    // ── Main game canvas (sprites, trail, border ring) ────────────────────────
    const mainCanvas    = document.createElement('canvas');
    game.state.mainCtx  = mainCanvas.getContext('2d');
    mainCanvas.width    = cfg.canvasWidth  + 4 * cs;
    mainCanvas.height   = cfg.canvasHeight + 4 * cs;
    mainCanvas.style.cssText = 'position:absolute; left:0; top:0;';
    game.state.fillCanvas();
    game.state.mainCtx.fillStyle = cfg.colorEmpty;
    game.state.mainCtx.fillRect(2 * cs, 2 * cs, cfg.canvasWidth, cfg.canvasHeight);
    game.wrapEl.appendChild(mainCanvas);

    // ── Flash overlay ─────────────────────────────────────────────────────────
    const flashEl = document.createElement('div');
    flashEl.id    = 'flash-overlay';
    Object.assign(flashEl.style, {
        position:      'absolute',
        left:          '0', top: '0',
        width:         `${cfg.canvasWidth  + 4 * cs}px`,
        height:        `${cfg.canvasHeight + 4 * cs}px`,
        background:    'white',
        opacity:       0,
        pointerEvents: 'none',
        zIndex:        9999,
        transition:    'opacity 0.3s ease-in-out',
    });
    game.wrapEl.appendChild(flashEl);

    // ── Sprite images ─────────────────────────────────────────────────────────
    _buildSprites();

    game.ui.updateStatus('init');
}

function _buildSprites() {
    const cfg    = game.config;
    const cs     = cfg.cellSize;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = cs;
    const ctx = canvas.getContext('2d');
    const r   = cs / 2, q = cs / 4;

    // Ball
    ctx.clearRect(0, 0, cs, cs);
    ctx.beginPath(); ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fillStyle = cfg.colorBall; ctx.fill();
    if (cfg.colorBallCenter) {
        ctx.beginPath(); ctx.arc(r, r, q, 0, Math.PI * 2);
        ctx.fillStyle = cfg.colorBallCenter; ctx.fill();
    }
    game.images.ball = _canvasToImage(canvas);

    // Warder
    ctx.clearRect(0, 0, cs, cs);
    ctx.fillStyle = cfg.colorWarder;       ctx.fillRect(0, 0, cs, cs);
    ctx.fillStyle = cfg.colorWarderCenter; ctx.fillRect(q, q, r, r);
    game.images.warder = _canvasToImage(canvas);

    // Cursor (opacity reflects invincibility state)
    _rebuildCursorSprite(ctx, canvas);
}

function _rebuildCursorSprite(ctx, canvas) {
    const cfg     = game.config;
    const cs      = cfg.cellSize;
    const q       = cs / 4, r = cs / 2;
    const opacity = game.level?.isInvincible ? 0.5 : 1;
    ctx = ctx || (() => { const c = document.createElement('canvas'); c.width = c.height = cs; return c.getContext('2d'); })();
    canvas = canvas || ctx.canvas;
    ctx.clearRect(0, 0, cs, cs);
    ctx.globalAlpha = opacity;
    ctx.fillStyle   = cfg.colorCursor;       ctx.fillRect(0, 0, cs, cs);
    ctx.fillStyle   = cfg.colorCursorCenter; ctx.fillRect(q, q, r, r);
    ctx.globalAlpha = 1;
    game.images.cursor = _canvasToImage(canvas);
}

function _canvasToImage(canvas) {
    const img = new Image();
    img.src   = canvas.toDataURL();
    return img;
}

// ── Level loading ─────────────────────────────────────────────────────────────

function _applyLevelImage(img) {
    const cfg = game.config;
    const cs  = cfg.cellSize;
    const w   = cfg.canvasWidth, h = cfg.canvasHeight;

    // Resize canvases to match the loaded image dimensions.
    game.state.mainCtx.canvas.width  = w + 4 * cs;
    game.state.mainCtx.canvas.height = h + 4 * cs;
    game.state.fillCanvas();

    game.grid.reset();

    game.state.bgCtx.canvas.width  = w;
    game.state.bgCtx.canvas.height = h;
    game.state.bgCtx.drawImage(img, 0, 0, w, h);

    // Place cursor.
    const cursorPos = game.grid.getInitialCursorPos();
    game.cursor.reset(cursorPos[0], cursorPos[1]);

    // Rebuild cursor sprite (invincibility may have changed since last level).
    _rebuildCursorSprite();

    // Create enemies.
    game.level.balls   = [];
    game.level.warders = [];

    const ballPositions   = game.grid.getRandomBallPositions(game.level.ballCount);
    const warderPositions = game.grid.getWarderStartPositions(game.level.warderCount);

    for (const [bx, by] of ballPositions)
        game.level.balls.push(new Enemy(bx, by, false));
    for (const [wx, wy] of warderPositions)
        game.level.warders.push(new Enemy(wx, wy, true, 45));

    // Reset per-level bonus spawn tracking.
    game.bonusSpawnedCount = 0;
    game.bonus = null;

    // Start timing.
    game.state.levelStartTime    = Date.now();
    game.state.lastFrameTime     = 0;
    game.state.levelElapsedSeconds = 0;

    // Reset per-level conquest milestone tracking.
    game.bannerMilestones = new Set();

    game.state.startLoop();
    if (game.ui.showGoOn) game.ui.showGoOn();
}

// ── Level clear animation ─────────────────────────────────────────────────────

function _animateLevelClear(onDone) {
    const cfg      = game.config;
    const cs       = cfg.cellSize;
    const ctx      = game.state.mainCtx;
    const range    = game.grid.getActiveColumnRange();
    if (!range) { onDone(); return; }

    const [minX, maxX] = range;
    const startPx  = minX * cs;
    const totalW   = (maxX - minX) * cs;
    const totalH   = cfg.canvasHeight;
    const duration = LEVEL_CLEAR_DURATION;
    const t0       = performance.now();

    let frameId = 0;
    function step(now) {
        const elapsed = now - t0;
        const sweep   = Math.ceil(totalW * Math.min(elapsed / duration, 1));
        ctx.clearRect(2 * cs + startPx, 2 * cs, sweep, totalH);

        if (elapsed < duration) {
            frameId = requestAnimationFrame(step);
        } else {
            ctx.clearRect(2 * cs, 2 * cs, cfg.canvasWidth, cfg.canvasHeight);
            onDone();
        }
    }
    frameId = requestAnimationFrame(step);
}


// ── Main game loop ────────────────────────────────────────────────────────────
function _gameLoop(now) {
    const state = game.state;
    state.hasCollision = state.hasConquered = false;

    const needRender = !state.lastFrameTime || (_updateFrame(now) && state.isPlaying);

    if (needRender) _renderFrame();
    if (!state.lastFrameTime || state.isPlaying) state.lastFrameTime = now;

    if (state.hasCollision) {
        _lockAfterCollision();
        _handleFault();
        return;
    }

    if (state.hasConquered) {
        state.hasConquered   = false;
        state.lastFrameTime  = 0;

        const bonusHit  = game.grid.conquerRegions([[game.bonus?.x, game.bonus?.y]]);
        game.sneakyConquer = false;
        if (bonusHit[0]) game.bonus = null;

        const cleared   = game.grid.getConqueredPercent();
        state.hasConquered = true;
        _handleConquer(cleared, game.level.targetAreaPercent);
    } else {
        _updateLevelTimer();
    }

    state.startLoop();
}

function _renderFrame() {
    game.grid.render();
    if (game.bonus) game.bonus.render();
    game.cursor.render();
    for (const ball   of game.level.balls)   ball.render();
    for (const warder of game.level.warders) warder.render();
}

function _updateFrame(now) {
    const state = game.state;
    const level = game.level;
    const dt    = state.lastFrameTime ? (now - state.lastFrameTime) / 1000 : 0;

    if (game.cursor.direction === false)
        game.cursorMoveAcc = 0;
    else
        game.cursorMoveAcc += dt * (state.cursorSpeed + state.bonusSpeed);

    game.enemyMoveAcc += dt * Math.max(0, level.enemySpeed - level.enemySlowdown);

    const cursorSteps = Math.floor(game.cursorMoveAcc);
    const enemySteps  = Math.floor(game.enemyMoveAcc);
    game.cursorMoveAcc -= cursorSteps;
    game.enemyMoveAcc  -= enemySteps;

    if (cursorSteps < 1 && enemySteps < 1) return false;

    game.cursor.update(cursorSteps);

    // Bonus pickup check.
    if (game.bonus && cursorSteps >= 1) {
        if (game.bonus.containsPoint(game.cursor.pos())) game.bonus.apply();
    }

    for (const ball   of game.level.balls)   ball.update(enemySteps);
    for (const warder of game.level.warders) warder.update(enemySteps);

    return true;
}

function _updateLevelTimer() {
    const elapsed = Math.floor((Date.now() - game.state.levelStartTime) / 1000);
    if (elapsed - game.state.levelElapsedSeconds < 1) return;
    game.state.levelElapsedSeconds = elapsed;

    const total = elapsed + game.state.totalElapsedSeconds;
    const mm    = String(Math.floor(total / 60)).padStart(2, '0');
    const ss    = String(total % 60).padStart(2, '0');
    document.getElementById('status-time').textContent = `${mm}:${ss}`;
    const fsTime = document.getElementById('fs-s-time');
    if (fsTime) fsTime.textContent = `${mm}:${ss}`;
}

// ── Collision handling ────────────────────────────────────────────────────────

function _lockAfterCollision() {
    game.state.lastFrameTime = 0;
    game.state.hasCollision  = false;
    const [cx, cy] = game.cursor.pos();
    game.grid.addToTrail(cx, cy, false);
    setTimeout(_unlockAfterCollision, COLLISION_TIMEOUT);
}

function _unlockAfterCollision() {
    if (!game.state.levelStartTime) return;
    game.grid.resetTrail();
    const pos = game.grid.getInitialCursorPos();
    game.cursor.reset(pos[0], pos[1], true);
    const warderPositions = game.grid.getWarderStartPositions(game.level.warderCount);
    for (let i = 0; i < game.level.warderCount; i++)
        game.level.warders[i].reset(warderPositions[i][0], warderPositions[i][1]);
    game.state.startLoop();
}

function _handleFault() {
    game.state.lives--;

    // Fault cancels any currently active timed bonus effect immediately.
    _deactivateActiveTimedBonus({ resetPersistentSlowdown: false });

    const loseSpeedOnDeath = !!game.settingsData?.speed_lost_on_death;
    if (loseSpeedOnDeath) {
        const carryOver = !!game.settingsData?.carry_over_speed;
        const defaultLevelIdx = carryOver ? 1 : game.state.levelIndex;
        const defaultLevel = game.levelsData?.[Math.max(0, defaultLevelIdx - 1)] || null;

        game.state.bonusSpeed = 0;
        game.level.enemySlowdown = 0;
        if (defaultLevel?.cursorSpeed != null) game.state.cursorSpeed = defaultLevel.cursorSpeed;
        if (defaultLevel?.enemySpeed != null) game.level.enemySpeed = defaultLevel.enemySpeed;
    }

    game.ui.updateStatus('update');
    if (game.state.lives > 0) {
        if (game.ui.showOops) game.ui.showOops();
        else game.ui.setBanner('Oops..');
        return;
    }

    if (game.ui.showGameOver) game.ui.showGameOver();
    else game.ui.setBanner('GAME OVER');
    game.state.isPlaying = game.state.isStarted = false;
    endLevel(false);
    game.ui.onFault();
}

// ── Conquest handling ─────────────────────────────────────────────────────────

function _handleConquer(clearedPercent, targetPercent) {
    const prevCleared = game.clearedArea;
    const incremental = clearedPercent - prevCleared;
    game.state.score += incremental;
    game.clearedArea  = clearedPercent;

    document.getElementById('status-points').textContent = `${clearedPercent.toFixed(0)}%`;
    const fsPoints = document.getElementById('fs-s-points');
    if (fsPoints) fsPoints.textContent = `${clearedPercent.toFixed(0)}%`;
    game.ui.updateStatus('conquer');

    // Show conquer banner only when floodfill conquered a region beyond the trail.
    if (incremental > 0 && game.grid.lastConquerRectCount > 0) {
        const halfwayThreshold = targetPercent / 2;
        const crossedHalfway = prevCleared < halfwayThreshold && clearedPercent >= halfwayThreshold;
        if (game.ui.showConquer) {
            game.ui.showConquer(incremental, crossedHalfway, {});
        }

        _trySpawnBonusAfterConquer();
    }

    if (clearedPercent < targetPercent) return;

    // Level complete.
    if (game.ui.showLevelComplete) game.ui.showLevelComplete();
    flashEffect({ duration: 50, opacity: 0.9 });
    endLevel(true);
}

function _deactivateActiveTimedBonus({ resetPersistentSlowdown = true } = {}) {
    for (const t of game.activeEffectTimers) clearTimeout(t);
    game.activeEffectTimers = [];

    for (const cleanup of game.activeEffectCleanups) cleanup();
    game.activeEffectCleanups = [];

    game.bonusTimerActive = false;
    game.bonusTimerExpiresAt = 0;

    if (game.level) {
        game.level.isInvincible = false;
        if (resetPersistentSlowdown) game.level.enemySlowdown = 0;
        if (game.level.tankMode) {
            game.level.tankMode = false;
            game.level.tankTimeout = null;
            game.level.tankClearedCells = null;
            game.level.saved_copy_trail = null;
            game.level.saved_copy_trail_nodes = null;
            game.level.saved_copy_trail_direction = null;
            game.level.saved_copy_trail_pre_index = null;
            game.grid.resetTrail(false);
            game.cursor.isOnTrail = false;
            if (game.config.tankAutoStop) game.cursor.direction = false;
        }
    }

    rebuildCursorSprite(false);
}

function _trySpawnBonusAfterConquer() {
    if (!_canSpawnBonusNow()) return;

    const g = game.grid;
    const spawnType = game.level.bonusTypes[Math.floor(Math.random() * game.level.bonusTypes.length)];
    const spawned = Bonus.random(BONUS_MARGIN, BONUS_MARGIN, g.cols - BONUS_MARGIN, g.rows - BONUS_MARGIN, spawnType);
    if (spawned) {
        game.bonus = spawned;
        game.bonusSpawnedCount = (game.bonusSpawnedCount || 0) + 1;
    }
}

function _canSpawnBonusNow() {
    if (game.bonus) return false;
    if (game.bonusTimerActive) return false;
    if (game.level?.tankMode) return false;
    if (game.grid.trail.length > 0) return false;
    if (game.clearedArea >= BONUS_SPAWN_CLEARED_THRESHOLD) return false;

    const enableThreeBonusRule = !!game.settingsData?.three_bonus;
    if (!enableThreeBonusRule) return true;

    const milestones = [10, 25, 45];
    const spawnedCount = game.bonusSpawnedCount || 0;
    if (spawnedCount >= milestones.length) return false;
    return game.clearedArea >= milestones[spawnedCount];
}
