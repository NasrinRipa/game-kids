/**
 * banner.js - queued banner animation controller
 */

const _iconCache = {};

function _loadIcon(type) {
    if (!_iconCache[type]) {
        const img = new Image();
        img.src = `assets/${type}.png`;
        _iconCache[type] = img;
    }
    return _iconCache[type];
}

export class BannerController {
    constructor(mainCanvasEl, fsCanvasEl, sidebarEl, shouldAutoGoOn = null) {
        this._mainCanvas = mainCanvasEl;
        this._fsCanvas = fsCanvasEl;
        this._mainCtx = mainCanvasEl.getContext('2d');
        this._fsCtx = fsCanvasEl.getContext('2d');
        this._sidebarEl = sidebarEl;

        this._queue = [];
        this._running = false;
        this._rafId = null;
        this._speedMul = 1;
        this._activeTag = '';
        this._clockForceFinishMs = 0;
        this._idleGoOnTimer = null;
        this._idleGoOnDelayMs = 2000;
        this._shouldAutoGoOn = typeof shouldAutoGoOn === 'function'
            ? shouldAutoGoOn
            : () => true;
        this._lastStaticDraw = null;
        this._lastSidebarText = '';

        this.syncSizes();
    }

    syncSizes() {
        let resized = false;
        const sync = (canvas) => {
            const w = canvas.clientWidth || canvas.width;
            const h = canvas.clientHeight || canvas.height;
            if (canvas.width !== w) {
                canvas.width = w;
                resized = true;
            }
            if (canvas.height !== h) {
                canvas.height = h;
                resized = true;
            }
        };
        sync(this._mainCanvas);
        sync(this._fsCanvas);

        if (resized && !this._running && this._queue.length === 0) {
            this._restoreStaticFrame();
        }
    }

    _rememberStaticFrame(sidebarText, drawFn) {
        this._lastSidebarText = sidebarText;
        this._lastStaticDraw = drawFn;
    }

    _restoreStaticFrame() {
        if (!this._lastStaticDraw) return;
        this._sidebar(this._lastSidebarText);
        this._lastStaticDraw();
    }

    _cancelIdleGoOn() {
        if (this._idleGoOnTimer !== null) {
            clearTimeout(this._idleGoOnTimer);
            this._idleGoOnTimer = null;
        }
    }

    _scheduleIdleFadeToGoOn() {
        this._cancelIdleGoOn();
        this._idleGoOnTimer = setTimeout(() => {
            this._idleGoOnTimer = null;
            if (this._running || this._queue.length > 0) return;
            if (!this._shouldAutoGoOn()) return;
            this._enqueue({
                tag: 'auto-go-on',
                run: (done) => this._fadeCurrentToGoOn(done),
            });
        }, this._idleGoOnDelayMs);
    }

    _captureSnapshot(canvas) {
        if (!canvas || !canvas.width || !canvas.height) return null;
        const snap = document.createElement('canvas');
        snap.width = canvas.width;
        snap.height = canvas.height;
        const ctx = snap.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(canvas, 0, 0);
        return snap;
    }

    _fadeCurrentToGoOn(done) {
        const mainSnap = this._captureSnapshot(this._mainCanvas);
        const fsSnap = this._captureSnapshot(this._fsCanvas);

        this._animate(360, (p) => {
            const drawFaded = (ctx, canvas, snap) => {
                ctx.fillStyle = '#001122';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                if (!snap) return;
                ctx.save();
                ctx.globalAlpha = 1 - p;
                ctx.drawImage(snap, 0, 0, canvas.width, canvas.height);
                ctx.restore();
            };

            drawFaded(this._mainCtx, this._mainCanvas, mainSnap);
            drawFaded(this._fsCtx, this._fsCanvas, fsSnap);
        }, () => {
            this._sidebar('GO ON');
            const draw = () => this._drawText('GO ON', { bg: '#10233d', color: '#9fe3ff' });
            draw();
            this._rememberStaticFrame('GO ON', draw);
            done();
        });
    }

    _sidebar(text) {
        if (this._sidebarEl) this._sidebarEl.textContent = text;
    }

    _drawAll(drawFn) {
        drawFn(this._mainCtx, this._mainCanvas.width, this._mainCanvas.height);
        drawFn(this._fsCtx, this._fsCanvas.width, this._fsCanvas.height);
    }

    _fill(color) {
        this._drawAll((ctx, w, h) => {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, w, h);
        });
    }

    _drawText(text, {
        bg = '#b0d4e8',
        color = '#333',
        subtitle = '',
        subtitleColor = '#dddddd',
    } = {}) {
        this._fill(bg);
        this._drawAll((ctx, w, h) => {
            ctx.save();
            ctx.font = `bold ${Math.max(14, Math.min(26, h * 0.42))}px monospace`;
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, w / 2, subtitle ? h * 0.42 : h / 2);
            if (subtitle) {
                ctx.font = `${Math.max(9, Math.min(14, h * 0.18))}px monospace`;
                ctx.fillStyle = subtitleColor;
                ctx.fillText(subtitle, w / 2, h * 0.78);
            }
            ctx.restore();
        });
    }

    _raf(fn) {
        this._rafId = requestAnimationFrame(fn);
    }

    _endActiveRaf() {
        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    _enqueue(task) {
        this._cancelIdleGoOn();
        if (this._running) {
            // Requirement: if a new animation arrives, speed up current animation.
            this._speedMul = Math.max(this._speedMul, 2);
        }
        this._queue.push(task);
        this._pumpQueue();
    }

    _pumpQueue() {
        if (this._running) return;
        const next = this._queue.shift();
        if (!next) return;

        this._running = true;
        this._speedMul = 1;
        this._activeTag = next.tag || '';
        const shouldAutoFade = !!next.autoFadeGoOn;

        const done = () => {
            this._running = false;
            this._speedMul = 1;
            this._activeTag = '';
            this._clockForceFinishMs = 0;
            if (shouldAutoFade && this._queue.length === 0) {
                this._scheduleIdleFadeToGoOn();
            }
            this._pumpQueue();
        };

        next.run(done);
    }

    _animate(durationMs, render, done) {
        let elapsed = 0;
        let last = 0;

        const step = (now) => {
            if (!last) last = now;
            const dt = now - last;
            last = now;
            elapsed += dt * this._speedMul;
            const p = durationMs <= 0 ? 1 : Math.min(elapsed / durationMs, 1);
            render(p);
            if (p < 1) {
                this._raf(step);
            } else {
                this._rafId = null;
                done();
            }
        };

        this._raf(step);
    }

    _runSequential(steps, done) {
        let idx = 0;
        const next = () => {
            if (idx >= steps.length) {
                done();
                return;
            }
            const fn = steps[idx++];
            fn(next);
        };
        next();
    }

    _flash(color, ms, done) {
        this._animate(ms, (p) => {
            const a = p < 0.5 ? p * 2 : (1 - p) * 2;
            this._fill('#b0d4e8');
            this._drawAll((ctx, w, h) => {
                ctx.save();
                ctx.globalAlpha = a;
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, w, h);
                ctx.restore();
            });
        }, done);
    }

    _doubleFlashOver(renderer, done, flashMs = 90, gapMs = 200) {
        let count = 0;
        const runOne = () => {
            this._animate(flashMs, (p) => {
                const a = p < 0.5 ? p * 2 : (1 - p) * 2;
                renderer();
                this._drawAll((ctx, w, h) => {
                    ctx.save();
                    ctx.globalAlpha = a;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, w, h);
                    ctx.restore();
                });
            }, () => {
                count++;
                if (count < 2) {
                    setTimeout(runOne, gapMs);
                }
                else done();
            });
        };
        runOne();
    }

    _renderBonusTimerFrame(type, angle) {
        const img = _loadIcon(type);
        this._drawAll((ctx, w, h) => {
            const cx = w / 2;
            const cy = h / 2;
            const radius = Math.sqrt(w * w + h * h);
            const iconSz = Math.min(w, h) * 0.5;

            ctx.fillStyle = '#cc0000';
            ctx.fillRect(0, 0, w, h);

            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + angle, false);
            ctx.closePath();
            ctx.fill();

            if (img.complete && img.naturalWidth) {
                ctx.drawImage(img, cx - iconSz / 2, cy - iconSz / 2, iconSz, iconSz);
            } else {
                ctx.save();
                ctx.font = `${Math.max(10, Math.min(16, h * 0.22))}px monospace`;
                ctx.fillStyle = '#ffdd00';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(type.toUpperCase(), cx, cy);
                ctx.restore();
            }
        });
    }

    _coolAnimation(done) {
        const letters = ['C', 'O', 'O', 'L'];
        const palette = ['#ff4444', '#ffff44', '#44ff88', '#44ccff'];
        const letMs = 180;
        const holdMs = 420;
        const totalMs = letters.length * letMs + holdMs;

        this._animate(totalMs, (p) => {
            const elapsed = p * totalMs;
            const visible = Math.min(Math.floor(elapsed / letMs), letters.length);
            this._fill('#001133');
            this._drawAll((ctx, w, h) => {
                const spacing = Math.min(36, (w - 20) / letters.length);
                const startX = w / 2 - (letters.length - 1) * spacing / 2;
                for (let i = 0; i < visible; i++) {
                    const local = Math.max(0, elapsed - i * letMs);
                    const bounce = Math.sin(Math.min(local / letMs, 1) * Math.PI) * (h * 0.24);
                    ctx.save();
                    ctx.font = `bold ${Math.min(26, h * 0.52)}px monospace`;
                    ctx.fillStyle = palette[i % palette.length];
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(letters[i], startX + i * spacing, h / 2 - bounce);
                    ctx.restore();
                }
            });
        }, done);
    }

    _conquerAnimation(points, showHalfway, done) {
        const dur = 1300;
        this._animate(dur, (p) => {
            const wave = Math.sin(p * Math.PI * 6) * 0.5 + 0.5;
            this._drawAll((ctx, w, h) => {
                ctx.fillStyle = '#021421';
                ctx.fillRect(0, 0, w, h);

                const bandX = (p * 1.2 - 0.2) * w;
                const grad = ctx.createLinearGradient(bandX - 50, 0, bandX + 50, 0);
                grad.addColorStop(0, 'rgba(0,255,255,0)');
                grad.addColorStop(0.5, `rgba(0,255,255,${0.18 + 0.22 * wave})`);
                grad.addColorStop(1, 'rgba(0,255,255,0)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, w, h);

                ctx.save();
                ctx.font = `bold ${Math.max(11, Math.min(17, h * 0.22))}px monospace`;
                ctx.fillStyle = '#67d5ff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('CONQUER', w / 2, h * 0.24);
                ctx.restore();

                const scale = p < 0.22 ? 0.7 + p / 0.22 * 0.45 : 1.15 - Math.min((p - 0.22) / 0.28, 1) * 0.15;
                ctx.save();
                ctx.translate(w / 2, h * 0.56);
                ctx.scale(scale, scale);
                ctx.font = `bold ${Math.max(16, Math.min(30, h * 0.46))}px monospace`;
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${points} POINTS!`, 0, 0);
                ctx.restore();

                if (showHalfway) {
                    const a = p < 0.35 ? 0 : Math.min((p - 0.35) / 0.25, 1);
                    ctx.save();
                    ctx.globalAlpha = a;
                    ctx.font = `bold ${Math.max(10, Math.min(16, h * 0.22))}px monospace`;
                    ctx.fillStyle = '#ffd166';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('HALFWAY', w / 2, h * 0.82);
                    ctx.restore();
                }
            });
        }, done);
    }

    _bonusIcon(type, done) {
        const img = _loadIcon(type);
        const totalMs = 1500;
        const flashWindows = [
            [0.18, 0.34],
            [0.38, 0.54],
        ];
        const renderBase = (alpha = 1) => {
            this._fill('#001133');
            this._drawAll((ctx, w, h) => {
                const sz = Math.min(w, h) * 0.54;
                ctx.save();
                ctx.globalAlpha = alpha;
                if (img.complete && img.naturalWidth) {
                    ctx.drawImage(img, (w - sz) / 2, h * 0.12, sz, sz);
                } else {
                    ctx.font = `bold ${Math.max(11, Math.min(18, h * 0.26))}px monospace`;
                    ctx.fillStyle = '#ffdd00';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(type.toUpperCase(), w / 2, h * 0.42);
                }
                ctx.font = `${Math.max(9, Math.min(13, h * 0.18))}px monospace`;
                ctx.fillStyle = '#ffe48c';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(type.toUpperCase(), w / 2, h * 0.84);
                ctx.restore();
            });
        };

        this._animate(totalMs, (p) => {
            const fadeAlpha = p < 0.68 ? 1 : 1 - (p - 0.68) / 0.32;
            renderBase(Math.max(0, fadeAlpha));

            let flashAlpha = 0;
            for (const [start, end] of flashWindows) {
                if (p >= start && p <= end) {
                    const local = (p - start) / (end - start);
                    flashAlpha = Math.max(flashAlpha, local < 0.5 ? local * 2 : (1 - local) * 2);
                }
            }

            if (flashAlpha > 0) {
                this._drawAll((ctx, w, h) => {
                    ctx.save();
                    ctx.globalAlpha = flashAlpha;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, w, h);
                    ctx.restore();
                });
            }
        }, done);
    }

    _lifeBonusIcon(done) {
        const img = _loadIcon('life');
        const totalMs = 1300;

        this._animate(totalMs, (p) => {
            const zoom = p < 0.55
                ? 0.35 + (p / 0.55) * 0.95
                : 1.3 - Math.min((p - 0.55) / 0.45, 1) * 0.25;
            const plusAlpha = Math.min(p / 0.22, 1);
            const iconAlpha = Math.min((p - 0.1) / 0.22, 1);

            this._drawAll((ctx, w, h) => {
                ctx.fillStyle = '#001133';
                ctx.fillRect(0, 0, w, h);

                const centerY = h * 0.5;
                const plusX = w * 0.34;
                const iconX = w * 0.62;
                const iconSz = Math.min(w, h) * 0.42;

                ctx.save();
                ctx.globalAlpha = Math.max(0, Math.min(plusAlpha, 1));
                ctx.font = `bold ${Math.max(13, Math.min(24, h * 0.38))}px monospace`;
                ctx.fillStyle = '#9cff9c';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('+', plusX, centerY);
                ctx.restore();

                ctx.save();
                ctx.translate(iconX, centerY);
                ctx.scale(zoom, zoom);
                ctx.globalAlpha = Math.max(0, Math.min(iconAlpha, 1));
                if (img.complete && img.naturalWidth) {
                    ctx.drawImage(img, -iconSz / 2, -iconSz / 2, iconSz, iconSz);
                } else {
                    ctx.font = `bold ${Math.max(10, Math.min(16, h * 0.24))}px monospace`;
                    ctx.fillStyle = '#ff8899';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('LIFE', 0, 0);
                }
                ctx.restore();
            });
        }, done);
    }

    _bonusTimer(type, durationSec, isEffectActive, getRemainingMs, done) {
        const total = Math.max(100, durationSec * 1000);
        let remaining = total;
        let last = 0;
        let lastAngle = 0;

        const step = (now) => {
            if (!last) last = now;
            const dt = now - last;
            last = now;

            if (typeof isEffectActive === 'function' && !isEffectActive()) {
                this._rafId = null;
                this._renderBonusTimerFrame(type, lastAngle);
                this._doubleFlashOver(() => this._renderBonusTimerFrame(type, lastAngle), done);
                return;
            }

            if (typeof getRemainingMs === 'function') {
                const rem = Math.max(0, getRemainingMs());
                remaining = Math.min(total, rem);
            } else {
                remaining -= dt * this._speedMul;
            }

            if (this._clockForceFinishMs > 0 && remaining > this._clockForceFinishMs) {
                remaining = this._clockForceFinishMs;
            }

            if (remaining <= 0) {
                this._rafId = null;
                if (this._clockForceFinishMs > 0) {
                    this._renderBonusTimerFrame(type, Math.PI * 2);
                    this._doubleFlashOver(() => this._renderBonusTimerFrame(type, Math.PI * 2), done);
                } else {
                    this._flash('white', 260, done);
                }
                return;
            }

            const p = 1 - remaining / total;
            lastAngle = p * Math.PI * 2;
            this._renderBonusTimerFrame(type, lastAngle);

            this._raf(step);
        };

        this._raf(step);
    }

    _expediteCurrentBonusTimer(ms) {
        if (this._activeTag !== 'bonus-timer') return;
        this._clockForceFinishMs = ms;
        this._speedMul = Math.max(this._speedMul, 2);
    }

    // Public API

    showText(text, { color = '#333', bg = '#b0d4e8', subtitle = '' } = {}) {
        this.syncSizes();
        this._enqueue({
            tag: 'text',
            run: (done) => {
                this._sidebar(text);
                const draw = () => this._drawText(text, { bg, color, subtitle });
                draw();
                this._rememberStaticFrame(text, draw);
                done();
            },
        });
    }

    showReadyToStart() {
        this.syncSizes();
        this._enqueue({
            tag: 'ready-start',
            run: (done) => {
                this._sidebar('READY');
                const draw = () => this._drawText('READY', {
                    bg: '#001a33',
                    color: '#00ff99',
                    subtitle: 'ENTER to start',
                    subtitleColor: '#d4f1ff',
                });
                draw();
                this._rememberStaticFrame('READY', draw);
                done();
            },
        });
    }

    showReadyToLevel() {
        this.syncSizes();
        this._enqueue({
            tag: 'ready-level',
            run: (done) => {
                this._sidebar('READY');
                const draw = () => this._drawText('READY', {
                    bg: '#001a33',
                    color: '#00ff99',
                    subtitle: 'ENTER -> LEVEL',
                    subtitleColor: '#d4f1ff',
                });
                draw();
                this._rememberStaticFrame('READY', draw);
                done();
            },
        });
    }

    showGoOn() {
        this.syncSizes();
        this._enqueue({
            tag: 'go-on',
            run: (done) => {
                this._sidebar('GO ON');
                const draw = () => this._drawText('GO ON', { bg: '#10233d', color: '#9fe3ff' });
                draw();
                this._rememberStaticFrame('GO ON', draw);
                done();
            },
        });
    }

    showPaused() {
        this.syncSizes();
        this._enqueue({
            tag: 'paused',
            run: (done) => {
                this._sidebar('PAUSED');
                const draw = () => this._drawText('PAUSED', {
                    bg: '#101010',
                    color: '#ffd166',
                    subtitle: 'Press ESC to resume',
                    subtitleColor: '#f3f3f3',
                });
                draw();
                this._rememberStaticFrame('PAUSED', draw);
                done();
            },
        });
    }

    showOops() {
        this.syncSizes();
        this._enqueue({
            tag: 'oops',
            autoFadeGoOn: true,
            run: (done) => {
                this._sidebar('OOPS');
                this._animate(900, (p) => {
                    const shake = p < 0.55 ? Math.sin(p * Math.PI * 15) * 5 * (1 - p / 0.55) : 0;
                    const flashAlpha = p < 0.22 ? 1 - p / 0.22 : 0;
                    this._drawAll((ctx, w, h) => {
                        ctx.fillStyle = '#330000';
                        ctx.fillRect(0, 0, w, h);
                        if (flashAlpha > 0) {
                            ctx.save();
                            ctx.globalAlpha = flashAlpha;
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(0, 0, w, h);
                            ctx.restore();
                        }
                        ctx.save();
                        ctx.translate(w / 2 + shake, h / 2);
                        ctx.font = `bold ${Math.max(15, Math.min(24, h * 0.34))}px monospace`;
                        ctx.fillStyle = '#ff5555';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('OOPS!', 0, 0);
                        ctx.restore();
                    });
                }, done);
            },
        });
    }

    showGameOver() {
        this.syncSizes();
        this._enqueue({
            tag: 'game-over',
            autoFadeGoOn: true,
            run: (done) => {
                this._sidebar('GAME OVER');
                this._animate(2600, (p) => {
                    const flicker = 0.60 + 0.40 * Math.abs(Math.sin(p * Math.PI * 24 * (1 - p * 0.7)));
                    this._drawAll((ctx, w, h) => {
                        ctx.fillStyle = `rgb(${Math.floor(190 * flicker)},0,0)`;
                        ctx.fillRect(0, 0, w, h);
                        ctx.save();
                        ctx.globalAlpha = Math.min(p * 4, 1);
                        ctx.font = `bold ${Math.max(14, Math.min(26, h * 0.38))}px monospace`;
                        ctx.fillStyle = '#ffffff';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('GAME OVER', w / 2, h * 0.42);
                        ctx.font = `${Math.max(9, Math.min(14, h * 0.18))}px monospace`;
                        ctx.fillStyle = '#ffe0e0';
                        ctx.fillText('ENTER to start', w / 2, h * 0.76);
                        ctx.restore();
                    });
                }, done);
            },
        });
    }

    showLevelComplete() {
        this.syncSizes();
        this._enqueue({
            tag: 'level-complete',
            run: (done) => {
                this._sidebar('LEVEL COMPLETE');
                const draw = () => this._drawText('LEVEL COMPLETE', { bg: '#12320f', color: '#9dff6e' });
                draw();
                this._rememberStaticFrame('LEVEL COMPLETE', draw);
                done();
            },
        });
    }

    showCongrats(isLastLevel) {
        if (!isLastLevel) {
            this.showLevelComplete();
            return;
        }
        this.syncSizes();
        this._enqueue({
            tag: 'congrats',
            autoFadeGoOn: true,
            run: (done) => {
                this._sidebar('CONGRATULATIONS');
                this._animate(3200, (p) => {
                    const hue = (p * 720) % 360;
                    this._drawAll((ctx, w, h) => {
                        ctx.fillStyle = `hsl(${hue},72%,16%)`;
                        ctx.fillRect(0, 0, w, h);
                        ctx.save();
                        ctx.shadowColor = `hsl(${hue},100%,60%)`;
                        ctx.shadowBlur = 10;
                        ctx.font = `bold ${Math.min(14, h * 0.27)}px monospace`;
                        ctx.fillStyle = '#ffffff';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('CONGRATULATIONS!', w / 2, h / 2);
                        ctx.restore();
                    });
                }, done);
            },
        });
    }

    showConquer(deltaScore, showHalfway = false, opts = {}) {
        const points = Math.max(0, Math.round(deltaScore));
        if (opts.forceCloseBonusTimer) this._expediteCurrentBonusTimer(300);
        this.syncSizes();

        this._enqueue({
            tag: 'conquer',
            autoFadeGoOn: true,
            run: (done) => {
                this._sidebar(showHalfway ? 'HALFWAY' : 'CONQUER');
                const steps = [];
                if (points > 10) {
                    steps.push((next) => this._coolAnimation(next));
                }
                steps.push((next) => this._conquerAnimation(points, showHalfway, next));
                this._runSequential(steps, done);
            },
        });
    }

    showBonusCaptured(type, hasTimer, durationSec, isEffectActive = null, getRemainingMs = null) {
        this.syncSizes();
        this._enqueue({
            tag: hasTimer ? 'bonus-timer' : 'bonus-icon',
            autoFadeGoOn: true,
            run: (done) => {
                this._sidebar('Bonus: ' + type);
                if (hasTimer) {
                    this._runSequential([
                        (next) => this._flash('white', 180, next),
                        (next) => this._bonusTimer(type, durationSec, isEffectActive, getRemainingMs, next),
                    ], done);
                } else if (type === 'life') {
                    this._lifeBonusIcon(done);
                } else {
                    this._bonusIcon(type, done);
                }
            },
        });
    }
}
