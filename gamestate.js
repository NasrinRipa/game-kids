/**
 * Shared game singleton and core state classes.
 * All modules import `game` from here instead of using window globals.
 */

/**
 * Mutable shared state passed between all game modules at runtime.
 * Set up by the engine (picxonix.js) before any game starts.
 */
export const game = {
    config:  null,   // GameConfig instance
    state:   null,   // GameState instance
    level:   null,   // LevelConfig instance
    grid:    null,   // Grid instance  (playing field)
    cursor:  null,   // Cursor instance
    bonus:   null,   // Bonus instance

    /** Sprite images pre-rendered onto temporary canvases. */
    images: { cursor: null, ball: null, warder: null },

    /** Raw settings loaded from settings.json (the top-level "game" object). */
    settingsData: null,

    /** Level definitions loaded from settings.json. */
    levelsData: [],

    /** The DOM <div> that holds all game canvases. */
    wrapEl: null,

    /** Sub-pixel movement accumulators (carry the fractional part across frames). */
    cursorMoveAcc: 0,
    enemyMoveAcc:  0,

    /** Cumulative cleared-area percentage used for incremental score calculation. */
    clearedArea: 0,

    /** Tracks which conquest milestone percentages have been shown this level. */
    bannerMilestones: null,

    /** True while a timed bonus effect (speed, slow, sneaky, freez, tank) is still active. */
    bonusTimerActive: false,

    /** Timestamp (Date.now()) when the current timed bonus expires; 0 when inactive. */
    bonusTimerExpiresAt: 0,

    /** Handles for active timed-effect setTimeouts; cleared on level end. */
    activeEffectTimers: [],

    /** Cleanup callbacks for active timed effects; invoked on forced cancellation. */
    activeEffectCleanups: [],

    /** True when a conquest was triggered while sneaky (invincible) mode was active. */
    sneakyConquer: false,

    /**
     * The main game-loop function.
     * Set by the engine before the first loop starts so GameState.startLoop()
     * can reference it without a circular import.
     */
    loopFn: null,

    /**
     * UI callbacks populated by main.js.
     * The engine calls these to update the DOM without importing main.js.
     */
    ui: {
        setBanner:        (_text)            => {},
        updateStatus:     (_stage)           => {},
        onLevelComplete:  ()                 => {},
        onFault:          ()                 => {},
        showBonusCaptured:(_type, _hasTimer, _dur, _isEffectActive, _getRemainingMs) => {},
        showReady:        ()                 => {},
        showGoOn:         ()                 => {},
        showReadyToLevel: ()                 => {},
        showLevelComplete:()                 => {},
        showGameOver:     ()                 => {},
        showCongrats:     (_isLastLevel)     => {},
        showOops:         ()                 => {},
        showPaused:       ()                 => {},
        showConquer:      (_delta, _halfway, _opts) => {},
    },
};

// ─── GameConfig ───────────────────────────────────────────────────────────────

/** Immutable game-wide configuration (canvas size, colours, timing, levels). */
export class GameConfig {
    constructor() {
        this.gridCols = 60;   // playfield width in cells
        this.gridRows = 40;   // playfield height in cells
        this.cellSize = 10;

        /** Available level definitions — populated at runtime from settings.json. */
        this.levels = [];

        /** Folder containing level background images. */
        this.imageFolder = 'pics';

        /** Starting lives for each new game. */
        this.initialLives = 3;

        /** Whether to show the status bar in fullscreen mode. */
        this.fullscreenStatusbar = true;

        /** Stop the cursor when tank mode expires by timer (no conquest). */
        this.tankAutoStop = true;

        // ── Colours ──────────────────────────────────────────────────────────
        this.colorEmpty         = '#000000';   // unexplored cell interior
        this.colorBorder        = '#00aaaa';   // border ring / warder background
        this.colorBall          = '#ffffff';   // ball outer ring
        this.colorBallCenter    = '#000000';   // ball inner dot
        this.colorWarder        = '#000000';   // warder outer square
        this.colorWarderCenter  = '#f80000';   // warder inner square
        this.colorCursor        = '#aa00aa';   // cursor outer square
        this.colorCursorCenter  = '#00aaaa';   // cursor inner square
        this.colorCursorEffect  = '#ffffff';   // cursor color during timed bonuses
        this.colorTrail         = '#a800a8';   // active trail line
    }

    /** Canvas pixel width (grid columns × cell size). */
    get canvasWidth()  { return this.gridCols * this.cellSize; }

    /** Canvas pixel height (grid rows × cell size). */
    get canvasHeight() { return this.gridRows * this.cellSize; }
}

// ─── LevelConfig ─────────────────────────────────────────────────────────────

/** Mutable per-level state: enemy counts, speeds, and active object lists. */
export class LevelConfig {
    constructor(levelIndex, imageFile = null) {
        this.levelIndex        = levelIndex;
        this.ballCount         = 0;
        this.warderCount       = 1;
        this.targetAreaPercent = 80;   // % of field to clear to win the level
        this.enemySpeed        = 10;   // base enemy movement speed (cells/sec)
        this.enemySlowdown     = 0;    // speed reduction applied by bonuses
        this.isInvincible      = false; // true → enemy collisions are ignored
        this.balls             = [];
        this.warders           = [];
        this.tankMode          = false; // cursor clears trail as it moves
        this.imageFile         = imageFile; // image filename for this level
    }

    /** Load the background image for this level; calls onLoad(img) on success. */
    loadImage(onLoad) {
        const img    = new Image();
        img.onload   = () => onLoad(img);
        img.onerror  = () => console.error(`Failed to load image for level ${this.levelIndex} (file: ${this.imageFile})`);
        const folder = (game.config && game.config.imageFolder) ? game.config.imageFolder : 'pics';
        img.src      = `${folder}/${this.imageFile ?? 'pic' + this.levelIndex + '.png'}`;
    }
}

// ─── GameState ────────────────────────────────────────────────────────────────

/** Mutable game-wide runtime state plus canvas-drawing helpers. */
export class GameState {
    constructor(config) {
        /** Keep a reference so canvas helpers don't need the global `game` object. */
        this.config = config;

        this.totalLevels          = config.levels?.length ?? 0;
        this.levelIndex           = 0;

        // Timing
        this.levelStartTime       = 0;   // Date.now() timestamp when current level began
        this.levelElapsedSeconds  = 0;   // seconds elapsed in the current level
        this.totalElapsedSeconds  = 0;   // accumulated seconds across all completed levels

        // Flags
        this.isStarted    = false;
        this.isPlaying    = false;
        this.hasConquered = false;   // set by cursor logic; cleared each frame
        this.hasCollision = false;   // set by cursor/enemy logic; cleared each frame

        // Animation frame
        this.animFrameId   = 0;
        this.lastFrameTime = 0;   // rAF timestamp of the last rendered frame

        // Player stats
        this.score       = 0;
        this.lives       = 3;
        this.cursorSpeed = 15;
        this.bonusSpeed  = 0;   // temporary speed bonus from bonus items

        // 2D rendering contexts (set when canvases are created)
        this.mainCtx = null;   // main game canvas (sprites, trail, border)
        this.bgCtx   = null;   // background canvas (level image, revealed cells)
    }

    // ── Canvas Drawing Helpers ─────────────────────────────────────────────────
    // All coordinates are in grid-cell units.  The playfield has a 2-cell border,
    // so cell (x, y) maps to pixel ((x+2)*cellSize, (y+2)*cellSize).

    /** Fill the entire main canvas with the border colour. */
    fillCanvas() {
        const { canvasWidth: w, canvasHeight: h, cellSize: cs } = this.config;
        this.mainCtx.fillStyle = this.config.colorBorder;
        this.mainCtx.fillRect(0, 0, w + 4 * cs, h + 4 * cs);
    }

    /** Draw a sprite image at grid cell (x, y). */
    drawCellImage(img, x, y) {
        const cs = this.config.cellSize;
        this.mainCtx.drawImage(img, 0, 0, cs, cs, (x + 2) * cs, (y + 2) * cs, cs, cs);
    }

    /** Clear (erase) a rectangular block of cells, revealing the background image beneath. */
    clearCells(x, y, w = 1, h = 1) {
        const cs = this.config.cellSize;
        this.mainCtx.clearRect((x + 2) * cs, (y + 2) * cs, w * cs, h * cs);
    }

    /** Fill a rectangular block of cells with a solid colour (optional opacity). */
    fillCells(color, x, y, w = 1, h = 1, opacity = 1) {
        const cs  = this.config.cellSize;
        const ctx = this.mainCtx;
        if (opacity !== 1) ctx.globalAlpha = opacity;
        ctx.fillStyle = color;
        ctx.fillRect((x + 2) * cs, (y + 2) * cs, w * cs, h * cs);
        if (opacity !== 1) ctx.globalAlpha = 1;
    }

    // ── Animation Loop Control ─────────────────────────────────────────────────

    /** Schedule the next animation frame.  No-op if no level is active. */
    startLoop() {
        if (!this.levelStartTime) return;
        this.animFrameId = requestAnimationFrame(game.loopFn);
    }

    /** Cancel the scheduled animation frame and reset timing fields. */
    stopLoop() {
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
        this.lastFrameTime = this.animFrameId = 0;
    }
}
