import { GameEventType } from "./game-event.js";
import { getTankById, newShrinkMark, newSmokeMark, newTankFire, newTankMove, TurnResultType, } from "./game-objects.js";
import { idxToUnitVector, includesVector, interpolatePath, isNeighbor, unitVectorToIdx, Vector, } from "./vector.js";
const T_PRESS_TO_FIRE = 700;
const TANK_ROTATION_SPEED = 100;
const TANK_MAX_SPEED = 1.2;
const FIRING_DURATION = 350;
const FIRING_PAUSE = 300;
const EXPLOSION_DURATION = 900;
const EXPLOSION_PAUSE_DURATION = 250;
const SHRINK_DURATION = 750;
var PointerMode;
(function (PointerMode) {
    PointerMode[PointerMode["None"] = 0] = "None";
    PointerMode[PointerMode["Drag"] = 1] = "Drag";
    PointerMode[PointerMode["TankNavigation"] = 2] = "TankNavigation";
    PointerMode[PointerMode["TankFire"] = 3] = "TankFire";
    PointerMode[PointerMode["Animation"] = 4] = "Animation";
})(PointerMode || (PointerMode = {}));
export class Grid {
    constructor(gameState, displayDriver, config, notifier, audioDriver) {
        this.lastPoint = Vector.zero();
        this.curT = 0;
        this.pointerStartTime = 0;
        this.isPointerDown = false;
        this.curMode = PointerMode.None;
        this.curTank = null;
        this.turnResults = [];
        this.curTurnResultIdx = 0;
        this.prevResult = null;
        this.curResult = null;
        getCameraShake(0.5);
        this.gameState = gameState;
        this.displayDriver = displayDriver;
        this.config = {
            driveRange: config.driveRange,
            visibilityRange: config.visibilityRange,
            center: config.center,
        };
        this.recalculateVisibleHexes();
        this.animationResolver = new ResolverIdle(this);
        this.notifier = notifier;
        this.audioDriver = audioDriver;
    }
    transition() {
        this.nextTurnResult();
        const nextAnimationResolver = this.getAnimationResolver();
        this.animationResolver = nextAnimationResolver;
        this.animationResolver.animate();
    }
    getTank(id) {
        const tank = getTankById(this.gameState.playerTanks, id) ||
            getTankById(this.gameState.enemyTanks, id);
        if (tank === undefined)
            return null;
        return tank;
    }
    getAnimationResolver() {
        if (this.curResult === null) {
            return new ResolverIdle(this);
        }
        if (this.curResult.type === TurnResultType.EndTurn) {
            return new ResolverFinish(this);
        }
        if (this.curResult.type === TurnResultType.Move2) {
            const tank = this.getTank(this.curResult.id);
            if (tank === null)
                return new ResolverError(this);
            return new ResolverMove2(this, this.curResult, tank);
        }
        if (this.curResult.type === TurnResultType.Move3) {
            const tank = this.getTank(this.curResult.id);
            if (tank === null)
                return new ResolverError(this);
            return new ResolverMove3(this, this.curResult, tank);
        }
        if (this.curResult.type === TurnResultType.Fire) {
            const tank = this.getTank(this.curResult.id);
            if (tank === null)
                return new ResolverError(this);
            return new ResolverFire(this, this.curResult, tank);
        }
        if (this.curResult.type === TurnResultType.Explosion) {
            if (this.curResult.destroyed) {
                const tank = this.getTank(this.curResult.id);
                if (tank === null)
                    return new ResolverError(this);
                return new ResolverExplosion(this, this.curResult, tank);
            }
            return new ResolverExplosion(this, this.curResult);
        }
        if (this.curResult.type === TurnResultType.Shrink) {
            return new ResolverShrink(this, this.curResult);
        }
        return new ResolverRest(this);
    }
    getActions() {
        const actions = [];
        for (const idx of this.gameState.turnOrder) {
            const tank = getTankById(this.gameState.playerTanks, idx);
            if (tank === null)
                continue;
            if (tank.shooting) {
                const shootingVec = idxToUnitVector(tank.shootingDir);
                if (shootingVec === null)
                    continue;
                actions.push(newTankFire(idx, shootingVec));
            }
            else if (tank.path.length >= 1) {
                actions.push(newTankMove(idx, tank.path));
            }
        }
        return actions;
    }
    handlePointerStart(p) {
        this.lastPoint = p;
        this.isPointerDown = true;
        this.pointerStartTime = this.curT;
        if (this.curMode === PointerMode.Animation) {
            return;
        }
        const tank = this.getCollidingTank(p);
        if (tank !== null) {
            this.notifier.notify({ type: GameEventType.TankManipulation });
            this.curMode = PointerMode.TankNavigation;
            tank.path = [];
            tank.shooting = false;
            tank.shootingDir = 0;
            this.curTank = tank;
            this.recalculateTraversable();
            this.saveOrder(tank.id);
            return;
        }
        this.curMode = PointerMode.Drag;
    }
    handlePointerMove(p) {
        var _a, _b;
        if (!this.isPointerDown)
            return;
        switch (this.curMode) {
            case PointerMode.None:
                break;
            case PointerMode.Drag:
                this.handleDrag(p);
                break;
            case PointerMode.TankNavigation:
                if (((_a = this.curTank) === null || _a === void 0 ? void 0 : _a.path.length) === 0 &&
                    this.curT - this.pointerStartTime > T_PRESS_TO_FIRE &&
                    ((_b = this.curTank) === null || _b === void 0 ? void 0 : _b.p.eq(this.displayDriver.screenToGridCoords(p)))) {
                    this.curMode = PointerMode.TankFire;
                    this.curTank.shooting = true;
                    this.curTank.shootingDir = 0;
                    this.gameState.availableHexes.clear();
                    this.gameState.conditionallyAvailableHexes.clear();
                    this.handleTankFire(p);
                }
                else {
                    this.handleTankNavigation(p);
                }
                break;
            case PointerMode.TankFire:
                this.handleTankFire(p);
                break;
            case PointerMode.Animation:
                this.handleDrag(p);
                break;
        }
        this.lastPoint = p;
    }
    handlePointerEnd(p) {
        this.isPointerDown = false;
        if (this.curMode === PointerMode.Animation)
            return;
        if (this.curMode === PointerMode.TankNavigation ||
            this.curMode === PointerMode.TankFire) {
            this.handleEndTankNavigationFire();
        }
        this.curMode = PointerMode.None;
        this.curTank = null;
        this.recalculateTraversable();
    }
    tick() {
        this.animationResolver.animate();
        if (this.isPointerDown && this.curMode === PointerMode.TankNavigation) {
            this.handlePointerMove(this.lastPoint);
        }
    }
    handleStartAnimation() {
        this.handlePointerEnd(Vector.zero());
        this.curMode = PointerMode.Animation;
    }
    handleEndAnimation() {
        this.handlePointerEnd(Vector.zero());
        this.curMode = PointerMode.None;
        this.notifier.notify({ type: GameEventType.AnimationEnd });
    }
    setT(t) {
        this.curT = t;
    }
    nextTurnResult() {
        this.prevResult = this.curResult;
        if (this.curTurnResultIdx >= this.turnResults.length) {
            this.curResult = null;
            return;
        }
        this.curResult = this.turnResults[this.curTurnResultIdx];
        this.curTurnResultIdx++;
    }
    peekTurnResult() {
        if (this.curTurnResultIdx >= this.turnResults.length) {
            return null;
        }
        return this.turnResults[this.curTurnResultIdx];
    }
    pushResults(turnResults) {
        this.clearPathsAndAims();
        if (this.curTurnResultIdx >= this.turnResults.length) {
            this.turnResults = turnResults;
            this.curTurnResultIdx = 0;
        }
        else {
            this.turnResults.push(...turnResults);
        }
        this.turnResults.push({ type: TurnResultType.EndTurn });
    }
    handleEndTankNavigationFire() {
        if (this.curTank !== null &&
            this.curMode === PointerMode.TankNavigation &&
            this.curTank.path.length === 0) {
            this.removeOrder(this.curTank.id);
        }
    }
    clearPathsAndAims() {
        for (const tank of this.gameState.playerTanks) {
            tank.path = [];
            tank.shooting = false;
            tank.shootingDir = 0;
        }
    }
    saveOrder(id) {
        this.removeOrder(id);
        this.gameState.turnOrder.push(id);
    }
    removeOrder(id) {
        const idx = this.gameState.turnOrder.indexOf(id);
        if (idx !== -1) {
            this.gameState.turnOrder.splice(idx, 1);
        }
    }
    handleDrag(p) {
        if (this.lastPoint === null)
            return;
        this.displayDriver.addCameraOffset(p.sub(this.lastPoint));
    }
    handleTankFire(p) {
        if (this.curTank === null)
            return;
        const v = p.sub(this.displayDriver.gridToScreenCoords(this.curTank.p));
        this.curTank.shootingDir = Math.floor((v.angle() + 30) / 60) % 6;
    }
    handleTankNavigation(p) {
        var _a;
        if (this.curTank === null)
            return;
        const gridP = this.displayDriver.screenToGridCoords(p);
        if (this.curTank.path.length > this.config.driveRange)
            return;
        if (gridP.eq(this.curTank.p))
            return;
        const lastOnPath = this.curTank.path.length > 0
            ? this.curTank.path[this.curTank.path.length - 1]
            : this.curTank.p;
        if (!isNeighbor(lastOnPath, gridP))
            return;
        if (includesVector(this.curTank.path, gridP))
            return;
        if (!this.gameState.hexes.has(gridP.toString()))
            return;
        if (!((_a = this.gameState.hexes.get(gridP.toString())) === null || _a === void 0 ? void 0 : _a.traversable))
            return;
        if (this.curTank.path.length === 0) {
            this.curTank.path.push(this.curTank.p);
        }
        this.curTank.path.push(gridP);
        this.recalculateTraversable();
    }
    recalculateTraversable() {
        this.recalculateAvailableHexes(this.gameState.availableHexes, false);
        this.recalculateAvailableHexes(this.gameState.conditionallyAvailableHexes, true);
    }
    recalculateAvailableHexes(set, conditional) {
        set.clear();
        if (this.curTank === null) {
            return;
        }
        let start = this.curTank.p;
        let range = this.config.driveRange;
        if (this.curTank.path.length > 0) {
            start = this.curTank.path[this.curTank.path.length - 1];
            range -= this.curTank.path.length - 1;
        }
        if (range <= 0) {
            return;
        }
        const unavailable = new Set();
        if (!conditional) {
            for (const tank of this.gameState.playerTanks) {
                if (!tank.visible || tank.id === this.curTank.id)
                    continue;
                unavailable.add(tank.p.toString());
            }
            for (const tank of this.gameState.enemyTanks) {
                if (!tank.visible)
                    continue;
                unavailable.add(tank.p.toString());
            }
        }
        for (let i = 0; i < this.curTank.path.length - 1; i++) {
            if (unavailable.has(this.curTank.path[i].toString()) && !conditional) {
                set.clear();
                return;
            }
            unavailable.add(this.curTank.path[i].toString());
        }
        if (this.curTank.path.length > 0 &&
            unavailable.has(this.curTank.path[this.curTank.path.length - 1].toString()) &&
            !conditional) {
            set.clear();
            return;
        }
        let frontier = [start];
        set.add(start.toString());
        for (let i = 0; i < range; i++) {
            let newFrontier = [];
            for (const p of frontier) {
                for (const n of p.neighbors()) {
                    if (set.has(n.toString())) {
                        continue;
                    }
                    const hex = this.gameState.hexes.get(n.toString());
                    if (hex === undefined || !hex.traversable) {
                        continue;
                    }
                    if (unavailable.has(n.toString())) {
                        continue;
                    }
                    set.add(n.toString());
                    newFrontier.push(n);
                }
            }
            frontier = newFrontier;
        }
        set.delete(start.toString());
    }
    recalculateVisibleHexes() {
        this.gameState.visibleHexes.clear();
        for (const tank of this.gameState.playerTanks) {
            if (!tank.visible)
                continue;
            for (const hex of this.gameState.hexes.values()) {
                if (tank.p.gridDistance(hex.p) <= this.config.visibilityRange) {
                    this.gameState.visibleHexes.add(hex.p.toString());
                }
            }
        }
    }
    getCollidingTank(p) {
        const gridP = this.displayDriver.screenToGridCoords(p);
        for (const tank of this.gameState.playerTanks) {
            if (tank.visible && tank.p.eq(gridP)) {
                return tank;
            }
        }
        return null;
    }
}
class ResolverFinish {
    constructor(grid) {
        this.grid = grid;
    }
    animate() {
        this.grid.handleEndAnimation();
        this.grid.transition();
    }
}
class ResolverIdle {
    constructor(grid) {
        this.grid = grid;
    }
    animate() {
        if (this.grid.peekTurnResult() === null)
            return;
        this.grid.handleStartAnimation();
        this.grid.transition();
    }
}
class ResolverError {
    constructor(grid) {
        this.grid = grid;
    }
    animate() {
        this.grid.transition();
    }
}
function areaUnderLine(y1, y2, t) {
    if (t <= 0)
        return 0;
    const low = Math.min(y1, y2);
    const diff = Math.abs(y1 - y2);
    const rect = low * t;
    if (t >= 1)
        return low + diff / 2;
    if (y1 <= y2) {
        return rect + (t * t * diff) / 2;
    }
    return rect + ((1 - (1 - t) * (1 - t)) * diff) / 2;
}
function normalize360(angle) {
    while (angle < 0) {
        angle += 360;
    }
    while (angle >= 360) {
        angle -= 360;
    }
    return angle;
}
function normalize180(angle) {
    while (angle < -180) {
        angle += 360;
    }
    while (angle >= 180) {
        angle -= 360;
    }
    return angle;
}
class ResolverMove2 {
    constructor(grid, result, tank) {
        this.grid = grid;
        this.result = result;
        this.startAngle = tank.angleBody;
        this.turretOffset = normalize360(tank.angleTurret - tank.angleBody);
        this.endAngle = unitVectorToIdx(result.p2.sub(result.p1)) * 60;
        this.dAngle = normalize180(this.endAngle - this.startAngle);
        this.tRotation = (Math.abs(this.dAngle) / TANK_ROTATION_SPEED) * 1000;
        if (!this.result.start) {
            this.tRotation = 0;
        }
        this.startT = this.grid.curT;
        this.startF = this.result.p1;
        this.endF = this.result.p2;
        const mid = this.startF.add(this.endF).mul(0.5);
        if (this.result.start) {
            this.endF = mid;
        }
        else {
            this.startF = mid;
        }
        tank.p = this.result.start ? this.result.p1 : this.result.p2;
        this.tank = tank;
        this.grid.recalculateVisibleHexes();
        const d = this.endF
            .toPlaneCoords()
            .sub(this.startF.toPlaneCoords())
            .length();
        const aul = areaUnderLine(0, 1, 1);
        this.tMove = (d / (aul * TANK_MAX_SPEED)) * 1000;
        this.aul = aul;
        if (result.start) {
            this.y1 = 0;
            this.y2 = 1;
        }
        else {
            this.y1 = 1;
            this.y2 = 0;
        }
    }
    animate() {
        this.grid.audioDriver.startSound("driving");
        const elapsed = this.grid.curT - this.startT;
        const fracT1 = this.tRotation === 0 ? 1 : elapsed / this.tRotation;
        const fracT2 = (elapsed - this.tRotation) / this.tMove;
        this.animateRotation(fracT1);
        if (fracT2 >= 0) {
            this.animateMove(fracT2);
        }
    }
    animateRotation(fracT) {
        if (fracT <= 0) {
            this.tank.angleBody = this.startAngle;
            this.tank.angleTurret = normalize360(this.startAngle + this.turretOffset);
            return;
        }
        if (fracT >= 1) {
            this.tank.angleBody = this.endAngle;
            this.tank.angleTurret = normalize360(this.endAngle + this.turretOffset);
            return;
        }
        this.tank.angleBody = normalize360(this.startAngle + fracT * this.dAngle);
        this.tank.angleTurret = normalize360(this.tank.angleBody + this.turretOffset);
    }
    animateMove(fracT) {
        const frac = areaUnderLine(this.y1, this.y2, fracT) / this.aul;
        const p = this.startF.interpolate(this.endF, frac);
        this.tank.pF = p;
        if (frac >= 1) {
            this.grid.audioDriver.endSound("driving");
            this.grid.transition();
        }
    }
}
var TurnType;
(function (TurnType) {
    TurnType[TurnType["Straight"] = 0] = "Straight";
    TurnType[TurnType["Wide"] = 1] = "Wide";
    TurnType[TurnType["Sharp"] = 2] = "Sharp";
})(TurnType || (TurnType = {}));
class ResolverMove3 {
    constructor(grid, result, tank) {
        this.grid = grid;
        this.result = result;
        const v1 = result.p2.sub(result.p1);
        const v2 = result.p3.sub(result.p2);
        this.turnType = TurnType.Wide;
        this.low = 0.7;
        if (v1.eq(v2)) {
            this.turnType = TurnType.Straight;
            this.low = 1;
        }
        else if (result.p1.gridDistance(result.p3) === 1) {
            this.turnType = TurnType.Sharp;
            this.low = 0.3;
        }
        this.startAngle = unitVectorToIdx(v1) * 60;
        this.turretOffset = normalize360(tank.angleTurret - tank.angleBody);
        this.endAngle = unitVectorToIdx(v2) * 60;
        this.dAngle = normalize180(this.endAngle - this.startAngle);
        this.startT = this.grid.curT;
        this.p2 = result.p2;
        this.p1 = result.p1.add(result.p2).mul(0.5);
        this.p3 = result.p3.add(result.p2).mul(0.5);
        tank.p = this.p2;
        this.tank = tank;
        this.grid.recalculateVisibleHexes();
        const d1 = this.p2.toPlaneCoords().sub(this.p1.toPlaneCoords()).length();
        const d2 = this.p3.toPlaneCoords().sub(this.p2.toPlaneCoords()).length();
        const d = d1 + d2;
        const aul = areaUnderLine(1, this.low, 1);
        this.aul = aul;
        this.t = (d / (aul * TANK_MAX_SPEED)) * 1000;
        const p1 = result.p1.add(result.p2).mul(0.5);
        const p5 = result.p2.add(result.p3).mul(0.5);
        const p2 = result.p2.add(p1.sub(result.p2).mul(0.7));
        const p4 = result.p2.add(p5.sub(result.p2).mul(0.7));
        const midToStart = p1.sub(result.p2);
        const midToEnd = p5.sub(result.p2);
        const p3 = result.p2.add(midToStart.add(midToEnd).mul(0.25));
        this.points = [p1, p2, p3, p4, p5];
        const lengths = [p2.sub(p1), p3.sub(p2), p4.sub(p3), p5.sub(p4)].map((p) => p.toPlaneCoords().length());
        const sum = lengths.reduce((s, l) => s + l, 0);
        this.fracs = [];
        let cur = 0;
        for (const l of lengths) {
            cur += l / sum;
            this.fracs.push(cur);
        }
    }
    animate() {
        this.grid.audioDriver.startSound("driving");
        const fracT = (this.grid.curT - this.startT) / this.t;
        let area = areaUnderLine(1, this.low, fracT * 2) / 2;
        if (fracT >= 0.5) {
            area += areaUnderLine(this.low, 1, (fracT - 0.5) * 2) / 2;
        }
        const frac = area / this.aul;
        this.tank.pF = interpolatePath(this.points, this.fracs, frac);
        const angleBody = normalize360(this.startAngle + fracT * this.dAngle);
        const angleTurret = normalize360(angleBody + this.turretOffset);
        this.tank.angleBody = angleBody;
        this.tank.angleTurret = angleTurret;
        if (fracT >= 1) {
            this.grid.audioDriver.endSound("driving");
            this.tank.pF = this.p3;
            this.tank.angleBody = this.endAngle;
            this.tank.angleTurret = normalize360(this.endAngle + this.turretOffset);
            this.grid.transition();
        }
    }
}
class ResolverFire {
    constructor(grid, result, tank) {
        this.playedFiringSound = false;
        this.grid = grid;
        this.tank = tank;
        this.startT = this.grid.curT;
        this.startAngle = tank.angleBody;
        this.turretOffset = normalize180(tank.angleTurret - tank.angleBody);
        this.endAngle = unitVectorToIdx(result.dir) * 60;
        const absAngleBetweenBodyAndDir = Math.abs(normalize180(this.endAngle - tank.angleBody));
        if (absAngleBetweenBodyAndDir < 90) {
            this.dAngleBody = 0;
            this.dAngleTurret = normalize180(this.endAngle - tank.angleTurret);
            this.turretOnly = true;
            this.tRotation =
                (Math.abs(this.dAngleTurret) / TANK_ROTATION_SPEED) * 1000;
        }
        else {
            this.dAngleBody = normalize180(this.endAngle - this.startAngle);
            this.dAngleTurret = -this.turretOffset;
            this.turretOnly = false;
            this.tRotation =
                (Math.max(Math.abs(this.dAngleBody), Math.abs(this.dAngleTurret)) /
                    TANK_ROTATION_SPEED) *
                    1000;
        }
        this.tFiring = FIRING_DURATION;
        this.tPause = FIRING_PAUSE;
        this.pFiring = this.tank.p.add(result.dir.mul(0.3));
    }
    animate() {
        const elapsed = this.grid.curT - this.startT;
        const fracT1 = this.tRotation === 0 ? 1 : elapsed / this.tRotation;
        const fracT2 = (elapsed - this.tRotation - this.tPause) / this.tFiring;
        this.animateRotation(fracT1);
        if (fracT2 >= 0) {
            this.animateFiring(fracT2);
        }
    }
    playFireSound() {
        if (this.playedFiringSound) {
            return;
        }
        this.playedFiringSound = true;
        this.grid.audioDriver.playSoundEffect("tank-firing");
    }
    animateFiring(frac) {
        this.playFireSound();
        this.grid.gameState.cameraShake = getCameraShake(frac).mul(0.04);
        if (frac >= 1) {
            this.grid.gameState.cameraShake = Vector.zero();
            this.grid.gameState.firingExplosion.frac = 0;
            this.grid.transition();
            return;
        }
        if (frac <= 0 || frac >= 1) {
            this.grid.gameState.firingExplosion.frac = 0;
            return;
        }
        this.grid.gameState.firingExplosion.frac = frac;
        this.grid.gameState.firingExplosion.p = this.pFiring;
    }
    animateRotation(frac) {
        if (frac <= 0) {
            return;
        }
        if (frac >= 1) {
            this.grid.audioDriver.endSound("turret-rotation");
            this.grid.audioDriver.endSound("driving");
            if (this.turretOnly) {
                this.tank.angleBody = this.startAngle;
                this.tank.angleTurret = this.endAngle;
                return;
            }
            this.tank.angleBody = this.endAngle;
            this.tank.angleTurret = this.endAngle;
            return;
        }
        if (this.turretOnly) {
            this.grid.audioDriver.startSound("turret-rotation");
            this.tank.angleBody = this.startAngle;
            this.tank.angleTurret = normalize360(this.startAngle + this.turretOffset + frac * this.dAngleTurret);
            return;
        }
        this.grid.audioDriver.startSound("driving");
        if (Math.abs(this.turretOffset) > 1) {
            this.grid.audioDriver.startSound("turret-rotation");
        }
        this.tank.angleBody = normalize360(this.startAngle + frac * this.dAngleBody);
        this.tank.angleTurret = normalize360(this.tank.angleBody + this.turretOffset + frac * this.dAngleTurret);
    }
}
class ResolverExplosion {
    constructor(grid, result, tank) {
        this.markAfter = 0.16;
        this.marked = false;
        this.playedExplosionSound = false;
        this.grid = grid;
        if (tank !== undefined) {
            this.tank = tank;
        }
        this.startT = this.grid.curT;
        this.p = result.p;
        this.tPause = EXPLOSION_PAUSE_DURATION;
        this.tExplosion = EXPLOSION_DURATION;
    }
    animate() {
        let fracExplosion = (this.grid.curT - this.startT - this.tPause) / this.tExplosion;
        let frac = (this.grid.curT - this.startT) / (this.tExplosion + 2 * this.tPause);
        if (!this.playedExplosionSound && fracExplosion >= 0) {
            this.playedExplosionSound = true;
            this.grid.audioDriver.playSoundEffect("explosion");
        }
        fracExplosion = Math.max(fracExplosion, 0);
        this.animateExplosion(fracExplosion);
        if (frac >= 1) {
            this.grid.gameState.cameraShake = Vector.zero();
            this.grid.recalculateVisibleHexes();
            this.grid.transition();
        }
    }
    animateExplosion(frac) {
        this.grid.gameState.cameraShake = getCameraShake(frac).mul(0.1);
        this.grid.gameState.explosion.frac = frac;
        this.grid.gameState.explosion.p = this.p;
        if (this.tank !== undefined && !this.marked && frac >= this.markAfter) {
            this.marked = true;
            this.tank.visible = false;
            this.grid.gameState.overlays.push(newSmokeMark(this.tank.p));
        }
        if (frac >= 1) {
            this.grid.gameState.explosion.frac = 0;
        }
    }
}
class ResolverShrink {
    constructor(grid, result) {
        this.duration = SHRINK_DURATION;
        this.grid = grid;
        this.result = result;
        this.startT = this.result.started ? this.grid.curT : 0;
        this.center = this.grid.config.center;
    }
    animate() {
        if (!this.result.started) {
            this.markShrinkingNext();
            this.grid.transition();
            return;
        }
        const frac = (this.grid.curT - this.startT) / this.duration;
        if (frac < 0)
            return;
        if (frac >= 1) {
            for (const [key, hex] of this.grid.gameState.hexes.entries()) {
                if (hex.p.gridDistance(this.center) >= this.result.r) {
                    this.grid.gameState.hexes.delete(key);
                }
            }
            this.grid.transition();
            return;
        }
        this.animateShrinking(frac);
    }
    markShrinkingNext() {
        for (const hex of this.grid.gameState.hexes.values()) {
            if (hex.p.gridDistance(this.center) == this.result.r) {
                this.grid.gameState.overlays.push(newShrinkMark(hex.p));
            }
        }
    }
    animateShrinking(frac) {
        const opacity = 1 - frac;
        for (const hex of this.grid.gameState.hexes.values()) {
            if (hex.p.gridDistance(this.center) >= this.result.r) {
                hex.opacity = opacity;
            }
        }
    }
}
class ResolverRest {
    constructor(grid) {
        this.grid = grid;
        this.turnResult = this.grid.curResult;
    }
    animate() {
        switch (this.turnResult.type) {
            case TurnResultType.Visible:
                this.resolveVisibility(this.turnResult);
                break;
            case TurnResultType.Destroyed:
                this.resolveDestroyed(this.turnResult);
                break;
            case TurnResultType.Shrink:
                if (this.turnResult.started) {
                    for (const [key, hex] of this.grid.gameState.hexes.entries()) {
                        if (hex.p.gridDistance(this.grid.config.center) >= this.turnResult.r) {
                            this.grid.gameState.hexes.delete(key);
                        }
                    }
                }
                break;
        }
        this.grid.recalculateVisibleHexes();
        this.grid.transition();
    }
    resolveDestroyed(res) {
        const tank = getTankById(this.grid.gameState.enemyTanks, res.id);
        if (tank === null)
            return;
        tank.visible = false;
        this.grid.gameState.overlays.push(newSmokeMark(res.p));
    }
    resolveVisibility(res) {
        const tank = getTankById(this.grid.gameState.enemyTanks, res.id);
        if (tank === null)
            return;
        tank.p = res.p;
        tank.pF = res.p;
        tank.visible = res.visible;
    }
}
function getCameraShake(frac) {
    if (frac <= 0 || frac >= 1) {
        return Vector.zero();
    }
    const mid = 0.25;
    const x = 5.5 * Math.sin(20.8 * Math.PI * frac + 2.3) +
        2.2 * Math.sin(5.6 * Math.PI * frac + 5) +
        1.8 * Math.sin(11.2 * Math.PI * frac + 1);
    const y = 4 * Math.sin(17.6 * Math.PI * frac - 2.5) +
        2.8 * Math.sin(9.6 * Math.PI * frac + 4) +
        1.6 * Math.sin(1.6 * Math.PI * frac + 0);
    const lim = frac <= mid ? (1 / mid) * frac : 1 - (frac - mid) / (1 - mid);
    return new Vector(x, y).mul(lim);
}
