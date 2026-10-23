import test from 'node:test';
import assert from 'node:assert/strict';
import {
  solveRight, solveOblique, solveCircle, solveSegment,
  solveIsoTrapezoid, solveRightTrapezoid, solveTrapezoid,
} from '../js/solvers.js';
import { parseAngle, formatAngle, parseLength, formatLength } from '../js/units.js';

const D = Math.PI / 180;
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

// Every pair of inputs taken from a known shape must solve back to that shape.
function roundTrip(solve, full, keys, count, extra = r => {}) {
  const combos = [];
  const pick = (start, chosen) => {
    if (chosen.length === count) return combos.push(chosen);
    for (let i = start; i < keys.length; i++) pick(i + 1, [...chosen, keys[i]]);
  };
  pick(0, []);
  for (const combo of combos) {
    const known = Object.fromEntries(combo.map(k => [k, full[k]]));
    const r = solve(known);
    if (r.error) { extra({ combo, error: r.error }); continue; }
    const sols = [r, r.alt].filter(Boolean);
    const match = sols.some(s => keys.every(k => Math.abs(s.values[k] - full[k]) < 1e-6));
    assert.ok(match, `combo ${combo.join(',')} -> ${JSON.stringify(r.values)}`);
  }
  return combos.length;
}

test('right triangle 3-4-5, every pair', () => {
  const full = { hyp: 5, opp: 3, adj: 4, A: Math.atan2(3, 4), C: Math.atan2(4, 3) };
  const errors = [];
  roundTrip(solveRight, full, Object.keys(full), 2, e => errors.push(e.combo.join(',')));
  assert.deepEqual(errors, ['A,C']);
  const r = solveRight({ hyp: 5, opp: 3 });
  near(r.area, 6);
  near(r.perimeter, 12);
});

test('right triangle rejects bad input', () => {
  assert.ok(solveRight({ hyp: 3, opp: 5 }).error);
  assert.ok(solveRight({ hyp: 3, A: 95 * D }).error);
});

test('oblique triangle, every valid triple', () => {
  const A = 50 * D, B = 60 * D, C = 70 * D;
  const k = 10 / Math.sin(C);
  const full = { AB: 10, BC: k * Math.sin(A), AC: k * Math.sin(B), A, B, C };
  const errors = [];
  roundTrip(solveOblique, full, Object.keys(full), 3, e => errors.push(e.combo.join(',')));
  assert.deepEqual(errors, ['A,B,C']);
});

test('oblique SSA ambiguous case gives two answers', () => {
  const r = solveOblique({ AC: 10, BC: 8, A: 40 * D });
  assert.ok(r.alt, 'expected two solutions');
  near(r.values.A + r.values.B + r.values.C, Math.PI);
  near(r.alt.values.A + r.alt.values.B + r.alt.values.C, Math.PI);
});

test('oblique impossible', () => {
  assert.ok(solveOblique({ AB: 1, AC: 1, BC: 5 }).error);
  assert.ok(solveOblique({ AB: 1, A: 100 * D, B: 90 * D }).error);
});

test('circle', () => {
  for (const key of ['r', 'd', 'circ', 'area']) {
    const full = solveCircle({ r: 3 }).values;
    const r = solveCircle({ [key]: full[key] });
    near(r.values.r, 3);
  }
});

test('segment, every pair, minor and major', () => {
  for (const theta of [70 * D, 180 * D, 250 * D, 300 * D]) {
    const r = 7;
    const full = {
      r, arc: r * theta, chord: 2 * r * Math.sin(theta / 2), h: r * (1 - Math.cos(theta / 2)), angle: theta,
    };
    const errors = [];
    roundTrip(solveSegment, full, Object.keys(full), 2, e => errors.push(`${e.combo}:${e.error}`));
    assert.deepEqual(errors, [], `theta ${theta / D}`);
  }
  near(solveSegment({ r: 1, angle: Math.PI }).area, Math.PI / 2);
});

test('isosceles trapezoid, every triple', () => {
  const a = 60 * D, L = 4, b = 6;
  const x = L * Math.cos(a);
  const full = { B: b + 2 * x, b, L, h: L * Math.sin(a), a, t: Math.PI - a };
  const errors = [];
  roundTrip(solveIsoTrapezoid, full, Object.keys(full), 3, e => errors.push(e.combo.join(',')));
  // Only combinations without enough independent information may fail.
  for (const e of errors) {
    const set = new Set(e.split(','));
    const shapeOnly = !set.has('B') && !set.has('b');
    const bothAngles = set.has('a') && set.has('t');
    assert.ok(shapeOnly || bothAngles, `unexpected failure ${e}`);
  }
});

test('right trapezoid, every triple', () => {
  const a = 55 * D, L = 5, b = 3;
  const full = { B: b + L * Math.cos(a), b, L, h: L * Math.sin(a), a, t: Math.PI - a };
  const errors = [];
  roundTrip(solveRightTrapezoid, full, Object.keys(full), 3, e => errors.push(e.combo.join(',')));
  for (const e of errors) {
    const set = new Set(e.split(','));
    assert.ok((!set.has('B') && !set.has('b')) || (set.has('a') && set.has('t')), `unexpected failure ${e}`);
  }
});

test('general trapezoid, every 4-field combo with a base', () => {
  const a1 = 70 * D, a2 = 50 * D, h = 4, b = 5;
  const x1 = h / Math.tan(a1), x2 = h / Math.tan(a2);
  const full = {
    B: b + x1 + x2, b, L1: h / Math.sin(a1), L2: h / Math.sin(a2), h,
    a1, a2, t1: Math.PI - a1, t2: Math.PI - a2,
  };
  const failures = [];
  const n = roundTrip(solveTrapezoid, full, Object.keys(full), 4, e => failures.push(e.combo));
  // Any failure must be a combo that truly lacks information.
  for (const combo of failures) {
    const s = new Set(combo);
    const noBase = !s.has('B') && !s.has('b');
    const side1 = ['L1', 'a1', 't1'].filter(k => s.has(k)).length;
    const side2 = ['L2', 'a2', 't2'].filter(k => s.has(k)).length;
    const dupAngle = (s.has('a1') && s.has('t1')) || (s.has('a2') && s.has('t2'));
    const bases = (s.has('B') ? 1 : 0) + (s.has('b') ? 1 : 0);
    const hasH = s.has('h') ? 1 : 0;
    // With one base you need h-related info on both sides; with two bases each side needs a value.
    const underdetermined = noBase || dupAngle ||
      (bases === 1 && (side1 + hasH < 2 || side2 + hasH < 2) && !(side1 >= 2 && side2 >= 1) && !(side2 >= 2 && side1 >= 1)) ||
      (bases === 2 && hasH === 0 && (side1 === 0 || side2 === 0)) ||
      (bases === 2 && hasH === 1 && side1 + side2 === 1);
    assert.ok(underdetermined, `unexpected failure ${combo.join(',')}`);
  }
  assert.ok(n > 100);
});

test('general trapezoid from bases and both legs (Heron case)', () => {
  const r = solveTrapezoid({ B: 10, b: 4, L1: 5, L2: 5 });
  near(r.values.h, 4);
});

test('angle units', () => {
  near(parseAngle('45', 'deg'), 45 * D);
  near(parseAngle('30 15 36', 'dms'), (30 + 15 / 60 + 36 / 3600) * D);
  near(parseAngle('30° 15\' 36"', 'deg'), (30 + 15 / 60 + 36 / 3600) * D);
  near(parseAngle('100', 'grade'), 45 * D);
  near(parseAngle('12', 'over12'), 45 * D);
  assert.equal(formatAngle(45 * D, 'over12', 4), '12/12');
  assert.equal(formatAngle(45 * D, 'grade', 4), '100%');
  assert.equal(formatAngle((30 + 15 / 60 + 36 / 3600) * D, 'dms', 4), '30° 15\' 36"');
  assert.equal(formatAngle(120 * D, 'grade', 2), '120°');
  assert.ok(isNaN(parseAngle('abc', 'deg')));
});

test('length units', () => {
  near(parseLength('5\' 3 1/2"', 'fif'), 63.5);
  near(parseLength('5 3 1/2', 'fif'), 63.5);
  near(parseLength('5-3-1/2', 'fif'), 63.5);
  near(parseLength('3 1/2', 'in'), 3.5);
  near(parseLength('3 1/2', 'dec'), 3.5);
  near(parseLength('2.25', 'dec'), 2.25);
  assert.equal(formatLength(63.5, 'fif', { fraction: 16 }), '5\' 3 1/2"');
  assert.equal(formatLength(63.5, 'in', { fraction: 16 }), '63 1/2"');
  assert.equal(formatLength(0.03, 'in', { fraction: 16 }), '0"');
  assert.equal(formatLength(11.99, 'fif', { fraction: 16 }), '1\' 0"');
  assert.equal(formatLength(2.5, 'dec', { decimals: 4 }), '2.5');
  assert.ok(isNaN(parseLength('abc', 'dec')));
});

test('shear wave, every pair', async () => {
  const { solveShearWave } = await import('../js/solvers.js');
  const angle = 60 * D, t = 1;
  const full = { t, angle, hs: t * Math.tan(angle), fs: 2 * t * Math.tan(angle), hv: t / Math.cos(angle), fv: 2 * t / Math.cos(angle) };
  const errors = [];
  roundTrip(solveShearWave, full, Object.keys(full), 2, e => errors.push(e.combo.join(',')));
  assert.deepEqual(errors.sort(), ['hs,fs', 'hv,fv'].sort());
  near(solveShearWave({ t: 1, angle: 45 * D }).values.fs, 2);
  near(solveShearWave({ t: 1, angle: 60 * D }).values.hv, 2);
});

test('reflector location by leg', async () => {
  const { solveReflector } = await import('../js/solvers.js');
  const main = { t: 1, angle: 60 * D };
  // Sound path 1.5 at 60 deg: unfolded depth 0.75, first leg.
  let r = solveReflector(main, { sp: 1.5 });
  near(r.values.depth, 0.75); assert.equal(r.values.leg, 1); near(r.values.sd, 1.5 * Math.sin(60 * D));
  // Sound path 3 at 60 deg: unfolded depth 1.5, second leg, depth 0.5 from top.
  r = solveReflector(main, { sp: 3 });
  near(r.values.depth, 0.5); assert.equal(r.values.leg, 2);
  // Third leg.
  r = solveReflector(main, { sp: 5 });
  near(r.values.depth, 0.5); assert.equal(r.values.leg, 3);
  // Back from depth + leg, and from surface distance.
  r = solveReflector(main, { depth: 0.5, leg: 2 });
  near(r.values.sp, 3);
  r = solveReflector(main, { sd: 3 * Math.sin(60 * D) });
  near(r.values.sp, 3);
  // Exactly at the bottom is the end of leg 1.
  r = solveReflector(main, { sp: 2 });
  near(r.values.depth, 1); assert.equal(r.values.leg, 1);
  assert.equal(solveReflector(main, {}), null);
  assert.ok(solveReflector(main, { sp: 1, sd: 1 }).error);
  assert.ok(solveReflector(main, { sp: 1, leg: 2 }).error);
  assert.ok(solveReflector(main, { depth: 2 }).error);
});

test('angle display forms parse back', () => {
  near(parseAngle('100%', 'grade'), 45 * D);
  near(parseAngle('6/12', 'over12'), Math.atan(0.5));
  near(parseAngle(formatAngle(60 * D, 'deg', 4), 'deg'), 60 * D);
});

test('pipe / vessel, every pair', async () => {
  const { solvePipe } = await import('../js/solvers.js');
  const ro = 5.375, ri = 5.375 - 0.5; // 10.75" OD, 0.5" wall
  const P = Math.PI;
  const full = {
    od: 2 * ro, id: 2 * ri, ro, ri, t: ro - ri,
    co: 2 * P * ro, ci: 2 * P * ri, ao: P * ro * ro, ai: P * ri * ri, am: P * (ro * ro - ri * ri),
  };
  const errors = [];
  roundTrip(solvePipe, full, Object.keys(full), 2, e => errors.push(e.combo.join(',')));
  // Only two values from the same side (both outside or both inside) may fail.
  const outside = ['od', 'ro', 'co', 'ao'], inside = ['id', 'ri', 'ci', 'ai'];
  for (const e of errors) {
    const [a, b] = e.split(',');
    assert.ok((outside.includes(a) && outside.includes(b)) || (inside.includes(a) && inside.includes(b)), `unexpected failure ${e}`);
  }
  assert.equal(errors.length, 12);
  assert.ok(solvePipe({ od: 10, t: 6 }).error);
  assert.ok(solvePipe({ od: 10, id: 12 }).error);
});
