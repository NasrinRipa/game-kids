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
    flashEffect,
} from './picxonix.js';
import { LEVEL_COMPLETE_DISPLAY_DELAY, FAULT_DISPLAY_DELAY } from './constants.js';
import { BannerController } from './banner.js';

$(function () {

    // ── DOM references ─────────────────────────────────────────────────────────
    const $canvas        = $('#graphics');
    const $playBtn       = $('#play-btn');
    const $gameStatusTxt = $('#game-status-text');
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
        $playBtn.prop('disabled', false);
        banner.showReadyToStart();
        updateLayout();
    }).catch(err => {
        console.error('Failed to load settings.json:', err);
        $playBtn.prop('disabled', false);
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
    game.ui.showOops     = () => banner.showOops();
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

        if (key === 81 || key === 113) {      // Q – quit to start screen
            if (game.state?.isStarted || game.state?.isPlaying) {
                e.preventDefault();
                _quit();
            }
            return;
        }

        if (key === 27) {                     // Esc – pause / resume
            if (game.state?.isStarted) {
                game.state.isPlaying = !game.state.isPlaying;
                if (game.state.isPlaying) {
                    game.state.startLoop();
                    banner.showGoOn();
                } else {
                    game.state.stopLoop();
                    banner.showPaused();
                }
            }
            return;
        }

        if (!game.state?.isPlaying || !(key in KEY_DIRS)) return;
        e.preventDefault();
        setCursorDirection(KEY_DIRS[key]);
    });

    // ── Canvas click → cursor direction ───────────────────────────────────────
    $canvas.on('click', (e) => {
        if (!game.state?.isPlaying) return;
        const offset = $canvas.offset();
        setCursorDirectionToward([e.pageX - offset.left, e.pageY - offset.top]);
    });

    // ── Play button ───────────────────────────────────────────────────────────
    $playBtn.show().on('click', (e) => {
        e.preventDefault();
        _startNewGame();
        _startLevel();
    });

    // ── Internal helpers ───────────────────────────────────────────────────────

    function _startNewGame() {
        newGame();
        $('#status-progress-total').text(game.state.totalLevels);
    }

    function _startLevel() {
        if (!game.level || game.level.levelIndex < 1) return;

        // Update button area.
        $playBtn.prop('disabled', true).hide();
        $gameStatusTxt.show();

        if (!game.state.isStarted) $('.my-panel').removeClass('hidden');

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
        endLevel(false);
        quitGame();

        $gameStatusTxt.hide();
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
            $gameStatusTxt.hide();
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
        game.state.isPlaying  = false;
        game.state.isStarted  = false;

        setTimeout(() => {
            const hasMoreLevels = game.state.levelIndex < game.state.totalLevels;

            $gameStatusTxt.hide();

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

    function updateLayout() {
        const s  = game.settingsData ?? {};
        const cs = s.cellSize ?? 10;

        // Save original grid dimensions once (before grid_autofit may overwrite them)
        if (s.gridCols != null && s._gridColsOrig == null) s._gridColsOrig = s.gridCols;
        if (s.gridRows != null && s._gridRowsOrig == null) s._gridRowsOrig = s.gridRows;
        const origCols = s._gridColsOrig ?? s.gridCols ?? 60;
        const origRows = s._gridRowsOrig ?? s.gridRows ?? 40;

        const isFs = window.innerHeight >= screen.height - 5;

        // Toggle non-playfield elements.
        $('h3.text-center').toggle(!isFs);
        $('.controls-row').toggle(!isFs);
        $('.hint-row').toggle(!isFs);

        if (!isFs) {
            $('body').removeClass('fs-mode');
            $('#fs-sidebar').hide().removeClass('fs-sidebar-top fs-sidebar-right fs-sidebar-bottom');
            $('#statusbar').show();
            // Restore original grid dimensions if grid_autofit had modified them.
            if (s._gridColsOrig != null) { s.gridCols = s._gridColsOrig; s.gridRows = s._gridRowsOrig; }
            const totalW = (origCols + 4) * cs;
            const totalH = (origRows + 4) * cs;
            const uiH    = 180;
            const availW = window.innerWidth  - 24;
            const availH = window.innerHeight - uiH - ($('#statusbar').outerHeight(true) || 42);
            const scale  = Math.min(1, availW / totalW, availH / totalH);
            const pageW  = Math.max(Math.round(totalW * scale) + 24, 400);
            $('.page-wrap').css({ width: pageW + 'px', 'max-width': '', margin: '0 auto 10px', padding: '', 'flex-direction': '' });
            $('#game-area').css({ zoom: scale, width: totalW + 'px', margin: '0 auto', 'flex-shrink': '' });
            banner.syncSizes();
            return;
        }

        $('body').addClass('fs-mode');
        $('.page-wrap').css({ width: '100%', 'max-width': 'none', margin: '0', padding: '0' });
        $('#statusbar').hide();

        // Determine sidebar position.
        // Explicit setting: 'left'|'right'|'top'|'bottom'|'off'
        // null / missing: auto-detect from aspect ratio (legacy fullscreen_statusbar respected)
        let sidebarPos = s.sidebar ?? null;
        if (sidebarPos == null) {
            const showSidebar = s.fullscreen_statusbar ?? true;
            if (!showSidebar) {
                sidebarPos = 'off';
            } else {
                const gameAspect   = ((origCols + 4) * cs) / ((origRows + 4) * cs);
                const screenAspect = window.innerWidth / window.innerHeight;
                sidebarPos = screenAspect > gameAspect ? 'left' : 'top';
            }
        }

        const gridAutofit = s.grid_autofit ?? false;

        // ── No sidebar ──────────────────────────────────────────────────────────
        if (sidebarPos === 'off') {
            $('#fs-sidebar').hide().removeClass('fs-sidebar-top fs-sidebar-right fs-sidebar-bottom');
            let cols, rows, scale;
            if (gridAutofit) {
                cols = Math.max(1, Math.floor(window.innerWidth  / cs) - 4);
                rows = Math.max(1, Math.floor(window.innerHeight / cs) - 4);
                s.gridCols = cols; s.gridRows = rows;
                scale = 1;
            } else {
                cols = origCols; rows = origRows;
                const tw = (cols + 4) * cs, th = (rows + 4) * cs;
                scale = Math.min(window.innerWidth / tw, window.innerHeight / th);
            }
            const scaledW = Math.round((cols + 4) * cs * scale);
            const scaledH = Math.round((rows + 4) * cs * scale);
            const padX = Math.floor((window.innerWidth  - scaledW) / 2);
            const padY = Math.floor((window.innerHeight - scaledH) / 2);
            $('.page-wrap').css({ 'flex-direction': 'row', 'padding-left': padX + 'px', 'padding-top': padY + 'px' });
            $('#game-area').css({ zoom: scale, width: (cols + 4) * cs + 'px', margin: '0', 'flex-shrink': '0' });
            banner.syncSizes();
            return;
        }

        const isVertical = sidebarPos === 'left' || sidebarPos === 'right';

        // ── Vertical sidebar (left / right) ────────────────────────────────────
        if (isVertical) {
            let sidebarW, cols, rows, scale;

            if (gridAutofit) {
                if (typeof s.sidebar_width !== 'number') {
                    console.warn('[grid_autofit] sidebar_width must be a number; defaulting to 80');
                    sidebarW = 80;
                } else {
                    sidebarW = s.sidebar_width;
                }
                const availW = window.innerWidth - sidebarW;
                cols = Math.max(1, Math.floor(availW / cs) - 4);
                rows = Math.max(1, Math.floor(window.innerHeight / cs) - 4);
                sidebarW += availW - (cols + 4) * cs;   // absorb width remainder
                s.gridCols = cols; s.gridRows = rows;
                scale = 1;
            } else {
                const totalW = (origCols + 4) * cs, totalH = (origRows + 4) * cs;
                cols = origCols; rows = origRows;
                if (typeof s.sidebar_width === 'number') {
                    sidebarW = s.sidebar_width;
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
                '| playfield:', Math.round((cols + 4) * cs * scale) + 'x' + canvasH,
                '| sidebar:', sidebarW + 'x' + canvasH);

            $('.page-wrap').css({ 'flex-direction': 'row', 'padding-left': '0', 'padding-top': '0' });
            $('#fs-sidebar')
                .removeClass('fs-sidebar-top fs-sidebar-right fs-sidebar-bottom')
                .toggleClass('fs-sidebar-right', sidebarPos === 'right')
                .css({ display: 'flex', width: sidebarW + 'px', height: canvasH + 'px' });
            $('#game-area').css({ zoom: scale, width: (cols + 4) * cs + 'px', margin: '0', 'flex-shrink': '0' });
            banner.syncSizes();

        // ── Horizontal sidebar (top / bottom) ──────────────────────────────────
        } else {
            let sidebarH, cols, rows, scale;

            if (gridAutofit) {
                if (typeof s.sidebar_height !== 'number') {
                    console.warn('[grid_autofit] sidebar_height must be a number; defaulting to 50');
                    sidebarH = 50;
                } else {
                    sidebarH = s.sidebar_height;
                }
                const availH = window.innerHeight - sidebarH;
                cols = Math.max(1, Math.floor(window.innerWidth  / cs) - 4);
                rows = Math.max(1, Math.floor(availH / cs) - 4);
                sidebarH += availH - (rows + 4) * cs;   // absorb height remainder
                s.gridCols = cols; s.gridRows = rows;
                scale = 1;
            } else {
                const totalW = (origCols + 4) * cs, totalH = (origRows + 4) * cs;
                cols = origCols; rows = origRows;
                if (typeof s.sidebar_height === 'number') {
                    sidebarH = s.sidebar_height;
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

            const canvasW = Math.round((cols + 4) * cs * scale);
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
            $('#game-area').css({ zoom: scale, width: (cols + 4) * cs + 'px', margin: '0', 'flex-shrink': '0' });
            banner.syncSizes();
        }
    }

    // Call once after layout helpers/constants are initialized.
    updateLayout();

});
