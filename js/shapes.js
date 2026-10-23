// Shape definitions: fields, solve rules and the little diagrams for each row.
import {
  solveRight, solveOblique, solveCircle, solveSegment,
  solveIsoTrapezoid, solveRightTrapezoid, solveTrapezoid,
  solveShearWave, solveReflector,
} from './solvers.js';

const GRAY = 'var(--line)';
const HL = 'var(--accent)';

// ---------- SVG helpers ----------

const line = (id, [x1, y1], [x2, y2]) => ({ id, svg: c => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}"/>` });
const poly = (id, pts, fillWhenHl = false) => ({
  id,
  svg: (c, on) => `<polygon points="${pts.map(p => p.join(',')).join(' ')}" stroke="${c}" fill="${on && fillWhenHl ? HL : 'none'}"/>`,
});

// Arc at vertex `v` between the rays toward points p and q.
function arc(id, v, p, q, r = 7) {
  return {
    id,
    svg: c => {
      const a1 = Math.atan2(p[1] - v[1], p[0] - v[0]);
      let a2 = Math.atan2(q[1] - v[1], q[0] - v[0]);
      let d = a2 - a1;
      while (d <= -Math.PI) d += 2 * Math.PI;
      while (d > Math.PI) d -= 2 * Math.PI;
      const s = [v[0] + r * Math.cos(a1), v[1] + r * Math.sin(a1)];
      const e = [v[0] + r * Math.cos(a1 + d), v[1] + r * Math.sin(a1 + d)];
      return `<path d="M${s[0].toFixed(2)},${s[1].toFixed(2)} A${r},${r} 0 0 ${d > 0 ? 1 : 0} ${e[0].toFixed(2)},${e[1].toFixed(2)}" fill="none" stroke="${c}"/>`;
    },
  };
}

// Right-angle box at vertex v, with legs toward p and q.
function box(v, p, q, s = 5) {
  const u = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  const a = u(v, p), b = u(v, q);
  const p1 = [v[0] + a[0] * s, v[1] + a[1] * s];
  const p2 = [p1[0] + b[0] * s, p1[1] + b[1] * s];
  const p3 = [v[0] + b[0] * s, v[1] + b[1] * s];
  return { id: null, svg: c => `<polyline points="${[p1, p2, p3].map(p => p.join(',')).join(' ')}" fill="none" stroke="${c}"/>` };
}

function render(parts, hl, viewBox = '0 0 100 50') {
  const body = parts.map(p => {
    const on = p.id && (Array.isArray(p.id) ? p.id.includes(hl) : p.id === hl);
    return p.svg(on ? HL : GRAY, on);
  });
  // Highlighted parts are drawn last so they sit on top.
  const order = parts.map((p, i) => [p.id && (Array.isArray(p.id) ? p.id.includes(hl) : p.id === hl), body[i]]);
  return `<svg viewBox="${viewBox}" class="diagram" aria-hidden="true">${order.filter(o => !o[0]).map(o => o[1]).join('')}${order.filter(o => o[0]).map(o => o[1]).join('')}</svg>`;
}

// ---------- diagrams ----------

function rightTriangleDiagram(hl) {
  const A = [3, 47], R = [97, 47], T = [97, 3];
  return render([
    poly(['area'], [A, R, T], true),
    line(['hyp', 'perimeter'], A, T),
    line(['opp', 'perimeter'], R, T),
    line(['adj', 'perimeter'], A, R),
    box(R, A, T),
    arc('A', A, R, T, 12),
    arc('C', T, A, R, 9),
  ], hl);
}

function obliqueDiagram(hl) {
  const A = [3, 47], B = [97, 47], C = [78, 3];
  return render([
    poly(['area'], [A, B, C], true),
    line(['AB', 'perimeter'], A, B),
    line(['AC', 'perimeter'], A, C),
    line(['BC', 'perimeter'], B, C),
    arc('A', A, B, C, 10),
    arc('B', B, A, C, 10),
    arc('C', C, A, B, 9),
  ], hl);
}

function circleDiagram(hl) {
  return render([
    { id: ['circ', 'area'], svg: (c, on) => `<circle cx="50" cy="25" r="22" stroke="${c}" fill="${on && hl === 'area' ? HL : 'none'}"/>` },
    line('d', [28, 25], [72, 25]),
    line(['r', 'd'], [50, 25], [72, 25]),
  ], hl);
}

function segmentDiagram(hl) {
  const O = [50, 46], R = 40, half = 62 * Math.PI / 180;
  const P1 = [O[0] - R * Math.sin(half), O[1] - R * Math.cos(half)];
  const P2 = [O[0] + R * Math.sin(half), O[1] - R * Math.cos(half)];
  const top = [50, O[1] - R];
  const f = p => p.map(n => n.toFixed(2)).join(',');
  return render([
    { id: null, svg: c => `<path d="M${f(P1)} A${R},${R} 0 0 0 ${f([10, 52])} M${f(P2)} A${R},${R} 0 0 1 ${f([90, 52])}" fill="none" stroke="${c}"/>` },
    { id: 'area', svg: (c, on) => `<path d="M${f(P1)} A${R},${R} 0 0 1 ${f(P2)} Z" stroke="${on ? GRAY : 'none'}" fill="${on ? HL : 'none'}"/>` },
    { id: 'arc', svg: c => `<path d="M${f(P1)} A${R},${R} 0 0 1 ${f(P2)}" fill="none" stroke="${c}"/>` },
    line('chord', P1, P2),
    line('h', [50, P1[1]], top),
    line('r', O, P1),
    line('r', O, P2),
    arc('angle', O, P1, P2, 8),
  ], hl, '0 0 100 50');
}

function trapezoidDiagram(BL, BR, TR, TL, hx, opts = {}) {
  return hl => {
    const parts = [
      poly(['area'], [BL, BR, TR, TL], true),
      line(['B', 'perimeter'], BL, BR),
      line(['b', 'perimeter'], TL, TR),
      line([opts.left || 'L1', 'perimeter'], BL, TL),
      line([opts.right || 'L2', 'perimeter'], BR, TR),
      opts.leftIsHeight ? { id: null, svg: () => '' } : line('h', [hx, TL[1]], [hx, BL[1]]),
      arc(opts.a2 || 'a2', BR, BL, TR, 7),
      arc(opts.t2 || 't2', TR, TL, BR, 7),
    ];
    if (opts.leftIsHeight) {
      parts.push(box(BL, BR, TL), box(TL, TR, BL));
    } else {
      parts.push(arc(opts.a1 || 'a1', BL, BR, TL, 7), arc(opts.t1 || 't1', TL, TR, BL, 7));
    }
    return render(parts, hl);
  };
}

// Angle beam in a plate: probe on top, beam bouncing off the back wall.
// Drawn at the solved refracted angle when there is one, with the reflector at its
// solved position (second leg until one is located). The plate gets thinner at high
// angles or late legs so the beam still fits, keeping the angle itself true.
function shearWaveDiagram(hl, values = {}) {
  const deg = isFinite(values.angle) ? values.angle * 180 / Math.PI : 51.3;
  const tan = Math.tan(Math.min(80, Math.max(20, deg)) * Math.PI / 180);
  // Reflector depth "unfolded" through the back-wall bounces, in plate thicknesses.
  const located = values.t > 0 && values.sp > 0 && isFinite(values.angle);
  const unfolded = located ? Math.min(6, values.sp * Math.cos(values.angle) / values.t) : 1.45;
  const legs = Math.max(2, Math.ceil(unfolded - 1e-9));
  const flawLeg = Math.max(1, Math.ceil(unfolded - 1e-9));

  const top = 10;
  const t = Math.min(34, 85 / (legs * tan));
  const bot = top + t;
  const P = Array.from({ length: legs + 1 }, (_, k) => [8 + k * t * tan, k % 2 ? bot : top]);
  const I = P[0];
  const along = unfolded - (flawLeg - 1);
  const [p, q] = [P[flawLeg - 1], P[flawLeg]];
  const flaw = [p[0] + along * (q[0] - p[0]), p[1] + along * (q[1] - p[1])];
  const r = Math.min(8, t - 1);
  const dashed = c => `stroke="${c}" stroke-dasharray="2 2"`;
  const surface = (id, x) => ({ id, svg: c => `<line x1="${I[0]}" y1="${top - 1.5}" x2="${x}" y2="${top - 1.5}" stroke="${c}" stroke-width="2.4"/>` });

  const beam = P.slice(1).map((pt, k) => {
    const ids = [];
    if (k === 0) ids.push('hv');
    if (k < 2) ids.push('fv');
    if (k === flawLeg - 1) ids.push('leg');
    return line(ids, P[k], pt);
  });
  const soundPath = [...P.slice(0, flawLeg), flaw];
  return render([
    { id: null, svg: c => `<polygon points="1,${top} 15,${top} 13,3 3,3" stroke="${c}"/>` },
    line(null, [0, top], [100, top]),
    line(null, [0, bot], [100, bot]),
    { id: null, svg: c => `<line x1="${I[0]}" y1="${top}" x2="${I[0]}" y2="${top + Math.min(14, t)}" ${dashed(c)}/>` },
    ...beam,
    { id: 'sp', svg: c => `<polyline points="${soundPath.map(pt => pt.join(',')).join(' ')}" stroke="${c}"/>` },
    line(['t'], [97, top], [97, bot]),
    surface('hs', P[1][0]),
    surface('fs', P[2][0]),
    surface('sd', flaw[0]),
    { id: 'depth', svg: c => `<line x1="${flaw[0]}" y1="${top}" x2="${flaw[0]}" y2="${flaw[1]}" ${dashed(c)}/>` },
    { id: ['sp', 'sd', 'depth', 'leg'], svg: c => `<circle cx="${flaw[0]}" cy="${flaw[1]}" r="2" fill="${c}" stroke="none"/>` },
    arc('angle', I, [I[0], bot], P[1], r),
  ], hl);
}

// ---------- definitions ----------

export const SHAPES = {
  shearWave: {
    title: 'Shear Wave',
    group: 'UT Shear Wave',
    menu: 'Skip, Sound Path & Reflector Location',
    hint: 'Enter 2 Fields to Solve',
    required: 2,
    fields: [
      { key: 't', label: 'Thickness', kind: 'len' },
      { key: 'angle', label: 'Refracted Angle', kind: 'ang', presets: [45, 60, 70] },
      { key: 'hs', label: 'Half Skip', kind: 'len' },
      { key: 'fs', label: 'Full Skip', kind: 'len' },
      { key: 'hv', label: 'Half V Path', kind: 'len' },
      { key: 'fv', label: 'Full V Path', kind: 'len' },
    ],
    outputs: [],
    // Solved once the plate and angle are known.
    sections: [{
      title: 'Reflector',
      hint: 'Enter Sound Path, Surface Distance, or Depth (and Leg)',
      fields: [
        { key: 'sp', label: 'Sound Path to Reflector', kind: 'len' },
        { key: 'sd', label: 'Surface Distance to Reflector', kind: 'len' },
        { key: 'depth', label: 'Depth to Reflector', kind: 'len' },
        { key: 'leg', label: 'Leg', kind: 'count' },
      ],
      solve: solveReflector,
    }],
    diagram: shearWaveDiagram,
    liveDiagram: true, // redrawn from the solved values
    solve: solveShearWave,
  },
  right: {
    title: 'Right Triangle',
    group: 'Triangles',
    menu: 'Right Angle',
    hint: 'Enter 2 Fields to Solve',
    required: 2,
    fields: [
      { key: 'hyp', label: 'Slope/Hypotenuse', kind: 'len' },
      { key: 'opp', label: 'Rise/Opposite', kind: 'len' },
      { key: 'adj', label: 'Base/Adjacent', kind: 'len' },
      { key: 'A', label: 'Angle A', kind: 'ang' },
      { key: 'C', label: 'Angle C', kind: 'ang' },
    ],
    outputs: ['area', 'perimeter'],
    diagram: rightTriangleDiagram,
    solve: solveRight,
  },
  oblique: {
    title: 'Oblique Triangle',
    group: 'Triangles',
    menu: 'Oblique Angle',
    hint: 'Enter 3 Fields, with at Least 1 Side, to Solve',
    required: 3,
    fields: [
      { key: 'AB', label: 'AB', kind: 'len' },
      { key: 'AC', label: 'AC', kind: 'len' },
      { key: 'BC', label: 'BC', kind: 'len' },
      { key: 'A', label: 'Angle A', kind: 'ang' },
      { key: 'B', label: 'Angle B', kind: 'ang' },
      { key: 'C', label: 'Angle C', kind: 'ang' },
    ],
    outputs: ['area', 'perimeter'],
    diagram: obliqueDiagram,
    solve: solveOblique,
  },
  circle: {
    title: 'Circle',
    group: 'Circles',
    hint: 'Enter 1 Field to Solve',
    required: 1,
    fields: [
      { key: 'r', label: 'Radius', kind: 'len' },
      { key: 'd', label: 'Diameter', kind: 'len' },
      { key: 'circ', label: 'Circumference', kind: 'len' },
      { key: 'area', label: 'Area', kind: 'area' },
    ],
    outputs: [],
    diagram: circleDiagram,
    solve: solveCircle,
  },
  segment: {
    title: 'Segment',
    group: 'Circles',
    hint: 'Enter 2 Fields to Solve',
    required: 2,
    fields: [
      { key: 'r', label: 'Radius', kind: 'len' },
      { key: 'arc', label: 'Arc Length', kind: 'len' },
      { key: 'chord', label: 'Chord', kind: 'len' },
      { key: 'h', label: 'Height', kind: 'len' },
      { key: 'angle', label: 'Angle', kind: 'ang' },
    ],
    outputs: ['area'],
    outputRows: true,
    diagram: segmentDiagram,
    solve: solveSegment,
  },
  isoTrap: {
    title: 'Isosceles Trapezoid',
    group: 'Trapezoids',
    hint: 'Enter 3 Fields to Solve',
    required: 3,
    fields: [
      { key: 'B', label: 'Long Base', kind: 'len' },
      { key: 'b', label: 'Short Base', kind: 'len' },
      { key: 'L', label: 'Leg', kind: 'len' },
      { key: 'h', label: 'Height', kind: 'len' },
      { key: 'a', label: 'Base Angle', kind: 'ang' },
      { key: 't', label: 'Top Angle', kind: 'ang' },
    ],
    outputs: ['perimeter', 'area'],
    diagram: trapezoidDiagram([3, 47], [97, 47], [75, 5], [25, 5], 50, { left: 'L', right: 'L', a1: 'a', a2: 'a', t1: 't', t2: 't' }),
    solve: solveIsoTrapezoid,
  },
  rightTrap: {
    title: 'Right Trapezoid',
    group: 'Trapezoids',
    hint: 'Enter 3 Fields to Solve',
    required: 3,
    fields: [
      { key: 'B', label: 'Long Base', kind: 'len' },
      { key: 'b', label: 'Short Base', kind: 'len' },
      { key: 'L', label: 'Slant Leg', kind: 'len' },
      { key: 'h', label: 'Height', kind: 'len' },
      { key: 'a', label: 'Slant Angle', kind: 'ang' },
      { key: 't', label: 'Top Slant Angle', kind: 'ang' },
    ],
    outputs: ['perimeter', 'area'],
    diagram: trapezoidDiagram([3, 47], [97, 47], [65, 5], [3, 5], 3, { left: 'h', right: 'L', a2: 'a', t2: 't', leftIsHeight: true }),
    solve: solveRightTrapezoid,
  },
  trap: {
    title: 'Trapezoid',
    group: 'Trapezoids',
    hint: 'Enter 4 Fields, with at Least 1 Base. Legs Lean In',
    required: 4,
    fields: [
      { key: 'B', label: 'Long Base', kind: 'len' },
      { key: 'b', label: 'Short Base', kind: 'len' },
      { key: 'L1', label: 'Left Leg', kind: 'len' },
      { key: 'L2', label: 'Right Leg', kind: 'len' },
      { key: 'h', label: 'Height', kind: 'len' },
      { key: 'a1', label: 'Bottom-Left Angle', kind: 'ang' },
      { key: 'a2', label: 'Bottom-Right Angle', kind: 'ang' },
      { key: 't1', label: 'Top-Left Angle', kind: 'ang' },
      { key: 't2', label: 'Top-Right Angle', kind: 'ang' },
    ],
    outputs: ['perimeter', 'area'],
    diagram: trapezoidDiagram([3, 47], [97, 47], [65, 5], [13, 5], 40),
    solve: solveTrapezoid,
  },
};
