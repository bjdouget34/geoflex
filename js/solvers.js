// Pure geometry solvers. Inputs are maps of known values (lengths in any
// consistent unit, angles in radians). Each solver returns
//   { values, area, perimeter, alt? }  or  { error }
// where `values` holds every field of the shape and `alt` is a second valid
// solution when the inputs are ambiguous.

const PI = Math.PI;
const HALF_PI = PI / 2;
const EPS = 1e-9;

const has = v => v !== undefined && v !== null && isFinite(v);
const fail = error => ({ error });
const close = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

// All roots of f on [lo, hi], found by sampling for sign changes then bisecting.
export function findRoots(f, lo, hi, samples = 4000) {
  const roots = [];
  let x0 = lo;
  let f0 = f(x0);
  for (let i = 1; i <= samples; i++) {
    const x1 = lo + ((hi - lo) * i) / samples;
    const f1 = f(x1);
    if (isFinite(f0) && isFinite(f1)) {
      if (f0 === 0) roots.push(x0);
      else if (f0 * f1 < 0) {
        let a = x0, b = x1, fa = f0;
        for (let k = 0; k < 200; k++) {
          const m = (a + b) / 2;
          const fm = f(m);
          if (fa * fm <= 0) b = m; else { a = m; fa = fm; }
        }
        roots.push((a + b) / 2);
      }
    }
    x0 = x1;
    f0 = f1;
  }
  if (isFinite(f0) && f0 === 0) roots.push(x0);
  return roots;
}

function positive(values, keys) {
  return keys.every(k => has(values[k]) && values[k] > EPS);
}

// ---------- right triangle ----------
// hyp, opp (rise), adj (base), A (angle between base and hypotenuse), C (top angle)

export function solveRight(k) {
  let { hyp, opp, adj, A, C } = k;
  const sides = [hyp, opp, adj].filter(has).length;
  if (!sides) return fail('Enter at least one side.');
  for (const ang of [A, C]) {
    if (has(ang) && (ang <= EPS || ang >= HALF_PI - EPS)) return fail('Angles must be between 0° and 90°.');
  }
  if (has(A) && has(C)) return fail('The two angles always add to 90°. Enter a side instead of one of them.');
  if (has(C)) A = HALF_PI - C;

  if (has(A)) {
    if (has(hyp)) { opp = hyp * Math.sin(A); adj = hyp * Math.cos(A); }
    else if (has(opp)) { hyp = opp / Math.sin(A); adj = opp / Math.tan(A); }
    else { hyp = adj / Math.cos(A); opp = adj * Math.tan(A); }
  } else if (has(hyp) && has(opp)) {
    if (opp >= hyp) return fail('The hypotenuse must be the longest side.');
    adj = Math.sqrt(hyp * hyp - opp * opp);
  } else if (has(hyp) && has(adj)) {
    if (adj >= hyp) return fail('The hypotenuse must be the longest side.');
    opp = Math.sqrt(hyp * hyp - adj * adj);
  } else {
    hyp = Math.hypot(opp, adj);
  }
  A = Math.atan2(opp, adj);
  C = HALF_PI - A;
  const values = { hyp, opp, adj, A, C };
  if (!positive(values, ['hyp', 'opp', 'adj'])) return fail('Sides must be greater than zero.');
  return { values, area: (opp * adj) / 2, perimeter: hyp + opp + adj };
}

// ---------- oblique triangle ----------
// Sides: AB (c), AC (b), BC (a). Angles A, B, C, each opposite its lowercase side.

function triangleResult(s, ang) {
  const [a, b, c] = s;
  const [A, B, C] = ang;
  const values = { BC: a, AC: b, AB: c, A, B, C };
  if (!positive(values, ['AB', 'AC', 'BC', 'A', 'B', 'C'])) return null;
  return { values, area: 0.5 * a * b * Math.sin(C), perimeter: a + b + c };
}

export function solveOblique(k) {
  const s = [k.BC, k.AC, k.AB];
  const ang = [k.A, k.B, k.C];
  const sk = s.map(has);
  const ak = ang.map(has);
  const nS = sk.filter(Boolean).length;
  const nA = ak.filter(Boolean).length;
  if (!nS) return fail('Enter at least one side.');
  if (ang.some((x, i) => ak[i] && (x <= EPS || x >= PI - EPS))) return fail('Angles must be between 0° and 180°.');
  if (ang.filter(has).reduce((t, x) => t + x, 0) >= PI - EPS) return fail('The angles add up to 180° or more.');

  // Two angles: the third is fixed, then law of sines.
  if (nA >= 2) {
    const i = ak.indexOf(false);
    if (i >= 0) ang[i] = PI - ang[(i + 1) % 3] - ang[(i + 2) % 3];
    const j = sk.indexOf(true);
    const ratio = s[j] / Math.sin(ang[j]);
    for (let m = 0; m < 3; m++) if (!sk[m]) s[m] = ratio * Math.sin(ang[m]);
    return triangleResult(s, ang) || fail('No triangle fits these values.');
  }

  if (nS === 3) {
    const [a, b, c] = s;
    if (a + b <= c || a + c <= b || b + c <= a) return fail('Each side must be shorter than the other two added together.');
    ang[0] = Math.acos((b * b + c * c - a * a) / (2 * b * c));
    ang[1] = Math.acos((a * a + c * c - b * b) / (2 * a * c));
    ang[2] = PI - ang[0] - ang[1];
    return triangleResult(s, ang) || fail('No triangle fits these values.');
  }

  // Two sides and one angle.
  const ai = ak.indexOf(true);
  if (!sk[ai]) {
    // Included angle: law of cosines for the opposite side, then the rest.
    const [j, m] = [(ai + 1) % 3, (ai + 2) % 3];
    s[ai] = Math.sqrt(s[j] ** 2 + s[m] ** 2 - 2 * s[j] * s[m] * Math.cos(ang[ai]));
    ang[j] = Math.acos(Math.min(1, Math.max(-1, (s[ai] ** 2 + s[m] ** 2 - s[j] ** 2) / (2 * s[ai] * s[m]))));
    ang[m] = PI - ang[ai] - ang[j];
    return triangleResult(s, ang) || fail('No triangle fits these values.');
  }

  // Side-side-angle: may have zero, one, or two solutions.
  const j = sk.findIndex((known, idx) => known && idx !== ai);
  const m = 3 - ai - j;
  const sinJ = (s[j] * Math.sin(ang[ai])) / s[ai];
  if (sinJ > 1 + EPS) return fail('No triangle fits these values. The side opposite the angle is too short.');
  const base = Math.asin(Math.min(1, sinJ));
  const solutions = [];
  for (const angJ of base > HALF_PI - 1e-7 ? [base] : [base, PI - base]) {
    if (ang[ai] + angJ >= PI - EPS) continue;
    const S = [...s];
    const G = [...ang];
    G[j] = angJ;
    G[m] = PI - ang[ai] - angJ;
    S[m] = (s[ai] / Math.sin(ang[ai])) * Math.sin(G[m]);
    const r = triangleResult(S, G);
    if (r) solutions.push(r);
  }
  if (!solutions.length) return fail('No triangle fits these values.');
  return solutions.length > 1 ? { ...solutions[0], alt: solutions[1] } : solutions[0];
}

// ---------- circle ----------

export function solveCircle(k) {
  let r;
  if (has(k.r)) r = k.r;
  else if (has(k.d)) r = k.d / 2;
  else if (has(k.circ)) r = k.circ / (2 * PI);
  else if (has(k.area)) r = Math.sqrt(k.area / PI);
  if (!(r > EPS)) return fail('Value must be greater than zero.');
  return { values: { r, d: 2 * r, circ: 2 * PI * r, area: PI * r * r } };
}

// ---------- circular segment ----------
// r radius, arc length, chord, h height (sagitta), angle (central angle)

function segmentFrom(r, theta) {
  const values = {
    r,
    arc: r * theta,
    chord: 2 * r * Math.sin(theta / 2),
    h: r * (1 - Math.cos(theta / 2)),
    angle: theta,
  };
  return { values, area: (r * r * (theta - Math.sin(theta))) / 2 };
}

export function solveSegment(k) {
  const { r, arc, chord, h, angle } = k;
  for (const key of ['r', 'arc', 'chord', 'h', 'angle']) {
    if (has(k[key]) && k[key] <= EPS) return fail('Values must be greater than zero.');
  }
  if (has(angle) && angle >= 2 * PI) return fail('The angle must be less than 360°.');

  // Each case yields one or more [r, theta] pairs.
  let pairs;
  if (has(r) && has(angle)) pairs = [[r, angle]];
  else if (has(r) && has(arc)) pairs = arc < 2 * PI * r ? [[r, arc / r]] : [];
  else if (has(r) && has(chord)) {
    if (chord > 2 * r + EPS) return fail('The chord cannot be longer than the diameter.');
    const t = 2 * Math.asin(Math.min(1, chord / (2 * r)));
    pairs = close(t, PI) ? [[r, PI]] : [[r, t], [r, 2 * PI - t]];
  } else if (has(r) && has(h)) {
    if (h >= 2 * r) return fail('The height must be less than the diameter.');
    pairs = [[r, 2 * Math.acos((r - h) / r)]];
  } else if (has(angle) && has(arc)) pairs = [[arc / angle, angle]];
  else if (has(angle) && has(chord)) pairs = [[chord / (2 * Math.sin(angle / 2)), angle]];
  else if (has(angle) && has(h)) pairs = [[h / (1 - Math.cos(angle / 2)), angle]];
  else if (has(chord) && has(h)) {
    const t = 4 * Math.atan((2 * h) / chord);
    pairs = [[chord / (2 * Math.sin(t / 2)), t]];
  } else if (has(arc) && has(chord)) {
    if (chord >= arc) return fail('The chord must be shorter than the arc.');
    const ratio = chord / arc;
    pairs = findRoots(t => Math.sin(t / 2) / (t / 2) - ratio, 1e-9, 2 * PI - 1e-9).map(t => [arc / t, t]);
  } else if (has(arc) && has(h)) {
    const ratio = h / arc;
    pairs = findRoots(t => (1 - Math.cos(t / 2)) / t - ratio, 1e-9, 2 * PI - 1e-9).map(t => [arc / t, t]);
  } else return fail('Enter two values.');

  const sols = pairs
    .filter(([rr, t]) => rr > EPS && t > EPS && t < 2 * PI)
    .map(([rr, t]) => segmentFrom(rr, t));
  if (!sols.length) return fail('No segment fits these values.');
  return sols.length > 1 ? { ...sols[0], alt: sols[1] } : sols[0];
}

// ---------- trapezoids ----------
// One engine for all three kinds. Variables:
//   B long base, b short base, h height,
//   side 1 (left) L1 leg, a1 bottom angle, x1 horizontal run; side 2 (right) likewise,
//   X = x1 + x2 = B - b.
// mode 'iso' ties the sides together; mode 'right' makes side 1 vertical.

export function solveTrapezoidCore(known, mode) {
  const v = {};
  for (const [key, val] of Object.entries(known)) if (has(val)) v[key] = val;
  for (const key of ['a1', 'a2']) {
    if (has(v[key]) && (v[key] <= EPS || v[key] > HALF_PI + EPS)) {
      return fail('Bottom angles must be greater than 0° and at most 90° (legs lean in).');
    }
  }
  for (const key of ['B', 'b', 'h', 'L1', 'L2']) {
    if (has(v[key]) && v[key] <= EPS) return fail('Lengths must be greater than zero.');
  }

  let changed;
  const set = (key, val) => {
    if (!has(v[key]) && isFinite(val)) { v[key] = val; changed = true; }
  };
  const side = i => {
    const L = v['L' + i], a = v['a' + i], x = v['x' + i], h = v.h;
    if (has(L) && has(a)) { set('h', L * Math.sin(a)); set('x' + i, L * Math.cos(a)); }
    else if (has(a) && has(h)) { set('L' + i, h / Math.sin(a)); set('x' + i, h / Math.tan(a)); }
    else if (has(a) && has(x) && a < HALF_PI - EPS) { set('h', x * Math.tan(a)); set('L' + i, x / Math.cos(a)); }
    else if (has(L) && has(h) && L >= h - EPS) { const xx = Math.sqrt(Math.max(0, L * L - h * h)); set('x' + i, xx); set('a' + i, Math.atan2(h, xx)); }
    else if (has(L) && has(x) && L >= x) { const hh = Math.sqrt(L * L - x * x); set('h', hh); set('a' + i, Math.atan2(hh, x)); }
    else if (has(h) && has(x)) { set('L' + i, Math.hypot(h, x)); set('a' + i, Math.atan2(h, x)); }
  };
  const propagate = () => {
    for (let pass = 0; pass < 30; pass++) {
      changed = false;
      if (mode === 'right') {
        set('x1', 0); set('a1', HALF_PI);
        if (has(v.h)) set('L1', v.h);
        if (has(v.L1)) set('h', v.L1);
      }
      if (mode === 'iso') {
        for (const [p, q] of [['L1', 'L2'], ['a1', 'a2'], ['x1', 'x2']]) {
          if (has(v[p])) set(q, v[p]);
          if (has(v[q])) set(p, v[q]);
        }
        if (has(v.X)) set('x1', v.X / 2);
      }
      side(1);
      side(2);
      if (has(v.B) && has(v.b)) set('X', v.B - v.b);
      if (has(v.x1) && has(v.x2)) set('X', v.x1 + v.x2);
      if (has(v.X)) {
        if (has(v.B)) set('b', v.B - v.X);
        if (has(v.b)) set('B', v.b + v.X);
        if (has(v.x1)) set('x2', v.X - v.x1);
        if (has(v.x2)) set('x1', v.X - v.x2);
      }
      if (!changed) break;
    }
  };

  propagate();

  // Both bases known but neither side pins down the height: solve for h numerically.
  if (!has(v.h) && has(v.X)) {
    const runOf = i => {
      if (mode === 'right' && i === 1) return () => 0;
      const j = mode === 'iso' ? 1 : i;
      if (has(v['x' + j])) return () => v['x' + j];
      if (has(v['L' + j])) return h => Math.sqrt(v['L' + j] ** 2 - h * h);
      if (has(v['a' + j])) return h => h / Math.tan(v['a' + j]);
      return null;
    };
    const r1 = runOf(1), r2 = runOf(2);
    if (r1 && r2) {
      const legs = [v.L1, v.L2].filter(has);
      const hMax = legs.length ? Math.min(...legs) : Math.max(v.X, 1) * 1000;
      const roots = findRoots(h => r1(h) + r2(h) - v.X, hMax * 1e-9, hMax);
      if (roots.length) {
        v.h = roots[roots.length - 1];
        propagate();
      }
    }
  }

  const need = ['B', 'b', 'h', 'L1', 'L2', 'a1', 'a2', 'x1', 'x2'];
  if (!need.every(key => has(v[key]))) return fail('Not enough information. Try entering a different combination.');
  if (v.x1 < -1e-7 || v.x2 < -1e-7 || v.b <= EPS || v.B < v.b - 1e-7) {
    return fail('No trapezoid fits these values. The short base must be shorter than the long base and the legs must lean in.');
  }
  // Every given value must agree with the solved shape.
  const ok = [1, 2].every(i =>
    close(v['L' + i] ** 2, v.h ** 2 + v['x' + i] ** 2) &&
    close(v['a' + i], Math.atan2(v.h, v['x' + i]))) && close(v.B, v.b + v.x1 + v.x2);
  if (!ok) return fail('These values contradict each other.');

  return {
    values: v,
    area: ((v.B + v.b) / 2) * v.h,
    perimeter: v.B + v.b + v.L1 + v.L2,
  };
}

const topAngle = a => (has(a) ? PI - a : undefined);
const bottomFromTop = (bottom, top) => (has(bottom) ? bottom : has(top) ? PI - top : undefined);

function trapError(k, keys) {
  return keys.some(key => has(k[key]) && (k[key] <= EPS || k[key] >= PI)) ? fail('Angles must be between 0° and 180°.') : null;
}

export function solveIsoTrapezoid(k) {
  const bad = trapError(k, ['a', 't']);
  if (bad) return bad;
  if (has(k.a) && has(k.t)) return fail('Base and top angles always add to 180°. Enter a length instead of one of them.');
  const r = solveTrapezoidCore({ B: k.B, b: k.b, L1: k.L, h: k.h, a1: bottomFromTop(k.a, k.t) }, 'iso');
  if (r.error) return r;
  const v = r.values;
  return { values: { B: v.B, b: v.b, L: v.L1, h: v.h, a: v.a1, t: topAngle(v.a1) }, area: r.area, perimeter: r.perimeter };
}

export function solveRightTrapezoid(k) {
  const bad = trapError(k, ['a', 't']);
  if (bad) return bad;
  if (has(k.a) && has(k.t)) return fail('Slant and top slant angles always add to 180°. Enter a length instead of one of them.');
  const r = solveTrapezoidCore({ B: k.B, b: k.b, L2: k.L, h: k.h, a2: bottomFromTop(k.a, k.t) }, 'right');
  if (r.error) return r;
  const v = r.values;
  return { values: { B: v.B, b: v.b, L: v.L2, h: v.h, a: v.a2, t: topAngle(v.a2) }, area: r.area, perimeter: r.perimeter };
}

export function solveTrapezoid(k) {
  const bad = trapError(k, ['a1', 'a2', 't1', 't2']);
  if (bad) return bad;
  if (!has(k.B) && !has(k.b)) return fail('Enter at least one base.');
  if (has(k.a1) && has(k.t1)) return fail('Bottom-left and top-left angles always add to 180°.');
  if (has(k.a2) && has(k.t2)) return fail('Bottom-right and top-right angles always add to 180°.');
  const r = solveTrapezoidCore({
    B: k.B, b: k.b, L1: k.L1, L2: k.L2, h: k.h,
    a1: bottomFromTop(k.a1, k.t1), a2: bottomFromTop(k.a2, k.t2),
  }, 'general');
  if (r.error) return r;
  const v = r.values;
  return {
    values: { B: v.B, b: v.b, L1: v.L1, L2: v.L2, h: v.h, a1: v.a1, a2: v.a2, t1: topAngle(v.a1), t2: topAngle(v.a2) },
    area: r.area,
    perimeter: r.perimeter,
  };
}

// ---------- UT shear wave (angle beam) ----------
// t thickness, angle refracted angle from the normal,
// hs half skip / fs full skip (surface distances), hv half V path / fv full V path (sound paths).
// The first leg is a right triangle: thickness adjacent to the angle, half skip opposite, half V path the hypotenuse.

export function solveShearWave(k) {
  if (has(k.hs) && has(k.fs)) return fail('Full skip is always twice the half skip. Enter a different second field.');
  if (has(k.hv) && has(k.fv)) return fail('Full V path is always twice the half V path. Enter a different second field.');
  const hs = has(k.fs) ? k.fs / 2 : k.hs;
  const hv = has(k.fv) ? k.fv / 2 : k.hv;
  const r = solveRight({ adj: k.t, opp: hs, hyp: hv, A: k.angle });
  if (r.error) {
    return fail(r.error
      .replace('The hypotenuse must be the longest side.', 'The V path must be longer than the thickness and the half skip.')
      .replace('Enter at least one side.', 'Enter thickness, a skip or a V path.'));
  }
  const { adj: t, opp, hyp, A } = r.values;
  return { values: { t, angle: A, hs: opp, fs: 2 * opp, hv: hyp, fv: 2 * hyp } };
}

// Locate a reflector from one of sound path, surface distance or depth (depth may name its leg).
// Returns null when nothing is entered yet.
export function solveReflector(main, k) {
  const { t, angle } = main;
  const given = ['sp', 'sd', 'depth'].filter(key => has(k[key]));
  if (!given.length) return has(k.leg) ? fail('Enter a sound path, surface distance or depth.') : null;
  if (given.length > 1) return fail('Enter only one of sound path, surface distance or depth.');
  if (has(k.leg) && !has(k.depth)) return fail('Leg is only entered with depth. It is worked out from the sound path or surface distance.');
  for (const key of given) if (k[key] <= EPS) return fail('Values must be greater than zero.');

  // D is the "unfolded" depth: how far the beam has travelled down through mirrored plates.
  let D;
  if (has(k.sp)) D = k.sp * Math.cos(angle);
  else if (has(k.sd)) D = (k.sd / Math.tan(angle));
  else {
    if (k.depth > t + EPS) return fail('Depth cannot be more than the thickness.');
    const leg = has(k.leg) ? k.leg : 1;
    if (!(leg >= 1 && Number.isInteger(leg))) return fail('Leg must be a whole number: 1, 2, 3...');
    D = leg % 2 ? (leg - 1) * t + k.depth : leg * t - k.depth;
  }
  const leg = has(k.leg) ? k.leg : Math.max(1, Math.ceil(D / t - 1e-9));
  const depth = leg % 2 ? D - (leg - 1) * t : leg * t - D;
  const sp = D / Math.cos(angle);
  return { values: { sp, sd: sp * Math.sin(angle), depth: Math.max(0, depth), leg } };
}
