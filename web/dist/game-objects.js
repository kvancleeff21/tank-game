import { SHRINK_MARK_IDX, SMOKE_MARK_IDX } from "./display-driver.js";
import { Vector } from "./vector.js";
export function getTankById(tanks, id) {
    for (const tank of tanks) {
        if (tank.id === id) {
            return tank;
        }
    }
    return null;
}
export var GameResult;
(function (GameResult) {
    GameResult[GameResult["Win"] = 1] = "Win";
    GameResult[GameResult["Draw"] = 2] = "Draw";
    GameResult[GameResult["Lose"] = 3] = "Lose";
})(GameResult || (GameResult = {}));
var TankActionType;
(function (TankActionType) {
    TankActionType[TankActionType["Move"] = 1] = "Move";
    TankActionType[TankActionType["Fire"] = 2] = "Fire";
})(TankActionType || (TankActionType = {}));
export function newTankFire(id, dir) {
    return { type: TankActionType.Fire, id: id, dir: dir };
}
export function newTankMove(id, path) {
    return { type: TankActionType.Move, id: id, path: path };
}
export function newSmokeMark(p) {
    return { p: p, variant: SMOKE_MARK_IDX };
}
export function newShrinkMark(p) {
    return { p: p, variant: SHRINK_MARK_IDX };
}
export var TurnResultType;
(function (TurnResultType) {
    TurnResultType[TurnResultType["Move2"] = 1] = "Move2";
    TurnResultType[TurnResultType["Move3"] = 2] = "Move3";
    TurnResultType[TurnResultType["Fire"] = 3] = "Fire";
    TurnResultType[TurnResultType["Explosion"] = 4] = "Explosion";
    TurnResultType[TurnResultType["Destroyed"] = 5] = "Destroyed";
    TurnResultType[TurnResultType["Visible"] = 6] = "Visible";
    TurnResultType[TurnResultType["Shrink"] = 7] = "Shrink";
    TurnResultType[TurnResultType["EndTurn"] = 256] = "EndTurn";
})(TurnResultType || (TurnResultType = {}));
export class GameState {
    constructor(config) {
        this.visibleHexes = new Set();
        this.availableHexes = new Set();
        this.conditionallyAvailableHexes = new Set();
        this.turnOrder = [];
        this.overlays = [];
        this.explosion = { frac: 0, p: Vector.zero() };
        this.firingExplosion = { frac: 0, p: Vector.zero() };
        this.cameraShake = Vector.zero();
        this.hexes = new Map(config.hexes.map((h) => [
            h.p.toString(),
            { p: h.p, variant: h.variant, traversable: true, opacity: 1 },
        ]));
        this.sites = config.sites.map((s) => ({ p: s.p, variant: s.variant }));
        for (const site of this.sites) {
            const hex = this.hexes.get(site.p.toString());
            if (hex !== undefined) {
                hex.traversable = false;
            }
        }
        this.playerTanks = config.playerTanks.map((t) => ({
            id: t.id,
            p: t.p,
            pF: t.p,
            angleBody: 120,
            angleTurret: 134,
            path: [],
            shooting: false,
            shootingDir: 0,
            visible: true,
        }));
        this.enemyTanks = config.enemyTanks.map((t) => ({
            id: t.id,
            p: t.p,
            pF: t.p,
            angleBody: 304,
            angleTurret: 288,
            path: [],
            shooting: false,
            shootingDir: 0,
            visible: false,
        }));
        for (const et of this.enemyTanks.values()) {
            for (const pt of this.playerTanks.values()) {
                if (pt.p.gridDistance(et.p) <= config.visibilityRange) {
                    et.visible = true;
                    break;
                }
            }
        }
    }
}
