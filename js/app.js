import { SHAPES } from './shapes.js';
import {
  ANGLE_UNITS, LENGTH_FORMATS, FRACTIONS, DECIMALS,
  parseAngle, formatAngle, parseLength, formatLength, formatArea,
} from './units.js';

const STORE_KEY = 'geoflex.v1';
const app = document.getElementById('app');

// ---------- persisted state ----------

const state = load();

function load() {
  const fallback = { settings: { angle: 'deg', length: 'dec', fraction: 16, decimals: 3 }, inputs: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved) return { settings: { ...fallback.settings, ...saved.settings }, inputs: saved.inputs || {} };
  } catch { /* storage blocked or corrupt */ }
  return fallback;
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

// ---------- unit helpers ----------

function parseValue(kind, text) {
  const s = state.settings;
  if (kind === 'ang') return parseAngle(text, s.angle);
  if (kind === 'count') return /^\s*\d+\s*$/.test(text) ? Number(text) : NaN;
  if (kind === 'area') {
    if (!/^\s*(\d+(\.\d*)?|\.\d+)\s*$/.test(text)) return NaN;
    return Number(text) * (s.length === 'fif' ? 144 : 1);
  }
  return parseLength(text, s.length);
}

function formatValue(kind, v) {
  const s = state.settings;
  if (kind === 'ang') return formatAngle(v, s.angle, s.decimals);
  if (kind === 'count') return isFinite(v) ? String(Math.round(v)) : '';
  if (kind === 'area') return formatArea(v, s.length, s);
  return formatLength(v, s.length, s);
}

function inputMode(kind) {
  const s = state.settings;
  if (kind === 'ang') return s.angle === 'dms' ? 'text' : 'decimal';
  if (kind === 'area') return 'decimal';
  if (kind === 'count') return 'numeric';
  return s.length === 'dec' ? 'decimal' : 'text';
}

function placeholder(field) {
  const s = state.settings;
  if (field.kind === 'ang' && s.angle === 'dms') return `${field.label}  (d m s)`;
  if (field.kind === 'len' && s.length === 'fif') return `${field.label}  (ft in)`;
  if (field.kind === 'len' && s.length === 'in') return `${field.label}  (in)`;
  if (field.kind === 'area' && s.length === 'fif') return `${field.label}  (sq ft)`;
  return field.label;
}

function unitsSummary() {
  const s = state.settings;
  const ang = ANGLE_UNITS.find(u => u.id === s.angle).label;
  const len = s.length === 'dec' ? `Decimal (${s.decimals} places)` : `${LENGTH_FORMATS.find(u => u.id === s.length).label}, 1/${s.fraction}"`;
  return `${ang} · ${len}`;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- icons ----------

const ICON = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m4 13 5 5L20 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  clear: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function header(title, { back = true, actions = '' } = {}) {
  return `<header class="bar">
    ${back ? `<button class="round" data-act="back" aria-label="Back">${ICON.back}</button>` : '<span class="round-spacer"></span>'}
    <h1>${esc(title)}</h1>
    ${actions ? `<div class="pill">${actions}</div>` : '<span class="round-spacer"></span>'}
  </header>`;
}

// ---------- menu ----------

function renderMenu() {
  const groups = {};
  for (const [id, shape] of Object.entries(SHAPES)) (groups[shape.group] ||= []).push([id, shape]);
  const list = items => `<ul class="list">${items.map(([href, label]) =>
    `<li><a href="${href}">${esc(label)}<span class="chev">${ICON.chevron}</span></a></li>`).join('')}</ul>`;
  app.innerHTML = `${header('GeoFlex', { back: false })}
    <main class="scroll menu">
      ${Object.entries(groups).map(([g, items]) =>
        `<h2>${g}</h2>${list(items.map(([id, s]) => [`#/shape/${id}`, s.menu || s.title]))}`).join('')}
      <h2>Settings</h2>${list([['#/settings', 'Settings']])}
      <p class="foot">${esc(unitsSummary())}</p>
    </main>`;
}

// ---------- settings ----------

function renderSettings() {
  const s = state.settings;
  const group = (title, name, options, current) => `<h2>${title}</h2><ul class="list">${options.map(o =>
    `<li><button data-set="${name}" data-val="${o.id}">${esc(o.label)}${String(o.id) === String(current) ? `<span class="tick">${ICON.check}</span>` : ''}</button></li>`).join('')}</ul>`;
  app.innerHTML = `${header('Settings')}
    <main class="scroll menu">
      ${group('Select a unit for angles', 'angle', ANGLE_UNITS, s.angle)}
      ${group('Select a format for lengths', 'length', LENGTH_FORMATS, s.length)}
      ${s.length === 'dec'
        ? group('Decimal places', 'decimals', DECIMALS.map(d => ({ id: d, label: String(d) })), s.decimals)
        : group('Round fractions to', 'fraction', FRACTIONS.map(f => ({ id: f, label: `1/${f}"` })), s.fraction)}
      <p class="foot">Feet-inch entry: <b>5' 3 1/2"</b>, <b>5 3 1/2</b> or <b>5-3-1/2</b> all mean 5 feet 3&frac12; inches.
      DMS entry: <b>30 15 20</b> means 30&deg; 15' 20".</p>
    </main>`;
  app.querySelectorAll('[data-set]').forEach(btn => btn.addEventListener('click', () => {
    const key = btn.dataset.set;
    const val = btn.dataset.val;
    state.settings[key] = key === 'fraction' || key === 'decimals' ? Number(val) : val;
    save();
    renderSettings();
  }));
}

// ---------- shape calculator ----------

let current = null; // { id, shape, fields: {key: {text, value, src}}, result, alt }

// Main fields plus any follow-on sections (e.g. the UT reflector).
const sections = shape => shape.sections || [];
const allFields = shape => [...shape.fields, ...sections(shape).flatMap(sec => sec.fields)];
const fieldDef = key => allFields(current.shape).find(f => f.key === key);

function renderShape(id) {
  const shape = SHAPES[id];
  if (!shape) return renderMenu();
  const saved = state.inputs[id] || {};
  const fields = {};
  for (const f of allFields(shape)) {
    const v = saved[f.key];
    fields[f.key] = isFinite(v) && v !== null
      ? { text: formatValue(f.kind, v), value: v, src: 'input' }
      : { text: '', value: NaN, src: null };
  }
  current = { id, shape, fields, result: null, showAlt: false };

  const total = allFields(shape).length;
  let n = 0;
  const row = (f, diagram = shape.diagram) => `
    <div class="row"${shape.liveDiagram && diagram === shape.diagram ? ` data-live="${f.key}"` : ''}>
      ${f.abbr ? `<div class="diag">${diagram(f.key)}<span class="abbr">${esc(f.abbr)}</span></div>` : diagram(f.key)}
      <div class="cell">
        <input id="f-${f.key}" data-key="${f.key}" type="text" inputmode="${inputMode(f.kind)}"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          enterkeyhint="${++n === total ? 'done' : 'next'}"
          placeholder="${esc(placeholder(f))}" aria-label="${esc(f.label)}">
        ${f.presets ? `<div class="chips">${f.presets.map(deg =>
          `<button data-act="preset" data-key="${f.key}" data-deg="${deg}">${esc(formatValue(f.kind, deg * Math.PI / 180))}</button>`).join('')}</div>` : ''}
      </div>
    </div>`;
  const rows = shape.fields.map(f => row(f)).join('') + sections(shape).map((sec, i) =>
    `<div class="section">
       <div class="section-head"><h2>${esc(sec.title)}</h2>
         <button class="sec-clear" data-act="clear-section" data-section="${i}" aria-label="Clear ${esc(sec.title)} fields">${ICON.clear}Clear</button></div>
       <p>${esc(sec.hint)}</p></div>
     ${sec.fields.map(f => row(f, sec.diagram)).join('')}<div id="msg-s${i}" class="msg sub" role="status" aria-live="polite"></div>`).join('');

  const outputs = shape.outputRows
    ? shape.outputs.map(o => `<div class="row out-row">${shape.diagram(o)}<output id="o-${o}" data-label="${cap(o)}"></output></div>`).join('')
    : shape.outputs.length
      ? `<div class="tiles">${shape.outputs.map(o => `<div class="tile">${shape.diagram(o)}<output id="o-${o}" data-label="${cap(o)}"></output></div>`).join('')}</div>`
      : '';

  app.innerHTML = `${header(shape.title, {
    actions: `<button data-act="copy" aria-label="Copy results">${ICON.copy}</button><button data-act="clear" aria-label="Clear all fields">${ICON.clear}</button>`,
  })}
    <div class="hint">${esc(shape.hint)}</div>
    <main class="scroll calc">
      <div class="rows">${rows}${outputs}</div>
      <div id="msg" class="msg" role="status" aria-live="polite"></div>
      <a class="units" href="#/settings">${esc(unitsSummary())}</a>
    </main>`;

  app.querySelectorAll('input[data-key]').forEach((el, i, all) => {
    el.value = current.fields[el.dataset.key].text;
    el.addEventListener('focus', () => { if (current.fields[el.dataset.key].src === 'computed') el.select(); });
    el.addEventListener('input', () => onInput(el.dataset.key, el.value));
    el.addEventListener('blur', () => tidy(el.dataset.key));
    el.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const next = [...all].slice(i + 1).find(n => !n.value) || null;
      next ? next.focus() : el.blur();
    });
  });
  solve();
}

const cap = s => s[0].toUpperCase() + s.slice(1);

function onInput(key, text) {
  const f = current.fields[key];
  if (f.src === 'computed') {
    // Typing over an answer: treat it as a new input and drop the other answers.
    for (const other of Object.values(current.fields)) if (other.src === 'computed') { other.src = null; other.text = ''; other.value = NaN; }
  }
  const kind = fieldDef(key).kind;
  f.text = text;
  f.value = parseValue(kind, text);
  f.src = text.trim() ? 'input' : null;
  current.showAlt = false;
  solve();
}

// On leaving a field, show the entered value in the standard format.
function tidy(key) {
  const f = current.fields[key];
  if (f.src !== 'input' || !isFinite(f.value)) return;
  f.text = formatValue(fieldDef(key).kind, f.value);
  const el = document.getElementById(`f-${key}`);
  if (el && el.value !== f.text) el.value = f.text;
}

function solve() {
  const { shape, fields } = current;
  for (const f of Object.values(fields)) if (f.src === 'computed') { f.src = null; f.text = ''; f.value = NaN; }
  current.result = null;

  const inputs = shape.fields.filter(f => fields[f.key].src === 'input');
  const unreadable = inputs.filter(f => !isFinite(fields[f.key].value));
  let message = '';
  let isError = false;

  if (unreadable.length) {
    message = `Can't read ${unreadable.map(f => f.label).join(', ')}.`;
    isError = true;
  } else if (inputs.length < shape.required) {
    const left = shape.required - inputs.length;
    message = inputs.length ? `Enter ${left} more field${left > 1 ? 's' : ''}.` : '';
  } else if (inputs.length > shape.required) {
    message = `Too many fields. Enter exactly ${shape.required}; clear one to solve.`;
    isError = true;
  } else {
    const known = Object.fromEntries(inputs.map(f => [f.key, fields[f.key].value]));
    const r = shape.solve(known);
    if (r.error) {
      message = r.error;
      isError = true;
    } else {
      const sol = current.showAlt && r.alt ? r.alt : r;
      current.result = { ...sol, hasAlt: !!r.alt };
      for (const f of shape.fields) {
        if (fields[f.key].src === 'input') continue;
        fields[f.key] = { src: 'computed', value: sol.values[f.key], text: formatValue(f.kind, sol.values[f.key]) };
      }
    }
  }

  const sectionMsgs = solveSections();
  if (shape.liveDiagram) redrawDiagrams();

  // Paint fields without disturbing the one being typed in.
  for (const f of allFields(shape)) {
    const el = document.getElementById(`f-${f.key}`);
    const st = fields[f.key];
    el.classList.toggle('computed', st.src === 'computed');
    el.classList.toggle('bad', st.src === 'input' && !isFinite(st.value));
    if (document.activeElement !== el || st.src === 'computed') {
      if (el.value !== st.text) el.value = st.text;
    }
  }
  const res = current.result;
  for (const o of shape.outputs) {
    const el = document.getElementById(`o-${o}`);
    const v = res ? res[o] : NaN;
    el.textContent = isFinite(v) ? (o === 'area' ? formatValue('area', v) : formatValue('len', v)) : el.dataset.label;
    el.classList.toggle('has-value', isFinite(v));
  }

  const msg = document.getElementById('msg');
  if (res && res.hasAlt) {
    msg.className = 'msg info';
    msg.innerHTML = `Two shapes fit these values. Showing ${current.showAlt ? 2 : 1} of 2. <button data-act="alt">Show the other</button>`;
  } else {
    msg.className = `msg${isError ? ' error' : ''}`;
    msg.textContent = message;
  }
  sectionMsgs.forEach((m, i) => {
    const el = document.getElementById(`msg-s${i}`);
    el.className = `msg sub${m.isError ? ' error' : ''}`;
    el.textContent = m.message;
  });

  // Remember only what the user typed.
  state.inputs[current.id] = Object.fromEntries(
    Object.entries(fields).filter(([, f]) => f.src === 'input' && isFinite(f.value)).map(([k, f]) => [k, f.value]));
  save();
}

// Redraw diagrams that follow the solved shape (only when the values they use change).
function redrawDiagrams() {
  const values = Object.fromEntries(Object.entries(current.fields).map(([k, f]) => [k, f.value]));
  const sig = JSON.stringify(values);
  if (sig === current.drawn) return;
  current.drawn = sig;
  app.querySelectorAll('.row[data-live]').forEach(rowEl => {
    rowEl.querySelector('svg.diagram').outerHTML = current.shape.diagram(rowEl.dataset.live, values);
  });
}

// Follow-on sections, each solved from everything above it plus its own inputs.
function solveSections() {
  const { shape, fields, result } = current;
  let prev = result ? { ...result.values } : null;
  return sections(shape).map(sec => {
    const inputs = sec.fields.filter(f => fields[f.key].src === 'input');
    const out = (message = '', isError = false) => { prev = null; return { message, isError }; };
    if (!inputs.length) return out();
    const unreadable = inputs.filter(f => !isFinite(fields[f.key].value));
    if (unreadable.length) return out(`Can't read ${unreadable.map(f => f.label).join(', ')}.`, true);
    if (!prev) return out('Fill in the section above first.');
    const r = sec.solve(prev, Object.fromEntries(inputs.map(f => [f.key, fields[f.key].value])));
    if (!r) return out();
    if (r.error) return out(r.error, true);
    for (const f of sec.fields) {
      if (fields[f.key].src === 'input') continue;
      fields[f.key] = { src: 'computed', value: r.values[f.key], text: formatValue(f.kind, r.values[f.key]) };
    }
    prev = { ...prev, ...r.values };
    return { message: '' };
  });
}

function resultsText() {
  const { shape, fields, result } = current;
  const lines = [shape.title];
  for (const f of allFields(shape)) {
    const st = fields[f.key];
    if (st.text) lines.push(`${f.label}: ${st.text}${st.src === 'input' ? ' (entered)' : ''}`);
  }
  if (result) {
    for (const o of shape.outputs) {
      if (isFinite(result[o])) lines.push(`${cap(o)}: ${o === 'area' ? formatValue('area', result[o]) : formatValue('len', result[o])}`);
    }
  }
  return lines.join('\n');
}

async function copyResults() {
  const text = resultsText();
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('Copied');
}

function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1400);
}

// ---------- routing and global actions ----------

function route() {
  const hash = location.hash || '#/';
  const m = hash.match(/^#\/shape\/(\w+)/);
  current = null;
  if (m) renderShape(m[1]);
  else if (hash === '#/settings') renderSettings();
  else renderMenu();
  window.scrollTo(0, 0);
}

app.addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  // Every screen sits one level below the menu.
  if (act === 'back') location.hash = '#/';
  else if (act === 'copy') copyResults();
  else if (act === 'clear') {
    state.inputs[current.id] = {};
    save();
    renderShape(current.id);
    app.querySelector('input')?.focus();
  } else if (act === 'clear-section') {
    // Clear just this section (e.g. a new reflector on the same plate).
    const sec = sections(current.shape)[Number(btn.dataset.section)];
    for (const f of sec.fields) current.fields[f.key] = { text: '', value: NaN, src: null };
    solve();
    document.getElementById(`f-${sec.fields[0].key}`)?.focus();
  } else if (act === 'preset') {
    const { key, deg } = btn.dataset;
    const el = document.getElementById(`f-${key}`);
    el.value = formatValue('ang', Number(deg) * Math.PI / 180);
    onInput(key, el.value);
  } else if (act === 'alt') {
    current.showAlt = !current.showAlt;
    solve();
  }
});

window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
