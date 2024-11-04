export class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    static zero() {
        return new Vector(0, 0);
    }
    toString() {
        return `${this.x}_${this.y}`;
    }
    mul(multiplier) {
        return new Vector(this.x * multiplier, this.y * multiplier);
    }
    add(other) {
        return new Vector(this.x + other.x, this.y + other.y);
    }
    sub(other) {
        return new Vector(this.x - other.x, this.y - other.y);
    }
    matmul(other) {
        return new Vector(this.x * other.x, this.y * other.y);
    }
    round() {
        return new Vector(Math.round(this.x), Math.round(this.y));
    }
    floor() {
        return new Vector(Math.floor(this.x), Math.floor(this.y));
    }
    eq(other) {
        return this.x === other.x && this.y === other.y;
    }
    copy() {
        return new Vector(this.x, this.y);
    }
    angle() {
        const a = (Math.atan2(this.y, this.x) * 180) / Math.PI;
        if (a < 0) {
            return a + 360;
        }
        return a;
    }
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    gridDistance(other) {
        const v = this.sub(other);
        const x = Math.abs(v.x);
        const y = Math.abs(v.y);
        const xy = Math.abs(v.x + v.y);
        return Math.max(x, y, xy);
    }
    neighbors() {
        const neighbors = [];
        for (const nv of IDX_TO_UNIT_VECTOR.values()) {
            neighbors.push(this.add(nv));
        }
        return neighbors;
    }
    interpolate(other, t) {
        if (t <= 0) {
            return this.copy();
        }
        if (t >= 1) {
            return other.copy();
        }
        return this.add(other.sub(this).mul(t));
    }
    toPlaneCoords() {
        const y = (this.y * Math.sqrt(3)) / 2;
        const x = this.x + this.y * 0.5;
        return new Vector(x, y);
    }
}
export function interpolatePath(points, fracs, frac) {
    if (frac <= 0) {
        return points[0].copy();
    }
    if (frac >= fracs[fracs.length - 1]) {
        return points[points.length - 1];
    }
    let i = 0;
    let start = 0;
    while (i < fracs.length && frac >= fracs[i]) {
        start = fracs[i];
        i++;
    }
    const end = fracs[i];
    const segFrac = (frac - start) / (end - start);
    return points[i].interpolate(points[i + 1], segFrac);
}
export function isNeighbor(p1, p2) {
    if (!p1.eq(p1.floor()))
        return false;
    if (!p2.eq(p2.floor()))
        return false;
    if (p1.eq(p2))
        return false;
    const v = p2.sub(p1);
    if (v.x <= 1 && v.x >= -1 && v.y === 0)
        return true;
    if (v.y <= 1 && v.y >= -1 && v.x === 0)
        return true;
    if ((v.x === 1 && v.y === -1) || (v.x === -1 && v.y === 1))
        return true;
    return false;
}
export function includesVector(arr, v) {
    for (const av of arr) {
        if (av.eq(v)) {
            return true;
        }
    }
    return false;
}
const IDX_TO_UNIT_VECTOR = new Map([
    [0, new Vector(1, 0)],
    [1, new Vector(0, 1)],
    [2, new Vector(-1, 1)],
    [3, new Vector(-1, 0)],
    [4, new Vector(0, -1)],
    [5, new Vector(1, -1)],
]);
export function unitVectorToIdx(v) {
    for (const [idx, uv] of IDX_TO_UNIT_VECTOR.entries()) {
        if (v.eq(uv))
            return idx;
    }
    return 0;
}
export function idxToUnitVector(idx) {
    const v = IDX_TO_UNIT_VECTOR.get(idx);
    if (v === undefined)
        return null;
    return v;
}
