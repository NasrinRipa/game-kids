# PicXonix Game Rules

## 1. Game Description
PicXonix is a territory-capture arcade game inspired by Xonix.

You control a cursor on a grid that hides a background image. The goal is to reveal enough of the image by conquering area while avoiding enemies.

A level is completed when the cleared-area percentage reaches the level target.

## 2. Core Objective
- Move from safe cleared/border cells into uncleared area.
- Draw a trail and return to cleared territory to close a region.
- Closed regions are evaluated and eligible area is conquered (revealed).
- Reach target area percent for the level.
- Avoid losing all lives.

## 3. Playfield Model
- Grid has an interior playfield plus a 2-cell outer border ring.
- Interior uncleared cells are initially hidden.
- Border cells are considered cleared from the start.
- Cursor starts at top border center.

### Cell States
- Uncleared: hidden playfield area.
- Cleared: already conquered/revealed (safe for cursor, dangerous for warder collisions).
- Trail: active line currently being drawn by cursor.

## 4. Game Elements and Behavior

### 4.1 Cursor (Player)
- Moves in 4 directions (up/down/left/right).
- Cannot instantly reverse direction by 180 degrees while currently on a trail.
- If movement leaves valid grid bounds, cursor stops.

Normal movement behavior:
- Moving onto uncleared cell: extends trail.
- Moving onto cleared cell while not on trail: continues safely.
- Moving onto cleared cell while on trail: closes trail and triggers conquest attempt.

Trail crossing behavior:
- Stepping onto your own trail from a non-backtracking angle causes collision/fault.
- Backtracking exactly one step along your own trail is allowed and removes the last trail cell.

Special end-of-trail checks:
- Returning to the pre-trail origin path in certain short-loop cases can count as collision instead of conquest.

### 4.2 Ball Enemy
- Moves diagonally and bounces.
- Primary danger zone is uncleared/trail gameplay space.
- Collides with cursor by direct overlap (adjacent collision is disabled by default).
- Balls can also collide with active cursor trail (this causes player fault).

Ball exile behavior:
- If a ball ends up on cleared territory (possible after sneaky interactions), it is treated as exiled and starts roaming like warder movement rules while still rendering as a ball.

### 4.3 Warder Enemy
- Moves diagonally along border/cleared territory logic.
- Warders are dangerous when cursor is on cleared territory.
- Direct overlap collision only (adjacent collision disabled by default).

### 4.4 Bonus Item
- Spawned as a 2x2 cell item.
- Picked up when cursor enters any covered cell.
- Removed immediately on pickup, then its effect is applied.
- Spawn location must be inside margins and fully on uncleared cells.

### 4.5 Grid / Region Conquest System
When a trail is closed:
- Game flood-fills connected uncleared, non-trail regions.
- Any region containing a ball is protected and not conquered.
- If multiple conquerable regions exist, only the smallest conquerable region is cleared.
- Trail cells are finalized into cleared territory after conquest processing.

## 5. Collision and Fault Rules
A fault (life loss) occurs when any of the following happens:
- Ball hits cursor (normal overlap rule).
- Warder hits cursor while cursor is on cleared-valid target state.
- Ball touches cursor trail.
- Cursor improperly crosses own trail.
- Certain invalid short-loop closures near trail origin.

After fault:
- 1 life is deducted.
- Temporary lockout/recovery delay applies.
- Trail is reset.
- Cursor returns to initial position.
- Warders are reset to start positions.
- Balls are not fully reset to level start positions.

If lives reach 0:
- Level/game run ends and UI returns to Play state.

## 6. Scoring and Progression
- Cleared percent is tracked as conquered cells / total interior cells.
- Score increases by incremental newly-cleared percentage only.
- Level completes when cleared percent >= level target.
- On level complete, clear animation runs, then Next Level (or Play Again on final level).

## 7. Level Setup and Defaults
Each level defines:
- Image file.
- Ball count.
- Warder count.
- Cursor speed.
- Enemy speed.
- Target area percent.
- Allowed bonus type list for that level.

Global/default behaviors:
- Initial lives are configurable (default is 3).
- Carry-over speed option can preserve speed between levels.
- Timed effects are cancelled at level end.
- Invincibility and enemy slowdown are reset at level end.

## 8. Bonus Spawn Rules
Initial spawn:
- One bonus is spawned at level start using a random type from that level's allowed bonusTypes.

Respawn conditions:
- No active bonus currently on field.
- Not in tank mode.
- Cursor is not drawing trail.
- Cleared area is below threshold (50%).

Placement constraints:
- Bonus attempts are limited (max tries).
- Bonus must fit inside configured margins from edges.
- All cells under bonus must be uncleared.

## 9. Bonus Definitions and Logic

## 9.1 speed
- Effect: increases cursor bonus speed by value.
- Logic in current implementation: additive and persistent for the level (not timed).
- Default behavior after pickup: cursor permanently moves faster for remainder of level unless externally changed.

## 9.2 slow
- Effect: increases enemy slowdown by 30% of current effective enemy speed.
- Logic in current implementation: additive and persistent for the level (not timed).
- Default behavior after pickup: enemies remain slower for remainder of level unless overridden by other effects.

## 9.3 sneaky
- Effect: temporary invincibility mode.
- Duration: value seconds.
- During effect:
- Enemy/cursor collision checks are ignored where invincibility is honored.
- Trail is rendered semi-transparent.
- If trail is successfully closed during sneaky, sneaky ends immediately on conquest finalize.

After sneaky ends:
- Invincibility is disabled.
- Cursor visual effect is rebuilt.

## 9.4 killward
- Effect: removes one warder immediately, if any exist.
- Updates warder count accordingly.
- No timed effect.

## 9.5 life
- Effect: grants +1 life instantly.
- No timed effect.

## 9.6 freez
- Effect: temporarily freezes enemies by setting slowdown equal to enemy speed (effective enemy movement becomes 0).
- Duration: value seconds.
- On end: previous slowdown value is restored.
- Edge case: if already fully frozen, applying freez may produce no new timer/effect extension.

## 9.7 tank
- Effect: enables tank mode for value seconds (or until termination condition).

During tank mode:
- Cursor movement converts uncleared cells directly into cleared cells while moving.
- Existing active trail is converted/cleared immediately.
- Trail state snapshot is stored for post-tank conquer handling.
- Tank-cleared cells are tracked.

Tank termination:
- Ends when timer expires, or
- Ends immediately when cursor steps onto any already-cleared cell.

When tank ends by stepping on cleared cell:
- Stored tank trail is restored logically.
- Conquer phase is triggered from stored trail.

When tank ends by timer:
- Stored trail data is discarded without conquest.
- Optional auto-stop can halt cursor direction (enabled by default).

## 10. Timed Effect Visual Warning
- Timed effects use a cursor visual effect color.
- Visual warning: effect color turns off shortly before expiry (warning window).
- This is only a visual warning; underlying timer continues until actual expiration.

## 11. Default Behavior (No Bonus Active)
When no bonus is active:
- Cursor uses base level cursor speed plus any persistent bonusSpeed already gained.
- Enemy speed uses base enemySpeed minus accumulated enemySlowdown.
- Invincibility is off.
- Tank mode is off.
- Standard collision rules apply.
- Bonus may respawn if spawn conditions are met.

## 12. Input and Runtime Controls
- Arrow keys: move.
- Space: stop cursor.
- Enter: start/play/next level when button is available.
- Esc: pause/resume.
- Q: quit to start/try-again state.
- Mouse/tap on game area: sets movement direction toward clicked position (resolved to axis movement).

## 13. Important Implementation Notes
- Adjacent collision mode exists but is disabled by default.
- Maximum warders supported on field is capped.
- Bonus types killward and life are implemented, but whether they appear depends on each level's bonusTypes list.
- Bonus spawn above cleared-area threshold is blocked.
