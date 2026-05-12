/**
 * main.js – UI layer
 *
 * Bootstraps the page, wires up all DOM event handlers, manages button/banner
 * state, and registers UI callbacks with the game engine.
 */

import { game }                                          from './gamestate.js';
import {
    initWrapperEl,
    newGame,
    quitGame,
    loadCurrentLevel,
    loadLevels,
    endLevel,
    setCursorDirection,
    setCursorDirectionToward,
    setDebugOverlay,
    flashEffect,
} from './picxonix.js';
import { LEVEL_COMPLETE_DISPLAY_DELAY, FAULT_DISPLAY_DELAY } from './constants.js';
import { BannerController } from './banner.js';

const PASSWORD_GROUPS = [
    { key: 'upto5', targetLevel: 5 },
    { key: 'upto10', targetLevel: 10 },
    { key: 'uptoend', targetLevel: Infinity },
];

let passwordProfilesPromise = null;
let activePasswordProfile = null;

async function _sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function _buildPasswordProfiles() {
    const passSettings = game.passData ?? null;
    if (!passSettings) return [];

    const passmax = Math.max(0, Number(passSettings.passmax) || 0);
    const groups = PASSWORD_GROUPS.map((group) => ({
        ...group,
        prefix: String(passSettings[group.key] ?? ''),
        passwords: new Set(),
    }));

    for (const group of groups) {
        for (let i = 1; i <= passmax; i++) {
            const hash = await _sha256Hex(group.prefix + i);
            group.passwords.add(hash.slice(-4).toLowerCase());
        }
    }

    return groups;
}

async function _getPasswordProfiles() {
    if (!passwordProfilesPromise) passwordProfilesPromise = _buildPasswordProfiles();
    return passwordProfilesPromise;
}

function _getMaxPlayableLevelFromProfile(profile) {
    if (!profile) return game.state?.totalLevels ?? 0;
    const totalLevels = game.state?.totalLevels ?? 0;
    if (profile.targetLevel === Infinity) return totalLevels;
    return Math.min(profile.targetLevel, totalLevels);
}

async function _promptForPasswordProfile() {
    const profiles = await _getPasswordProfiles();
    if (!profiles.length) return { targetLevel: Infinity };

    while (true) {
        const rawPassword = window.prompt('Enter game password', '');
        if (rawPassword == null) return null;

        const password = rawPassword.trim().toLowerCase();
        if (!password) continue;

        let bestMatch = null;
        for (const profile of profiles) {
            if (!profile.passwords.has(password)) continue;
            if (!bestMatch || _getMaxPlayableLevelFromProfile(profile) > _getMaxPlayableLevelFromProfile(bestMatch)) {
                bestMatch = profile;
            }
        }

        if (bestMatch) return bestMatch;
        window.alert('Incorrect password.');
    }
}

async function _printAllPasswords() {
    const passSettings = game.passData ?? null;
    if (!passSettings) { console.warn('Settings not loaded — open the page in a browser first (settings.json loads on page load).'); return; }

    const passmax = Math.max(0, Number(passSettings.passmax) || 0);
    const rows = [];
    for (const group of PASSWORD_GROUPS) {
        const prefix = String(passSettings[group.key] ?? '');
        const label = group.targetLevel === Infinity ? 'all levels' : 'up to level ' + group.targetLevel;
        for (let i = 1; i <= passmax; i++) {
            const hash = await _sha256Hex(prefix + i);
            rows.push({ group: group.key, label, index: i, password: hash.slice(-4).toLowerCase() });
        }
    }
    console.table(rows);
}
window.printPasswords = () => _printAllPasswords().catch(console.error);

$(function () {

    // ── DOM references ─────────────────────────────────────────────────────────
    const $canvas        = $('#graphics');
    const $playBtn       = $('#play-btn');
    const $pauseBtn      = $('#pause-btn');
    const $levelDisplay  = $('#status-progress-current');

    // ── Banner controller ───────────────────────────────────────────────────────
    const bannerCanvas = document.getElementById('banner-canvas');
    const fsBannerCanvas = document.getElementById('fs-banner-canvas');
    const sidebarSpan  = document.getElementById('fs-s-banner');
    const banner       = new BannerController(
        bannerCanvas,
        fsBannerCanvas,
        sidebarSpan,
        () => !!(game.state && game.state.isStarted && game.state.isPlaying)
    );
    banner.showReadyToStart();

    // ── One-time setup ─────────────────────────────────────────────────────────
    initWrapperEl($canvas[0]);
    $('#status-progress-total').text(0);
    $playBtn.prop('disabled', true);

    loadLevels().then(() => {
        $playBtn.prop('disabled', false).show();
        banner.showReadyToStart();
        const introSrc = game.settingsData?.intro_image;
        if (introSrc) {
            const $img = $('#intro-img');
            $img.attr('src', introSrc);
            $img[0].onload = () => {
                updateLayout();
                // small delay to ensure layout dimensions are applied before fading in
                requestAnimationFrame(() => $img.css('opacity', 1));
            };
        }
        updateLayout();
    }).catch(err => {
        console.error('Failed to load settings.json:', err);
        $playBtn.prop('disabled', false).show();
        banner.showReadyToStart();
    });

    $(window).on('resize', updateLayout);
    document.addEventListener('fullscreenchange', updateLayout);
    document.addEventListener('webkitfullscreenchange', updateLayout);

    // Register UI callbacks so the engine can update the DOM.
    game.ui.setBanner = (text) => {
        banner.showText(text);
    };

    game.ui.showBonusCaptured = (type, hasTimer, durationSec, isEffectActive, getRemainingMs) =>
        banner.showBonusCaptured(type, hasTimer, durationSec, isEffectActive, getRemainingMs);
    game.ui.showReady    = () => banner.showReadyToStart();
    game.ui.showGoOn     = () => banner.showGoOn();
    game.ui.showReadyToLevel = () => banner.showReadyToLevel();
    game.ui.showLevelComplete = () => banner.showLevelComplete();
    game.ui.showGameOver = () => banner.showGameOver();
    game.ui.showCongrats = (isLastLevel) => banner.showCongrats(isLastLevel);
    game.ui.showOops     = (cb) => banner.showOops(cb);
    game.ui.showPaused = () => banner.showPaused();
    game.ui.showConquer = (deltaScore, showHalfway, opts) => banner.showConquer(deltaScore, showHalfway, opts);

    game.ui.updateStatus = (stage) => {
        if (stage === 'init' || stage === 'quit') {
            $('#status-progress-current').text('-');
            $('#status-time').text('--:--');
            $('#status-points').text('-');
            $('#status-speed').text('-');
            $('#status-enemy').text('-');
            $('#status-life').text('-');
            $('#status-score').text('-');
            $('#fs-s-level').text('-');
            $('#fs-s-time').text('--:--');
            $('#fs-s-points').text('-');
            $('#fs-s-speed').text('-');
            $('#fs-s-enemy').text('-');
            $('#fs-s-life').text('-');
            $('#fs-s-score').text('-');
        } else {
            const s = game.state, l = game.level;
            $('#status-speed').text(s.cursorSpeed + s.bonusSpeed);
            $('#status-enemy').text((l.enemySpeed - l.enemySlowdown).toFixed(1));
            $('#status-life').text(s.lives);
            $('#status-score').text(s.score.toFixed(0));
            $('#fs-s-speed').text(s.cursorSpeed + s.bonusSpeed);
            $('#fs-s-enemy').text((l.enemySpeed - l.enemySlowdown).toFixed(1));
            $('#fs-s-life').text(s.lives);
            $('#fs-s-score').text(s.score.toFixed(0));
        }
    };

    game.ui.onLevelComplete = _onLevelComplete;
    game.ui.onFault         = _onFault;

    // null = follow settings, true = force show sidebar, false = force hide sidebar
    let sidebarOverride = null;

    function _setPaused(paused, showDebugOverlay = false) {
        if (!game.state?.isStarted) return;

        game.state.isPlaying = !paused;
        setDebugOverlay(paused && showDebugOverlay);

        if (game.state.isPlaying) {
            game.state.startLoop();
            banner.showGoOn();
            $pauseBtn.html('<span class="glyphicon glyphicon-pause"></span> Pause').show();
        } else {
            game.state.stopLoop();
            banner.showPaused();
            $pauseBtn.html('<span class="glyphicon glyphicon-play"></span> Unpause').show();
        }
    }

    function _togglePause(showDebugOverlay = false) {
        if (!game.state?.isStarted) return;
        if (game.state.isPlaying) {
            _setPaused(true, showDebugOverlay);
        } else {
            _setPaused(false, false);
        }
    }

    // ── Keyboard input ─────────────────────────────────────────────────────────
    const KEY_DIRS = { 37: 'left', 39: 'right', 38: 'up', 40: 'down', 32: 'stop' };

    $(document).keydown((e) => {
        const key = e.which;

        if (key === 13) {                     // Enter – start / next level
            if (!$playBtn.prop('disabled')) {
                e.preventDefault();
                $playBtn.trigger('click');
            }
            return;
        }

        if (key === 81 || key === 113) {      // Q – quit to home page
            if (game.state?.isStarted || game.state?.isPlaying) {
                e.preventDefault();
                _quit();
                window.location.href = 'index.html';
            }
            return;
        }

        if (key === 27 || key === 80 || key === 112) {  // Esc or P – pause / resume
            if (game.state?.isStarted) {
                e.preventDefault();
                _togglePause(false);
            }
            return;
        }

        if (key === 79 || key === 111) {      // O – pause with debug marks
            if (game.state?.isStarted) {
                e.preventDefault();
                if (game.state.isPlaying) {
                    _setPaused(true, true);
                } else {
                    _setPaused(false, false);
                }
            }
            return;
        }

        if (key === 70 || key === 102 || key === 83 || key === 115) {  // F or S – toggle sidebar
            const isFs = window.innerHeight >= screen.height - 5;
            if (isFs) {
                e.preventDefault();
                const sd = game.settingsData ?? {};
                // Determine what is currently showing so we can flip it
                let currentlyShown;
                if (sidebarOverride !== null) {
                    currentlyShown = sidebarOverride;
                } else {
                    const sLoc = sd.sidebar_loc ?? 'auto';
                    currentlyShown = sLoc !== 'off' && sLoc !== 'none';
                }
                sidebarOverride = !currentlyShown;
                updateLayout();
            }
            return;
        }

        if (key === 16) {                     // Shift – stop cursor (unless an arrow is held)
            if (game.state?.isPlaying) {
                e.preventDefault();
                if (game.heldArrowKey) {
                    // Arrow already held: enter slow-step mode.
                    game.shiftSlowDir = KEY_DIRS[game.heldArrowKey];
                    game.shiftLastStepTime = performance.now() - (game.settingsData?.cursor_slow_timer ?? 500); // fire first step immediately
                    setCursorDirection('stop');
                } else {
                    game.shiftSlowDir = null;
                    setCursorDirection('stop');
                }
            }
            return;
        }

        if (!game.state?.isPlaying || !(key in KEY_DIRS)) return;
        e.preventDefault();

        if (!e.shiftKey && key !== 32) {
            // Plain arrow: track as held key, move normally.
            game.heldArrowKey = key;
            game.shiftSlowDir = null;
        }

        if (e.shiftKey && key !== 32) {
            const now = performance.now();
            const dir = KEY_DIRS[key];
            game.heldArrowKey = key;   // track so shift-release can resume normal movement
            if (!game.shiftSlowDir) {
                // First Shift+Arrow press: step once immediately, then enter slow mode.
                game.manualStepQueue = game.manualStepQueue || [];
                game.manualStepQueue.push(dir);
                game.shiftLastStepTime = now;
                game.shiftSlowDir = dir;
                console.log(`[shift] fresh press, slow mode started`);
            }
            // Subsequent key events ignored – game loop handles the timer.
            return;
        }

        setCursorDirection(KEY_DIRS[key]);
    });

    $(document).keyup((e) => {
        const key = e.which;
        if (key === 16) {                                 // Shift released
            game.shiftSlowDir = null;
            game.shiftLastStepTime = 0;
            if (game.state?.isPlaying) {
                if (game.heldArrowKey) {
                    // Arrow still held: resume normal movement.
                    setCursorDirection(KEY_DIRS[game.heldArrowKey]);
                } else {
                    setCursorDirection('stop');
                }
            }
        } else if (key in KEY_DIRS && key !== 32) {       // Arrow released
            if (game.heldArrowKey === key) game.heldArrowKey = null;
            if (game.shiftSlowDir === KEY_DIRS[key]) {
                game.shiftSlowDir = null;
                game.shiftLastStepTime = 0;
                if (game.state?.isPlaying) setCursorDirection('stop');
            }
        }
    });

    // ── Canvas click → cursor direction ───────────────────────────────────────
    $canvas.on('click', (e) => {
        if (!game.state?.isPlaying) return;
        // game.wrapEl is the inner div with explicit pixel dimensions equal to
        // the game canvas size.  Using it (not #graphics) gives the correct
        // origin and size for coordinate mapping.
        const el   = game.wrapEl || $canvas[0];
        const rect = el.getBoundingClientRect();
        // offsetWidth/Height are layout pixels (before CSS zoom on parent).
        // rect.width/height are visual pixels (after zoom).  Dividing gives the
        // factor needed to convert a visual-pixel offset into canvas pixels.
        const scaleX  = el.offsetWidth  / rect.width;
        const scaleY  = el.offsetHeight / rect.height;
        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top)  * scaleY;
        setCursorDirectionToward([canvasX, canvasY]);
    });

    // ── Play / Pause buttons ───────────────────────────────────────────────────
    $playBtn.on('click', (e) => {
        e.preventDefault();
        void _fadeIntroThenStart();
    });

    $pauseBtn.on('click', (e) => {
        e.preventDefault();
        _togglePause();
    });

    // ── Internal helpers ───────────────────────────────────────────────────────

    async function _fadeIntroThenStart() {
        const $img = $('#intro-img');
        const passwordProfile = await _promptForPasswordProfile();
        if (!passwordProfile) return;
        activePasswordProfile = passwordProfile;

        if ($img.css('opacity') !== '0' && $img.is(':visible') && $img.attr('src')) {
            $img.css('opacity', 0);
            setTimeout(() => {
                $img.hide();
                _startNewGame();
                _startLevel();
            }, 500);
        } else {
            _startNewGame();
            _startLevel();
        }
    }

    function _startNewGame() {
        newGame();
        game.state.maxPlayableLevel = _getMaxPlayableLevelFromProfile(activePasswordProfile);
        $('#status-progress-total').text(game.state.totalLevels);
        updateLayout();
    }

    function _startLevel() {
        if (!game.level || game.level.levelIndex < 1) return;

        const s  = game.settingsData  ?? {};
        const al = game.allLevelsData ?? {};
        const each_level_lives = al.each_level_lives ?? s.each_level_lives ?? null;
        if (each_level_lives != null && each_level_lives > 0) {
            game.state.lives = each_level_lives;
        }

        // Update button area.
        $playBtn.prop('disabled', true).hide();
        $pauseBtn.html('<span class="glyphicon glyphicon-pause"></span> Pause').show();

        if (!game.state.isStarted) $('.my-panel').removeClass('hidden');

        setDebugOverlay(false);

        game.state.isStarted  = true;
        game.state.isPlaying  = true;
        game.state.hasConquered = false;
        game.state.hasCollision = false;

        $levelDisplay.text(game.state.levelIndex);
        $('#fs-s-level').text(game.state.levelIndex + '/' + game.state.totalLevels);

        banner.showGoOn();

        loadCurrentLevel();
    }

    function _quit() {
        setDebugOverlay(false);
        endLevel(false);
        quitGame();

        $pauseBtn.hide();
        $playBtn.prop('disabled', false).show()
            .html('<span class="glyphicon glyphicon-repeat"></span> Try Again')
            .off('click').on('click', (e) => {
                e.preventDefault();
                _startNewGame();
                _startLevel();
            });
    }

    function _onFault() {
        setTimeout(() => {
            $pauseBtn.hide();
            $playBtn.prop('disabled', false).show()
                .html('<span class="glyphicon glyphicon-play"></span> Play')
                .off('click').on('click', (e) => {
                    e.preventDefault();
                    _startNewGame();
                    _startLevel();
                });
        }, FAULT_DISPLAY_DELAY);
    }

    function _onLevelComplete() {
        setDebugOverlay(false);
        game.state.isPlaying  = false;
        game.state.isStarted  = false;

        setTimeout(() => {
            const maxPlayableLevel = game.state.maxPlayableLevel ?? game.state.totalLevels;
            const hasMoreLevels = game.state.levelIndex < Math.min(maxPlayableLevel, game.state.totalLevels);

            $pauseBtn.hide();

            if (hasMoreLevels) {
                $playBtn.prop('disabled', false).show()
                    .html('<span class="glyphicon glyphicon-play"></span> Next Level')
                    .off('click').on('click', (e) => {
                        e.preventDefault();
                        game.state.levelIndex++;
                        _startLevel();
                    });
                banner.showReadyToLevel();
            } else {
                $playBtn.prop('disabled', false).show()
                    .html('<span class="glyphicon glyphicon-repeat"></span> Play Again')
                    .off('click').on('click', (e) => {
                        e.preventDefault();
                        _startNewGame();
                        _startLevel();
                    });
                banner.showReadyToStart();
            }
        }, LEVEL_COMPLETE_DISPLAY_DELAY);
    }

    // ── Layout / fullscreen ────────────────────────────────────────────────────

    // Predefined font scale map: fraction of slot dimension and bar dimension
    const SIDEBAR_FONT_SCALES = {
        title:  { ofSlot: 0.50, ofBar: 0.30 },
        value:  { ofSlot: 0.46, ofBar: 0.38 },
        label:  { ofSlot: 0.28, ofBar: 0.22 },
        banner: { ofSlot: 0.28, ofBar: 0.22 },
    };

    /**
     * Compute sidebar font sizes.
     * barDim  – the sidebar's narrow dimension (width for vertical, height for horizontal)
     * slotDim – one slot's narrow dimension (height for vertical, width for horizontal)
     * Value font is reduced 30% from the auto-computed size unless explicitly set.
     */
    function _sidebarFonts(s, barDim, slotDim) {
        const fTitle  = typeof s.title_fontsize === 'number'
            ? s.title_fontsize
            : Math.max(10, Math.round(Math.min(barDim * SIDEBAR_FONT_SCALES.title.ofBar,  slotDim * SIDEBAR_FONT_SCALES.title.ofSlot)));
        const fValue  = typeof s.sidebar_value_fontsize === 'number'
            ? s.sidebar_value_fontsize
            : Math.max(10, Math.round(Math.min(barDim * SIDEBAR_FONT_SCALES.value.ofBar,  slotDim * SIDEBAR_FONT_SCALES.value.ofSlot) * 0.7));
        const fLabel  = typeof s.sidebar_item_fontsize === 'number'
            ? s.sidebar_item_fontsize
            : Math.max(7,  Math.round(Math.min(barDim * SIDEBAR_FONT_SCALES.label.ofBar,  slotDim * SIDEBAR_FONT_SCALES.label.ofSlot)));
        const fBanner = typeof s.banner_fontsize === 'number'
            ? s.banner_fontsize
            : Math.max(7,  Math.round(Math.min(barDim * SIDEBAR_FONT_SCALES.banner.ofBar, slotDim * SIDEBAR_FONT_SCALES.banner.ofSlot)));
        return { fTitle, fValue, fLabel, fBanner };
    }

    function _applySidebarFonts({ fTitle, fValue, fLabel, fBanner }) {
        const sidebar = document.getElementById('fs-sidebar');
        sidebar.style.setProperty('--fs-font-title',  fTitle  + 'px');
        sidebar.style.setProperty('--fs-font-value',  fValue  + 'px');
        sidebar.style.setProperty('--fs-font-label',  fLabel  + 'px');
        sidebar.style.setProperty('--fs-font-banner', fBanner + 'px');
    }

    function _updateNarrowSidebarVisibility() {
        const s = game.settingsData ?? {};
        const showNarrow = s.narrow_sidebar_show ?? true;
        const displayVal = showNarrow ? 'block' : 'none';
        const leftEl  = document.getElementById('narrow-left-sidebar');
        const rightEl = document.getElementById('narrow-right-sidebar');
        if (leftEl)  leftEl.style.display  = displayVal;
        if (rightEl) rightEl.style.display = displayVal;
    }

    function updateLayout() {
        const s  = game.settingsData ?? {};
        const cs = s.cellSize ?? 10;
        // Compute effective narrow sidebar width based on visibility rules.
        const rawSbarW  = s.narrow_sidebar_width ?? game.narrowSidebarWidth ?? 0;
        const showNarrow = s.narrow_sidebar_show ?? true;
        const sbarW = showNarrow ? rawSbarW : 0;
        // Parse a sidebar_width/height value that may be a number or numeric string.
        const parseDim = (v) => { const n = Number(v); return isFinite(n) && n > 0 ? n : null; };
        _updateNarrowSidebarVisibility();

        // Save original grid dimensions once (before grid_autofit may overwrite them)
        if (s.gridCols != null && s._gridColsOrig == null) s._gridColsOrig = s.gridCols;
        if (s.gridRows != null && s._gridRowsOrig == null) s._gridRowsOrig = s.gridRows;
        const origCols = s._gridColsOrig ?? s.gridCols ?? 60;
        const origRows = s._gridRowsOrig ?? s.gridRows ?? 40;

        const isFs = window.innerHeight >= screen.height - 5;
        const gridAutofit = s.grid_autofit ?? false;

        // Toggle non-playfield elements.
        $('.controls-row').toggle(!isFs);
        $('.hint-row').toggle(!isFs);

        if (!isFs) {
            $('body').removeClass('fs-mode');
            $('#fs-sidebar').hide().removeClass('fs-sidebar-top fs-sidebar-right fs-sidebar-bottom');
            $('#statusbar').show();

            let layoutCols, layoutRows;
            if (gridAutofit) {
                // Pre-compute fullscreen grid dims so newGame() creates the canvas at the correct size.
                // sidebar_loc:'auto' → 'off' here because grid isn't calculated yet to find best position.
                const _sLoc = s.sidebar_loc ?? 'auto';
                const natPos = (_sLoc === 'left' || _sLoc === 'right' || _sLoc === 'top' || _sLoc === 'bottom')
                    ? _sLoc : 'off';
                if (natPos === 'off') {
                    layoutCols = Math.max(1, Math.floor((screen.width  - 2 * sbarW) / cs) - 4);
                    layoutRows = Math.max(1, Math.floor(screen.height / cs) - 4);
                } else if (natPos === 'left' || natPos === 'right') {
                    const sw = parseDim(s.sidebar_width) ?? 80;
                    layoutCols = Math.max(1, Math.floor((screen.width - sw - 2 * sbarW) / cs) - 4);
                    layoutRows = Math.max(1, Math.floor(screen.height / cs) - 4);
                } else {
                    const sh = parseDim(s.sidebar_height) ?? 50;
                    layoutCols = Math.max(1, Math.floor((screen.width  - 2 * sbarW) / cs) - 4);
                    layoutRows = Math.max(1, Math.floor((screen.height - sh) / cs) - 4);
                }
                s.gridCols = layoutCols; s.gridRows = layoutRows;
                console.log('[grid_autofit windowed pre-calc] screen:', screen.width + 'x' + screen.height,
                    '| fsSidebar:', natPos, '| grid:', layoutCols + 'x' + layoutRows);
            } else {
                // Restore original grid dimensions if grid_autofit had previously modified them.
                if (s._gridColsOrig != null) { s.gridCols = s._gridColsOrig; s.gridRows = s._gridRowsOrig; }
                layoutCols = origCols; layoutRows = origRows;
            }

            const totalW = (layoutCols + 4) * cs + 2 * sbarW;
            const totalH = (layoutRows + 4) * cs;
            const uiH    = 180;
            const availW = window.innerWidth  - 24;
            const availH = window.innerHeight - uiH - ($('#statusbar').outerHeight(true) || 42);
            const scale  = Math.min(1, availW / totalW, availH / totalH);
            const pageW  = Math.max(Math.round(totalW * scale) + 24, 400);
            $('.page-wrap').css({ width: pageW + 'px', 'max-width': '', margin: '0 auto 10px', padding: '', 'flex-direction': '' });
            $('#game-area').css({ zoom: scale, width: totalW + 'px', margin: '0 auto', 'flex-shrink': '' });
            const gameAreaW = Math.round(totalW * scale);
            const ctrlH = Math.max(60, Math.min(120, Math.round(gameAreaW / 8)));
            const btnW  = Math.min(Math.round(gameAreaW / 2 * 0.70), 220);
            $('.controls-row').css({ width: gameAreaW + 'px', height: ctrlH + 'px', margin: '0 auto 10px', 'max-width': '' });
            $('#play-btn, #pause-btn').css({ width: '', height: '', 'max-width': '' });
            const introW = totalW, introH = totalH;
            const $img = $('#intro-img');
            if ($img.attr('src')) $img.css({ width: introW + 'px', height: introH + 'px' });
            banner.syncSizes();
            return;
        }

        $('body').addClass('fs-mode');
        $('.page-wrap').css({ width: '100%', 'max-width': 'none', margin: '0', padding: '0' });
        $('#statusbar').hide();

        // Determine sidebar position from sidebar_loc.
        // 'auto' → aspect-ratio detection. 'off'/'none' → hidden. Explicit side → pinned.
        // sidebarOverride (F/S key toggle) can force show (true) or hide (false).
        const _sLocFs = s.sidebar_loc ?? 'auto';
        function _resolvePos() {
            if (_sLocFs === 'off' || _sLocFs === 'none') return 'off';
            if (_sLocFs === 'left' || _sLocFs === 'right' || _sLocFs === 'top' || _sLocFs === 'bottom') return _sLocFs;
            // 'auto' + grid_autofit → full screen to grid, no sidebar
            if (gridAutofit) return 'off';
            const gameAspect   = ((origCols + 4) * cs) / ((origRows + 4) * cs);
            const screenAspect = window.innerWidth / window.innerHeight;
            return screenAspect > gameAspect ? 'left' : 'top';
        }
        const _naturalSidebarOff = _resolvePos() === 'off';
        // When gridAutofit+auto natural pos is 'off' but user forces sidebar on,
        // keep grid cols/rows fixed and scale to fit; don't recalculate the grid.
        const _scaleFitOverride = gridAutofit && sidebarOverride === true && _naturalSidebarOff;
        // When user explicitly hides a naturally-shown sidebar, keep the current grid
        // dimensions and scale to fit — don't recalculate cols/rows to fill the screen.
        const _overrideHide = sidebarOverride === false && !_naturalSidebarOff;
        let sidebarPos;
        if (sidebarOverride === false) {
            sidebarPos = 'off';
        } else if (sidebarOverride === true) {
            if (_naturalSidebarOff) {
                sidebarPos = window.innerWidth > window.innerHeight ? 'right' : 'top';
            } else {
                sidebarPos = _resolvePos();
            }
        } else {
            sidebarPos = _resolvePos();
        }

        // ── No sidebar ──────────────────────────────────────────────────────────
        if (sidebarPos === 'off') {
            $('#fs-sidebar').hide().removeClass('fs-sidebar-top fs-sidebar-right fs-sidebar-bottom');
            let cols, rows, scale;
            if (gridAutofit && !_overrideHide) {
                const fsW = screen.width, fsH = screen.height;
                cols = Math.max(1, Math.floor((fsW - 2 * sbarW) / cs) - 4);
                rows = Math.max(1, Math.floor(fsH / cs) - 4);
                s.gridCols = cols; s.gridRows = rows;
                scale = 1;
                console.log('[grid_autofit no-sidebar] screen:', fsW + 'x' + fsH,
                    '| available:', (fsW - 2 * sbarW) + 'x' + fsH,
                    '| grid:', cols + 'x' + rows);
            } else {
                // _overrideHide or non-autofit: keep current grid, scale to fit screen.
                cols = s.gridCols ?? origCols;
                rows = s.gridRows ?? origRows;
                const tw = (cols + 4) * cs + 2 * sbarW, th = (rows + 4) * cs;
                scale = Math.min(window.innerWidth / tw, window.innerHeight / th);
            }
            const gameAreaW = (cols + 4) * cs + 2 * sbarW;
            $('.page-wrap').css({ 'flex-direction': 'row', 'padding-left': '0', 'padding-top': '0' });
            $('#game-area').css({ zoom: scale, width: gameAreaW + 'px', margin: '0', 'flex-shrink': '0' });
            { const $_i = $('#intro-img'); if ($_i.attr('src')) $_i.css({ width: gameAreaW + 'px', height: (rows + 4) * cs + 'px' }); }
            banner.syncSizes();
            return;
        }

        const isVertical = sidebarPos === 'left' || sidebarPos === 'right';

        // ── Vertical sidebar (left / right) ────────────────────────────────────
        if (isVertical) {
            let sidebarW, cols, rows, scale;

            if (gridAutofit && !_scaleFitOverride) {
                const _sw = parseDim(s.sidebar_width);
                if (_sw === null) {
                    console.warn('[grid_autofit] sidebar_width must be a number; defaulting to 80');
                    sidebarW = 200;
                } else {
                    sidebarW = _sw;
                }
                const fsW = screen.width, fsH = screen.height;
                const availW = fsW - sidebarW - 2 * sbarW;
                cols = Math.max(1, Math.floor(availW / cs) - 4);
                rows = Math.max(1, Math.floor(fsH / cs) - 4);
                sidebarW += (fsW - 2 * sbarW) - sidebarW - (cols + 4) * cs;   // absorb width remainder
                s.gridCols = cols; s.gridRows = rows;
                scale = 1;
                console.log('[grid_autofit ' + sidebarPos + '-sidebar] screen:', fsW + 'x' + fsH,
                    '| available:', availW + 'x' + fsH,
                    '| grid:', cols + 'x' + rows, '| sidebarW:', sidebarW);
            } else {
                const _efCols = _scaleFitOverride ? (s.gridCols ?? origCols) : origCols;
                const _efRows = _scaleFitOverride ? (s.gridRows ?? origRows) : origRows;
                const totalW = (_efCols + 4) * cs + 2 * sbarW, totalH = (_efRows + 4) * cs;
                cols = _efCols; rows = _efRows;
                const _sw2 = parseDim(s.sidebar_width);
                if (_sw2 !== null) {
                    sidebarW = _sw2;
                    const availW = window.innerWidth - sidebarW;
                    scale = Math.min(window.innerHeight / totalH, availW / totalW);
                } else {
                    const minSW = 80;
                    scale = window.innerHeight / totalH;
                    if (totalW * scale > window.innerWidth - minSW)
                        scale = (window.innerWidth - minSW) / totalW;
                    sidebarW = Math.max(minSW, Math.floor(window.innerWidth - totalW * scale));
                }
            }

            const canvasH = Math.round((rows + 4) * cs * scale);
            const slotH   = canvasH / 9;
            const fonts   = _sidebarFonts(s, sidebarW, slotH);
            _applySidebarFonts(fonts);
            console.log('[FS ' + sidebarPos + ' sidebar] page:', window.innerWidth + 'x' + window.innerHeight,
                '| playfield:', Math.round(((cols + 4) * cs + 2 * sbarW) * scale) + 'x' + canvasH,
                '| sidebar:', sidebarW + 'x' + canvasH);

            $('.page-wrap').css({ 'flex-direction': 'row', 'padding-left': '0', 'padding-top': '0' });
            $('#fs-sidebar')
                .removeClass('fs-sidebar-top fs-sidebar-right fs-sidebar-bottom')
                .toggleClass('fs-sidebar-right', sidebarPos === 'right')
                .css({ display: 'flex', width: sidebarW + 'px', height: canvasH + 'px' });
            $('#game-area').css({ zoom: scale, width: (cols + 4) * cs + 2 * sbarW + 'px', margin: '0', 'flex-shrink': '0' });
            { const $_i = $('#intro-img'); if ($_i.attr('src')) $_i.css({ width: (cols + 4) * cs + 2 * sbarW + 'px', height: (rows + 4) * cs + 'px' }); }
            banner.syncSizes();

        // ── Horizontal sidebar (top / bottom) ──────────────────────────────────
        } else {
            let sidebarH, cols, rows, scale;

            if (gridAutofit && !_scaleFitOverride) {
                const _sh = parseDim(s.sidebar_height);
                if (_sh === null) {
                    console.warn('[grid_autofit] sidebar_height must be a number; defaulting to 50');
                    sidebarH = 100;
                } else {
                    sidebarH = _sh;
                }
                const fsW = screen.width, fsH = screen.height;
                const availH = fsH - sidebarH;
                cols = Math.max(1, Math.floor((fsW - 2 * sbarW)  / cs) - 4);
                rows = Math.max(1, Math.floor(availH / cs) - 4);
                sidebarH += availH - (rows + 4) * cs;   // absorb height remainder
                s.gridCols = cols; s.gridRows = rows;
                scale = 1;
                console.log('[grid_autofit ' + sidebarPos + '-sidebar] screen:', fsW + 'x' + fsH,
                    '| available:', (fsW - 2 * sbarW) + 'x' + availH,
                    '| grid:', cols + 'x' + rows, '| sidebarH:', sidebarH);
            } else {
                const _efCols = _scaleFitOverride ? (s.gridCols ?? origCols) : origCols;
                const _efRows = _scaleFitOverride ? (s.gridRows ?? origRows) : origRows;
                const totalW = (_efCols + 4) * cs + 2 * sbarW, totalH = (_efRows + 4) * cs;
                cols = _efCols; rows = _efRows;
                const _sh2 = parseDim(s.sidebar_height);
                if (_sh2 !== null) {
                    sidebarH = _sh2;
                    const availH = window.innerHeight - sidebarH;
                    scale = Math.min(window.innerWidth / totalW, availH / totalH);
                } else {
                    const minSH = 50;
                    scale = window.innerWidth / totalW;
                    if (totalH * scale > window.innerHeight - minSH)
                        scale = (window.innerHeight - minSH) / totalH;
                    sidebarH = Math.max(minSH, Math.floor(window.innerHeight - totalH * scale));
                }
            }

            const canvasW = Math.round(((cols + 4) * cs + 2 * sbarW) * scale);
            const slotW   = canvasW / 9;
            const fonts   = _sidebarFonts(s, sidebarH, slotW);
            _applySidebarFonts(fonts);
            console.log('[FS ' + sidebarPos + ' sidebar] page:', window.innerWidth + 'x' + window.innerHeight,
                '| playfield:', canvasW + 'x' + Math.round((rows + 4) * cs * scale),
                '| sidebar:', canvasW + 'x' + sidebarH);

            $('.page-wrap').css({ 'flex-direction': 'column', 'padding-left': '0', 'padding-top': '0' });
            $('#fs-sidebar')
                .removeClass('fs-sidebar-top fs-sidebar-right fs-sidebar-bottom')
                .addClass('fs-sidebar-top')
                .toggleClass('fs-sidebar-bottom', sidebarPos === 'bottom')
                .css({ display: 'flex', width: canvasW + 'px', height: sidebarH + 'px' });
            $('#game-area').css({ zoom: scale, width: (cols + 4) * cs + 2 * sbarW + 'px', margin: '0', 'flex-shrink': '0' });
            { const $_i = $('#intro-img'); if ($_i.attr('src')) $_i.css({ width: (cols + 4) * cs + 2 * sbarW + 'px', height: (rows + 4) * cs + 'px' }); }
            banner.syncSizes();
        }
    }

    // Call once after layout helpers/constants are initialized.
    updateLayout();

});
