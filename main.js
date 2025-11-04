import { GameDef, GameState, LevelState } from './gamestate.js';
import * as pix from './picxonix.js'
import { BonusItem } from './bonus.js';
$(function() {
    var elCanvas = $('#graphics');
    // Cache commonly used DOM elements
    var $playBtn = $('#play-btn');
    var $banner = $('#banner');
    var $gameStatusText = $('#game-status-text');
    var $statusProgressCurrent = $('#status-progress-current');
    pix.test_function()
    function initUI(el){
        console.log('initUI Must be called once');
        window.var_oWrap = document.createElement('div');
        window.var_oWrap.style.position = 'relative';
        el.appendChild(window.var_oWrap);
        console.log('oWrapAdded, number of child:', el.childElementCount);

    }
    initUI(elCanvas[0]);
    // var size = window.picxonix('init',elCanvas[0]);
    // if (!size) return;

    // var w = size.width, h = size.height;
    // elCanvas.css({width: w, height: h});


    // window.gd = new GameDef();
    // // Create global instance
    // window.gs = new GameState(window.gd);


    $('#status-progress-total').html(0);
    // preloadLevel();

    var keyHash = {37: 'left', 39: 'right', 38: 'up', 40: 'down', 32: 'stop'};
    $(document).keydown(function(e) {
        var key = e.which;

        // Enter key - Start/Next level
        if (key == 13) {
            if (!$playBtn.prop('disabled') && $playBtn.is(':visible')) {
                e.preventDefault();
                $playBtn.click();
            }
            return;
        }

        // Q key - Quit to beginning
        if (key == 81 || key == 113) { // Q or q
            if (window.gs.bStarted || window.gs.bPlay) {
                e.preventDefault();
                quitPressed();
            }
            return;
        }

        // ESC key - Pause/Resume
        if (key == 27) {
            if (window.gs.bStarted) {
                window.gs.bPlay = !window.gs.bPlay;
                window.gs.setPlayMode(window.gs.bPlay)
            }
            return;
        }

        if (!window.gs.bPlay || !(key in keyHash)) return;
        e.preventDefault();
        picxonix('cursorDir', keyHash[key]);
    });

    elCanvas.click(function(e) {
        if (!window.gs.bPlay) return;
    var pos0 = elCanvas.offset();
        var x = e.pageX, y = e.pageY,
            xc = x - pos0.left, yc = y - pos0.top;
        picxonix('cursorDir', [xc, yc]);
    });


    $playBtn.show().click(function(e) {
        e.preventDefault();
        newGameHomeScreen('button')
        startLevel();
    });


    function quitPressed() {
        if (window.gs.bPlay || window.gs.bStarted) {
            picxonix('end', false);
            picxonix('quit'); // Ensure full reset of game state
        }
        window.gs.bPlay = false;
        window.gs.bStarted = false;

        //iLevel = 0; // Reset to initial state (same as page load)
       // nTimeTotal = 0;
       // show play button again
        $gameStatusText.hide();
        console.log($('#play-btn').text());
        $playBtn.prop('disabled', false).show()
           .html('<span class="glyphicon glyphicon-repeat"></span> Try Again')
            .off('click').on('click', function(e) {
                e.preventDefault();
                newGameHomeScreen();
                startLevel();
            });
        preloadLevel(); // This will load the first level (index 0)
    }

    function preloadLevel() {
        if (window.gs.iLevel >= window.gs.nLevels) {
            // All levels completed - this shouldn't happen here anymore
            window.gs.iLevel = 0;
            return;
        }

        // var img = window.ls.get_image(function() {$playBtn.prop('disabled', false);},
        //         function() {
        //             console.error('Failed to load image:', 'pics/' + window.gs.iLevel);
        //             $playBtn.prop('disabled', false); // Enable button even if image fails
        //     })

        // )
        // if (img.complete) {
        //     $playBtn.prop('disabled', false);
        // } else {
        //     $playBtn.prop('disabled', true);
        // }

        // Don't overwrite window.gs.oLevel.image - keep the original filename
    }

    function startLevel() {
        if(window.ls.iLevel<1)return;
        picxonix('reset'); // Always reset before starting a new level
        console.log('Starting level startLevel fnc', window.gs.iLevel, 'with image');
        // Update button container to show game running
        $playBtn.prop('disabled', true).hide().html('In Progress')
        $gameStatusText.show();

        if (!window.gs.bStarted)
            $('.my-panel').removeClass('hidden');


        window.gs.bStarted = true;
        window.gs.bPlay = true;
        window.gs.bConquer = false;
        window.gs.bCollision = false;
        $statusProgressCurrent.html(window.gs.iLevel);

        window.loadLevel()
        $('#banner').html('Go on . . ')
        window.gs.tLevel = Date.now();
        window.gs.nTimeLevel = 0;
        }
    window.fn_update = function(dt) {
        // Accumulate fractional movement
        if (window.cursor.dir === false){
            window.var_cursorMoveRemainder = 0
        }else{
            window.var_cursorMoveRemainder += dt * (window.gs.speedCursor + window.gs.speedBonus);
        }

        window.var_enemyMoveRemainder += dt * ( Math.min(window.ls.speedEnemy - window.ls.speedEnemyReduce));
        var distCursor = Math.floor(window.var_cursorMoveRemainder);
        var distEnemy = Math.floor(window.var_enemyMoveRemainder);
        window.var_cursorMoveRemainder -= distCursor;
        window.var_enemyMoveRemainder -= distEnemy;

        // console.log('dt:', dt.toFixed(3),'eSpeed', window.ls.speedEnemy, 'distCursor:', distCursor, 'distEnemy:', distEnemy);
        if (!(distCursor >= 1 || distEnemy >= 1)) return false;
            window.cursor.update(distCursor);
            // Bonus item collision check
            if (window.stageData.bonus.active && distCursor >= 1){
                //console.log('Checking bonus collision at pos:', window.cursor.pos(),distCursor, distEnemy)
                var posCr = window.cursor.pos();
                if (window.stageData.bonus.check_capture(posCr)){
                    window.stageData.bonus.applyBonus(window.gd.cfgMain,window.gs.ctxMain);
                    window.update_status_bar();
                }

            }

            var i;
            for (i = 0; i < window.ls.nBalls; i++) window.ls.aBalls[i].update(distEnemy);
            for (i = 0; i < window.ls.nWarders; i++) window.ls.aWarders[i].update(distEnemy);
            if(!window.stageData.bonus.active)
                {
                    if(window.stageData.cum_area<50) window.stageData.bonus = BonusItem.random(5, 5, window.cellset.nW-5, window.cellset.nH-5, 'tank')
                }
            return true;
        }

    window.fn_updateTime = function() {
        var n = Math.floor((Date.now() - window.gs.tLevel) / 1000);
        if (n - window.gs.nTimeLevel < 1) return;
        window.gs.nTimeLevel = n;
        function str_pad(s) {
            return Array(3 - s.length).join('0') + s;
        }
        n = window.gs.nTimeLevel + window.gs.nTimeTotal;
        var nm = String(Math.floor(n / 60)), ns = String(n % 60);
        $('#status-time').html(str_pad(nm)+':'+str_pad(ns));
    }

    window.afterFault = function() {
        window.gs.nFaults -= 1
        $('#banner').html('Oops..');
        window.update_status_bar('update');
        if (window.gs.nFaults > 0) return;

        // Stop the game properly
        window.gs.bPlay = false;
        window.gs.bStarted = false;
        picxonix('end', false);
        picxonix('reset'); // Ensure full reset before retry

        setTimeout(function() {
            preloadLevel();

            // Update button container to show Try Again button
            $('#game-status-text').hide();
            $('#play-btn').prop('disabled', false).show()
                .html('<span class="glyphicon glyphicon-play"></span> Play')
                .off('click').on('click', function(e) {
                    e.preventDefault();
                    newGameHomeScreen()
                    startLevel();
                });

    },1000)
}

    function newGameHomeScreen(origin){
        console.log('=== NEW GAME request==='+origin);
        picxonix('newgame',0)
        //$('#banner').html('START TO PLAY');
        // picxonix('quit')
        //$('#game-status-text').hide();
        //$('#play-btn').html('<span class="glyphicon glyphicon-play"></span> Play')
        //    .off('click').on('click', function(e) {
        //        e.preventDefault();
        //        startLevel();
         //   });
        // preloadLevel();

    }


    window.fn_postConquer = function(cleared_area, cleared_thr) {
        $('#status-points').html(cleared_area.toFixed(0)+'%');
        var new_area = cleared_area- window.stageData.cum_area
        window.gs.score+=new_area
        window.stageData.cum_area = cleared_area
        window.update_status_bar('conquer');
        if (cleared_area < cleared_thr) return false;

        // Level Complete procedure
         if (window.gs.iLevel < window.gs.nLevels){
            $('#banner').html('Level Complete');

        }else{
            $('#banner').html('CONGRATULATIONS !!!');
        }
        window.flashEffect({duration: 50, opacity: 0.9})
        window.gs.endLevel(true); // This leads to window.postLevelComplete()

        return true;
    }

    window.postLevelComplete = function() {
        window.gs.bPlay = false;
        window.gs.bStarted = false;
        setTimeout(function() {
            if (window.gs.iLevel < window.gs.nLevels) {
                // Load next level
                preloadLevel();
                // Update button container to show Next Level button
                $('#game-status-text').hide();
                // # check if q is pressed during waiting time
                if($('#play-btn').text() != 'In Progress'){
                    console.log('Q pressed before next level animation. Aborting Next level button');
                    return;
                }

                $('#play-btn').prop('disabled', false).show()
                    .html('<span class="glyphicon glyphicon-play"></span> Next Level')
                    .off('click').on('click', function(e) {
                        e.preventDefault();
                        window.gs.iLevel += 1;
                        window.gs.startLevelStateCells(window.gs.iLevel);

                        startLevel();
                    });
            } else {


                // Update button container to show Play Again button
                $('#game-status-text').hide();
                $('#play-btn').prop('disabled', false).show()
                    .html('<span class="glyphicon glyphicon-repeat"></span> Play Again')
                    .off('click').on('click', function(e) {
                        e.preventDefault();
                        newGameHomeScreen('button')
                        startLevel();
                    });
            }
        }, 1500);
    }
    function enableOptions(bOn) {
        $('#answeropts > button').prop('disabled', !bOn);
    }

});



//TODO
// When game paused duting freez, the freez counter keeps ticking and ends in 3 sec even if paused.
