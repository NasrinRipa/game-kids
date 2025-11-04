export class BonusItem {
    constructor(x = 0, y = 0, type = 'speed', bonusValue = 10, active=true) {
        this.x = x;
        this.y = y;
        this.type = type; // 'speed', 'slow', 'sneaky'
        this.bonusValue = bonusValue;
        this.active = active;
        this.bonusSize = 2;
        this.image = 'none';
    }

    static alwaysBonus= true;
    static random(minX = 0, minY = 0, maxX = 600, maxY = 400, bonus = 'random') {
        const types = ['speed', 'slow', 'sneaky', 'killward', 'life', 'freez', 'tank'];
        const x = Math.floor(Math.random() * (maxX - minX)) + minX;
        const y = Math.floor(Math.random() * (maxY - minY)) + minY;
        const index = Math.floor(Math.random() * types.length);
        const type = bonus === 'random' ? types[index] : bonus;
        // Ensure bonus values array matches types length
        const bonusValues = [5, 5, 7, 1, 3, 2, 5];
        const bonusValue = bonus === 'random' ? bonusValues[index] : 5;
        return new BonusItem(x, y, type, bonusValue, true);
    }

    color(){
        if (this.type === 'speed') return '#FF0000'; // red for speed
        if (this.type === 'slow') return '#00FF00'; // green for slow
        if (this.type === 'sneaky') return '#e95aeeff'; // blue for sneaky
        if (this.type === 'killward') return '#FFFF00'; // yellow for killward
        if (this.type === 'life') return '#00FFFF'; // cyan for extra life
        if (this.type === 'freez') return '#ccaaaa'; // blue for freez
         if (this.type === 'tank') return '#1417a5ff'; // blue for freez
        return '#FFFFFF'; // white for error
    }

    render(cfgMain,ctxMain){
        const sizeCell = cfgMain.sizeCell;

        const w = sizeCell * this.bonusSize;
        const h = sizeCell * this.bonusSize;
        const left = (this.x + 2) * sizeCell;
        const top  = (this.y + 2) * sizeCell;
        if (this.active) {
            if(this.type === 'life'){
                const img = new Image();
                img.onload = () => {ctxMain.drawImage(img, left, top, w, h)};
                img.onerror = (err) => {console.error("Error loading image:", err); };
                img.onabort = () => { console.log("Image load aborted");};
                const base64String = "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAABO1BMVEX+Bgb/Bwf/Bwf/Bwf+Bgb/Bwf/BwdHcEz+Bgb/Bwf/Bwf/Bwf/Bwf+Bgb/Bwf+Bgb+Bgb/Bwf/Bwf+Bgb+Bgb/Bwf/Bwf/Bwf/Bwf/Bwf/Bwf+Bgb/Bwf+Bgb/Bwf+Bgb/Bwf/Bwf+Bgb+Bgb/Bwf+Bgb/Bwf+Bgb/Bwf/Bwf+Bgb+Bgb/Bwf/Bwf/Bwf/Bwf/Bwf/Bwf+Bgb/Bwf/Bwf/Bwf/Bwf/Bwf+Bgb+Bgb+Bgb+Bgb/Bwf+Bgb/Bwf+Bgb/Bwf+Bgb+Bgb/Bwf+Bgb/Bwf+Bgb+Bgb+Bgb/Bwf+Bgb+Bgb+Bgb+Bgb/Bwf/Bwf+Bgb/Bwf+Bgb+Bgb/Bwf/Bwf+Bgb+Bgb/Bwf/Bwf/Bwf/Bwf+Bgb/Bwf+Bgb/Bwf+Bgb/Bwf/Bwf/Bwf/Bwf+Bgb+Bgb+Bgb/Bwc27JxxAAAAaHRSTlP+l/4Y/QLyAAEDAfr5Pz/7QU+v5oT7hCdLWvQlofdnCfy+13+UzHWORusCjSHqaQcR33eCcl3EBcOP8DXIS/ERY6/l/TI8RO7Pz1Y8HUYyVtYdF0XWFwsvRO4LL4uLrgqtMwQtCQQtM35aNUwAAAHCSURBVEjHtZZnV8IwFIZvd8pGQNyAooKi4gD3ANx77z3z/3+BbaG0tKVNjsfb9Mttnrz3nCb3DUiUAX8AUg/bwV7BOkHoDd7epOzAVCkTwEqIHVHZ+CpHO0Q1G8iUplqB3CBg5QH13Yvo8yO7WlIbgzkTgIbSYAA4HPdp2c4wGACkh5AOCFlsiT6lLLnPms0KDWCksYiuAMCOStJoM9kcI3Vg2W8DML9/wtuBwLIKyCvYISYmnLIrggKsNlcwKYA5aRqrCvBMA7xK8LKGKWLtEz6ARgG+IUQHBCGEqSIEb3QKP8DVaARqHLxXaRSqXyBVaICK8uM2aEraUID1JXKFpXV1ty6SA4va9uZE0oJErn6A5kgV5honbn6BDFiY15tAIU9SUL5gtJkjv7eC/8LclyZ5L4CfbO18s6x7PeyspVWicXeFcWRtxmOMG8CM2bu3zLQviJGd2j16aqPAPiJnQ/HFnYFO1M6B0AxvB/gZn4tlDSSs5ScG3D2uu79Vob/byxS7eszr93R5u+jBnaGws0Viu8cxHYhtkvl0crpez3SS1NgPL1WF0zPym8DVMODhc5qrQ7FcLtLdNa7v/+FyQha/rbtSRDYVt4EAAAAASUVORK5CYII=";

                img.src = "data:image/png;base64," + base64String;

            }else if(this.type ==='freez'){
                if (!this.image || !(this.image instanceof Image)) {
                    const img = new Image();
                    const base64freez = "iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAv3pUWHRSYXcgcHJvZmlsZSB0eXBlIGV4aWYAAHjabVDBEQMhCPxTRUpAQA/L8ZLLTDpI+UHBmzPJzrggqysCx/v1hFsHJQHJm5ZaChqkSqVmiaKjDU4ogwemZPulDqdAVmKLHBdKnJ/1dBp4aJblq9E9hH0VqoS/fhmRB+4d9fwRRjWMmFxIYdD8W1iqbtcv7AeuUF/QSXRt+2e/2fQe2d5hooMTozFz8Qa4rwzcumBMrHYQRz6ZwswG8m9OE/AB6FFZDJNHR3AAAAGEaUNDUElDQyBwcm9maWxlAAB4nH2RPUjDQBzFX1OlUioOdhB1yFCd7FJFHaWKRbBQ2gqtOphc+gVNGpIUF0fBteDgx2LVwcVZVwdXQRD8AHEXnBRdpMT/JYUWMR4c9+PdvcfdO0BoVplq9swBqmYZ6URczOVXxcArghhBCDOISczUk5nFLDzH1z18fL2L8izvc3+OfqVgMsAnEs8x3bCIN4inNy2d8z5xmJUlhficeMKgCxI/cl12+Y1zyWGBZ4aNbHqeOEwslrpY7mJWNlTiKeKIomqUL+RcVjhvcVardda+J39hqKCtZLhOcxQJLCGJFETIqKOCKixEadVIMZGm/biHf9jxp8glk6sCRo4F1KBCcvzgf/C7W7M4GXOTQnGg98W2P8aAwC7Qatj297Ftt04A/zNwpXX8tSYw+0l6o6NFjoCBbeDiuqPJe8DlDjD0pEuG5Eh+mkKxCLyf0TflgcFbILjm9tbex+kDkKWulm+Ag0NgvETZ6x7v7uvu7d8z7f5+AEEUcvku0siBAAANdmlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNC40LjAtRXhpdjIiPgogPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iCiAgICB4bWxuczpzdEV2dD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIgogICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICAgeG1sbnM6R0lNUD0iaHR0cDovL3d3dy5naW1wLm9yZy94bXAvIgogICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iCiAgICB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iCiAgIHhtcE1NOkRvY3VtZW50SUQ9ImdpbXA6ZG9jaWQ6Z2ltcDoyMGExMDc3OS1mNTg5LTQzYjMtYjhjMC1kYjM0OGMzYjE3ZTkiCiAgIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6Y2UzNWYxOTItOTk2MS00ZmRiLThlZmYtNDEyNTM5NjdjM2YyIgogICB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6MGE4YmU1YjctMGYzNi00ZTBjLWFjZTUtMjM0ZjMzNzZhYzI0IgogICBkYzpGb3JtYXQ9ImltYWdlL3BuZyIKICAgR0lNUDpBUEk9IjIuMCIKICAgR0lNUDpQbGF0Zm9ybT0iV2luZG93cyIKICAgR0lNUDpUaW1lU3RhbXA9IjE3NjE1NzAwMDgxMzQ1NjMiCiAgIEdJTVA6VmVyc2lvbj0iMi4xMC4zNiIKICAgdGlmZjpPcmllbnRhdGlvbj0iMSIKICAgeG1wOkNyZWF0b3JUb29sPSJHSU1QIDIuMTAiCiAgIHhtcDpNZXRhZGF0YURhdGU9IjIwMjU6MTA6MjhUMDA6MDA6MDIrMTE6MDAiCiAgIHhtcDpNb2RpZnlEYXRlPSIyMDI1OjEwOjI4VDAwOjAwOjAyKzExOjAwIj4KICAgPHhtcE1NOkhpc3Rvcnk+CiAgICA8cmRmOlNlcT4KICAgICA8cmRmOmxpCiAgICAgIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiCiAgICAgIHN0RXZ0OmNoYW5nZWQ9Ii8iCiAgICAgIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6MjBjMzJhNTUtZjVjMy00OTJiLWIwODItN2VlZGIwNTc1YmM0IgogICAgICBzdEV2dDpzb2Z0d2FyZUFnZW50PSJHaW1wIDIuMTAgKFdpbmRvd3MpIgogICAgICBzdEV2dDp3aGVuPSIyMDI1LTEwLTI4VDAwOjAwOjA4Ii8+CiAgICA8L3JkZjpTZXE+CiAgIDwveG1wTU06SGlzdG9yeT4KICA8L3JkZjpEZXNjcmlwdGlvbj4KIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAKPD94cGFja2V0IGVuZD0idyI/PooAgE8AAAAGYktHRAAKAAoACl6xzxYAAAAJcEhZcwAACxMAAAsTAQCanBgAAAAHdElNRQfpChsNAAg2NDO0AAAgAElEQVR42u19d5xdZZn/9/ucc6ekUJIpCaEF0RUEERAUgoRkMjNJgNBWXWXVZVfBVUBIJo0FsSzJJJkkwOKia0F3RddVkE6mJIQqigu/VcFCLylTAhGSTLn3vN/fH7edc++5kxkYIIS8+WSSTO6c8j7P+5Tv04A96129+G598QtvetLKKkYdQt/3Bra9+uy/nfPegXfjPti78aWb2jrPLR+z9/PwE38W7fGyMXu/NK+t+0t7JMC7gvjd5zrpR87JCnZCPvnFlsaa7+5hgN10XXTz00yMGvN/gXBE9uWV+wPwiOdS/X3vufaMg7RHBeyGS/QI4D25fxccAAE1lki8q/bk3cUAAqU00ZmjeV4aCiCEd9Xy300v6yQBAjPkZ47uSjODlPnMHgmwu8qAkOnDDAcU0Ns57mGA3fVlaSHJL0BkgT3Md5th/I5WAfPbOg8XbQGEDwtKGdnh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";
                    img.src  = "data:image/png;base64," + base64freez
                    this.image = img;
                }
                const img = this.image;
                if (img.complete) ctxMain.drawImage(img, left, top, w, h);
                else img.onload = ()=> ctxMain.drawImage(img, left, top, w, h);
            }else{
                ctxMain.fillStyle = this.color();
                ctxMain.fillRect(left, top,w,h );
            }

        }
    }
    check_capture(pos){
        if (!this.active) return false;
        var x_ok = pos[0] >= this.x && pos[0] < this.x + this.bonusSize;
        var y_ok = pos[1] >= this.y && pos[1] < this.y + this.bonusSize;
        let log_text = pos + ' x_ok:' + x_ok + ' y_ok:' + y_ok + ' [' + this.x + ',' + this.y + '] ' + this.bonusSize;

        if (window.log_text !== log_text) {
            // console.log(log_text);
            window.log_text = log_text;
        }


        return x_ok && y_ok;
    }

    applyBonus(cfgMain,ctxMain) {
        this.active = false;
        // hide bonus by filling with default color
        ctxMain.fillStyle = cfgMain.colorFill;
        ctxMain.fillRect((this.x + 2) * cfgMain.sizeCell, (this.y + 2) * cfgMain.sizeCell,
            this.bonusSize * cfgMain.sizeCell, this.bonusSize * cfgMain.sizeCell);
        console.log('------ bonus captured----------', this.type, this.bonusValue)
        var bonus_text = 'none'
        // Guard access to global state objects
        const gs = (typeof window !== 'undefined' && window.gs) ? window.gs : null;
        const ls = (typeof window !== 'undefined' && window.ls) ? window.ls : null;

        if (this.type === 'speed') {
            if (gs) gs.speedBonus += this.bonusValue;
            bonus_text = 'Bonus - Speed Up';
        } else if (this.type === 'slow') {
            // speed 25% less
            if (ls) ls.speedEnemyReduce += (ls.speedEnemy - ls.speedEnemyReduce) * 0.3;
            bonus_text = 'Bonus - Enemy Slow';
        } else if (this.type === 'sneaky') {
            if (ls) ls.ignoreCollisionBonus = true;
            bonus_text = 'Bonus - Sneaky';
              // # after 3 second return to same
            setTimeout(() => {
                ls.ignoreCollisionBonus = false;
            }, this.bonusValue*1000);
        } else if (this.type === 'killward') {
            if (ls) {
                ls.nWarders = Math.max(0, (ls.nWarders || 0) - 1);
                // remove last item from ls.aWarders if present
                if (Array.isArray(ls.aWarders) && ls.aWarders.length > 0) {
                    const last = ls.aWarders.pop();
                    if (last && typeof last.clear_render === 'function') last.clear_render();
                }
            }
            bonus_text = 'Bonus - Kill Warder';
        } else if (this.type === 'life') {
            if (gs) gs.nFaults = (gs.nFaults || 0) + 1;
            bonus_text = 'Bonus - Extra Life';
        }else if (this.type === 'freez'){
            bonus_text = 'Bonus - Frozen';
            if(ls.speedEnemyReduce != ls.speedEnemy){
                var saved_speedEnemyReduce = ls.speedEnemyReduce;
                ls.speedEnemyReduce = ls.speedEnemy

                // # after 5 second return to same
                setTimeout(() => {
                    ls.speedEnemyReduce = saved_speedEnemyReduce;
                }, this.bonusValue*1000);

            }

        }else if (this.type === 'tank'){
            if(ls.tankmode === false){
                ls.tankmode = true;
                // window.cellset.clearTrail();
                setTimeout(() => {
                    ls.tankmode = false;
                }, this.bonusValue*1000);

            }
            bonus_text = 'Bonus - Frozen';
            // # after 5 second return to same

        }
        $('#banner').html(bonus_text);
        // return to banner after 2 sec
        setTimeout(() => {
            if($('#banner').html() === bonus_text)
                {
                    $('#banner').html('Keep going ...');
                }
        }, 2000);
    }
}
