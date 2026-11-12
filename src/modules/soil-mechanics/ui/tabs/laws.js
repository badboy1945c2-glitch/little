/**
 * laws.js - تبويب «القوانين»: علاقات الأطوار + حدود أتربرغ (S3)
 * المدخلات اختيارية بأي ترتيب، والمحرك يحسب كل ما يمكن حسابه ويعرض خطوات الحل.
 */
import { makeSoilSolver, PERCENT_KEYS, SYMBOLS, variables } from '../../engine/soil-engine.js';
import { plasticityByPI, plasticityByLL, activityClass, stateOf, mineralMatches } from '../../engine/describe.js';
import { renderPlasticityChart } from '../charts/plasticity-chart.js';
import notes from '../../data/notes.json';
import { soilState } from '../../state.js';

// ───────────── تعريف المتغيرات والمجموعات ─────────────
const META = Object.fromEntries(variables.map((v) => [v.key, { symbol: SYMBOLS[v.key], ar: v.ar }]));
Object.assign(META, {
  LL: { symbol: 'LL', ar: 'الحد السائل' }, PL: { symbol: 'PL', ar: 'الحد اللدن' },
  PI: { symbol: 'PI', ar: 'مؤشر اللدونة' }, ws: { symbol: 'SL', ar: 'حد الانكماش' },
  LI: { symbol: 'LI', ar: 'مؤشر السيولة' }, CI: { symbol: 'CI', ar: 'مؤشر القوام' },
  clayPercent: { symbol: 'Clay%', ar: 'نسبة الطين (أصغر من 0.002 mm)' }, A: { symbol: 'A', ar: 'النشاط' }
});

const GROUPS = [
  { title: 'الأوزان', keys: ['W', 'Ws', 'Ww'] },
  { title: 'الأحجام', keys: ['V', 'Vs', 'Vv', 'Vw', 'Va'] },
  { title: 'النسب', keys: ['n', 'e', 'S', 'na', 'ac', 'w', 'G', 'Gm'] },
  { title: 'أوزان الوحدة', keys: ['gamma', 'gamma_s', 'gamma_sat', 'gamma_sub', 'gamma_d'] },
  { title: 'حدود أتربرغ', keys: ['LL', 'PL', 'PI', 'ws', 'LI', 'CI', 'clayPercent', 'A'] }
];
const ALL_KEYS = GROUPS.flatMap((g) => g.keys);
const PHASE_KEYS = ALL_KEYS.slice(0, ALL_KEYS.indexOf('LL'));

const MASS = [['kN', 1], ['N', 0.001]];
const VOL = [['m³', 1], ['cm³', 1e-6]];
const UW = [['kN/m³', 1], ['g/cm³', 9.81]];
const UNITS = {
  W: MASS, Ws: MASS, Ww: MASS, V: VOL, Vs: VOL, Vv: VOL, Vw: VOL, Va: VOL,
  gamma: UW, gamma_s: UW, gamma_sat: UW, gamma_sub: UW, gamma_d: UW
};
const unitsOf = (k) => UNITS[k] || (PERCENT_KEYS.includes(k) ? [['%', 0.01]] : [['', 1]]);

// ملاحظات المحاضرة التي تظهر بجانب CI وA (القسم 10)
const NOTE_FOR = { CI: 5, A: 6 };
const noteText = (n) => (notes.find((x) => x.n === n) || {}).text || '';

// ───────────── أمثلة المحاضرة ─────────────
const WARN_N = 'ملاحظة على المحاضرة: الأوزان بالنيوتن والمحاضرة تضرب بـ981 بدل 1000. الموقع يعتمد التحويل الصحيح (γ = 19.20 لمثال 2، وS ≈ 60.3% لمثال 5).';
const EXAMPLES = [
  { title: 'مثال 1', inputs: { gamma: '19.80', G: '2.70', w: '11' } },
  { title: 'مثال 2', inputs: { W: '1.668', Ws: '1.400', V: '86.87', G: '2.7' }, units: { W: 1, Ws: 1, V: 1 }, note: WARN_N },
  { title: 'مثال 4 (جافة)', inputs: { e: '0.65', G: '2.8', S: '0', w: '0' } },
  { title: 'مثال 4 (S=60%)', inputs: { e: '0.65', G: '2.8', S: '60' } },
  { title: 'مثال 4 (S=95%)', inputs: { e: '0.65', G: '2.8', S: '95' } },
  { title: 'مثال 4 (مشبعة)', inputs: { e: '0.65', G: '2.8', S: '100' } },
  { title: 'مثال 5', inputs: { G: '2.6', W: '2.50', Ws: '2.10', V: '150' }, units: { W: 1, Ws: 1, V: 1 }, note: WARN_N },
  { title: 'مثال 8 (PL)', inputs: { LL: '56', PI: '15', w: '45' } },
  { title: 'مثال 8 (SL)', inputs: { e: '0.88', G: '2.71' } },
  { title: 'مثال 9', inputs: { PL: '25', PI: '30', w: '34' } },
  { title: 'مثال 10', inputs: { e: '0.50', G: '2.72' } },
  { title: 'مثال 11', inputs: { LL: '48', PL: '26', w: '39', clayPercent: '42' } }
];

// ───────────── أدوات ─────────────
const DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9', '٫': '.', '٬': '', ',': '.' };
function parseNum(text) {
  const t = String(text).trim();
  if (t === '') return null;
  const s = t.replace(/[٠-٩۰-۹٫٬,]/g, (c) => DIGITS[c]);
  return /^-?(\d+\.?\d*|\.\d+)$/.test(s) ? parseFloat(s) : NaN;
}
function validate(key, v) {
  if (Number.isNaN(v)) return 'أدخل رقماً صحيحاً';
  if (v < 0 && key !== 'LI' && key !== 'CI') return 'القيمة لا يمكن أن تكون سالبة';
  if (['n', 'S', 'na', 'ac'].includes(key) && v > 100) return 'النسبة لا تزيد عن 100%';
  return '';
}
const showNum = (x) => String(Number(Number(x).toPrecision(5)));

const SYM_RE = new RegExp(`\\b(${Object.keys(SYMBOLS).sort((a, b) => b.length - a.length).join('|')})\\b`, 'g');
const pretty = (expr) => expr.replace(SYM_RE, (k) => SYMBOLS[k]).replace(/\*/g, '×');

export function ensureStyles() {
  if (document.getElementById('soil-styles')) return;
  const st = document.createElement('style');
  st.id = 'soil-styles';
  st.textContent = `
  .soil-laws{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:24px;align-items:start}
  @media(max-width:900px){.soil-laws{grid-template-columns:1fr}}
  .soil-card{border:1px solid var(--line);border-radius:var(--radius-lg);padding:16px;background:var(--bg);margin-bottom:16px}
  .soil-card h3{font-size:1rem;margin:0 0 12px;color:var(--violet-800)}
  .soil-tools{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
  .soil-row{display:grid;gap:4px;margin-bottom:8px;padding:6px 8px;border-radius:var(--radius);transition:background 600ms}
  .soil-row.is-computed{background:var(--violet-50)}
  .soil-row.flash{background:var(--violet-200);transition:none}
  .soil-row label{font-size:.88rem}
  .soil-field{display:flex;gap:8px;align-items:center}
  .soil-field .form-input{flex:1;min-width:0}
  .soil-field .form-select{width:auto}
  .soil-unit-label{min-width:44px;color:var(--ink-soft);font-size:.85rem}
  .soil-badge{font-size:.72rem;color:var(--ink-soft);min-width:58px}
  .is-computed .soil-badge{color:var(--violet-700);font-weight:600}
  .soil-err{color:var(--error);font-size:.78rem}
  .soil-note{color:var(--ink-soft);font-size:.78rem}
  .soil-warn{background:var(--error-bg);border:1px solid var(--error);border-radius:var(--radius);padding:10px;margin-bottom:16px;color:var(--error);font-size:.88rem}
  .soil-step{border-bottom:1px solid var(--line);padding:8px 0;font-size:.88rem}
  .soil-step code{display:block;direction:ltr;text-align:left;font-family:var(--font-mono);font-size:.82rem}
  .soil-badge-assume{display:inline-block;background:var(--bg-soft);border:1px solid var(--line);border-radius:10px;padding:0 8px;font-size:.72rem;margin-inline-start:6px}
  @media (prefers-reduced-motion:reduce){.soil-row{transition:none}}`;
  document.head.appendChild(st);
}

// ───────────── الواجهة ─────────────
export function renderLawsTab() {
  ensureStyles();
  const st = soilState.laws;
  const root = document.createElement('div');
  root.className = 'soil-laws';
  let solver = null, solverGW = null, timer = null;

  const rowHtml = (key) => {
    const defs = unitsOf(key);
    const unitCtl = defs.length > 1
      ? `<select class="form-select" data-unit="${key}" aria-label="الوحدة">${defs.map((d, i) => `<option value="${i}">${d[0]}</option>`).join('')}</select>`
      : `<span class="soil-unit-label">${defs[0][0]}</span>`;
    const note = NOTE_FOR[key] ? `<small class="soil-note"><span class="soil-badge-assume">ملاحظة على المحاضرة</span> ${noteText(NOTE_FOR[key])}</small>` : '';
    return `<div class="soil-row" data-row="${key}">
      <label for="sl-${key}"><b dir="ltr">${META[key].symbol}</b> ${META[key].ar}</label>
      <div class="soil-field">
        <input id="sl-${key}" class="form-input" dir="ltr" inputmode="decimal" autocomplete="off" data-key="${key}">
        ${unitCtl}<span class="soil-badge" data-badge="${key}"></span>
      </div>
      <small class="soil-err" data-err="${key}"></small>${note}</div>`;
  };

  root.innerHTML = `
    <div>
      <div class="soil-card">
        <h3>أدوات سريعة</h3>
        <div class="soil-tools">
          <button type="button" class="btn btn-sm btn-secondary" data-act="sat">تربة مشبعة (S = 100%)</button>
          <button type="button" class="btn btn-sm btn-secondary" data-act="dry">تربة جافة (S = 0, w = 0)</button>
          <button type="button" class="btn btn-sm btn-ghost" data-act="clear">مسح الكل</button>
        </div>
        <h3>أمثلة المحاضرة</h3>
        <div class="soil-tools">${EXAMPLES.map((e, i) => `<button type="button" class="btn btn-sm btn-secondary" data-ex="${i}">${e.title}</button>`).join('')}</div>
        <div id="sl-exnote" class="soil-note"></div>
        <div class="soil-row"><label for="sl-gw"><b dir="ltr">γw</b> وزن وحدة الماء (kN/m³) <span class="soil-badge-assume">ص 6</span></label>
          <div class="soil-field"><input id="sl-gw" class="form-input" dir="ltr" inputmode="decimal" value="${st.gammaW}"></div>
          <small class="soil-err" id="sl-gw-err"></small></div>
      </div>
      ${GROUPS.map((g) => `<div class="soil-card"><h3>${g.title}</h3>${g.keys.map(rowHtml).join('')}</div>`).join('')}
    </div>
    <div>
      <div id="sl-conf"></div>
      <div class="soil-card"><h3>التوصيف</h3><div id="sl-desc" class="soil-note">أدخل معطيات لتظهر التوصيفات.</div></div>
      <div class="soil-card"><h3>مخطط اللدونة</h3><div id="sl-chart"></div></div>
      <div class="soil-card"><h3>ما ينقصك</h3><div id="sl-need" class="soil-note"></div></div>
      <div class="soil-card" aria-live="polite"><h3>خطوات الحل</h3><div id="sl-steps"></div></div>
    </div>`;

  const $ = (sel) => root.querySelector(sel);
  const factorOf = (key) => unitsOf(key)[st.units[key] || 0][1];
  const unitLabel = (key) => unitsOf(key)[st.units[key] || 0][0];

  function syncControls() {
    root.querySelectorAll('[data-unit]').forEach((s) => { s.value = String(st.units[s.dataset.unit] || 0); });
    $('#sl-gw').value = st.gammaW;
  }

  function recompute() {
    // 1) قراءة المدخلات
    const known = {}, errors = {};
    for (const [key, text] of Object.entries(st.inputs)) {
      const v = parseNum(text);
      if (v === null) continue;
      const err = validate(key, v);
      if (err) errors[key] = err; else known[key] = v * factorOf(key);
    }
    let gw = parseNum(st.gammaW);
    const gwBad = gw === null || Number.isNaN(gw) || gw <= 0;
    $('#sl-gw-err').textContent = gwBad ? 'أدخل قيمة موجبة (الافتراضي 9.81)' : '';
    if (gwBad) gw = 9.81;
    if (gw !== solverGW) { solver = makeSoilSolver(gw); solverGW = gw; }

    // 2) الحل
    const res = solver.solve(known);

    // 3) تحديث الخانات
    ALL_KEYS.forEach((key) => {
      const input = $(`#sl-${key}`), row = $(`[data-row="${key}"]`), badge = $(`[data-badge="${key}"]`);
      const isUser = key in st.inputs;
      if (isUser) {
        if (document.activeElement !== input) input.value = st.inputs[key];
        row.classList.remove('is-computed'); badge.textContent = '';
      } else if (key in res.derived) {
        const text = showNum(res.derived[key] / factorOf(key));
        if (input.value !== text) {
          input.value = text;
          row.classList.add('flash');
          setTimeout(() => row.classList.remove('flash'), 600);
        }
        row.classList.add('is-computed'); badge.textContent = 'محسوب';
      } else {
        input.value = ''; row.classList.remove('is-computed'); badge.textContent = 'غير معروف';
      }
      $(`[data-err="${key}"]`).textContent = errors[key] || '';
      input.classList.toggle('has-error', !!errors[key]);
    });

    // 4) التعارض
    $('#sl-conf').innerHTML = res.conflicts.length
      ? `<div class="soil-warn" role="alert">${res.conflicts.map((c) => `القيم المدخلة متعارضة في المعادلة ${c.eqId}<br>`).join('')}
         <small>امسح إحدى القيم المدخلة (تتسبب في التعارض) وستُعاد الحسابات.</small></div>` : '';

    // 5) خطوات الحل
    $('#sl-steps').innerHTML = res.steps.length ? res.steps.map((s) => `
      <div class="soil-step"><b>${s.eqId}</b> · ${s.name} <small class="soil-note">(المحاضرة، ص ${s.page})</small>
        <code>${pretty(s.expr)}</code><code>${pretty(s.substituted)}</code>
        <code>${META[s.key].symbol} = ${showNum(s.value / factorOf(s.key))} ${unitLabel(s.key)}</code></div>`).join('')
      : '<span class="soil-note">لا توجد حسابات بعد. أدخل ما تعرفه من القيم.</span>';

    // 6) ما ينقص
    const have = Object.keys(res.values).filter((k) => k !== 'gamma_w');
    const needs = ['e', 'S', 'w', 'gamma_d'].filter((t) => !(t in res.values)).map((t) => {
      const opts = solver.suggest(t, have).filter((o) => o.every((k) => PHASE_KEYS.includes(k)));
      if (!opts.length) return '';
      const text = opts.slice(0, 5).map((o) => o.map((k) => META[k].symbol).join(' + ')).join(' ، ');
      return `<div>لحساب <b dir="ltr">${META[t].symbol}</b> أضف: ${text}</div>`;
    }).join('');
    $('#sl-need').innerHTML = needs || (res.steps.length ? 'لا شيء مهم ينقص لما سبق.' : 'أدخل أي معطيات تعرفها وسأحسب الباقي.');

    // 7) التوصيف والمخطط (النسب المئوية للعرض)
    const v = res.values, pct = (k) => (v[k] != null ? v[k] * 100 : null);
    const d = [];
    if (pct('PI') != null) { const b = plasticityByPI(pct('PI')); d.push(`وصف اللدونة بدلالة PI = ${showNum(pct('PI'))}: <b>${b.ar}</b> (${b.en}) <small>ص 27</small>`); }
    if (pct('LL') != null) { const b = plasticityByLL(pct('LL')); d.push(`وصف اللدونة بدلالة LL = ${showNum(pct('LL'))}: <b>${b.ar}</b> (${b.en}) <small>ص 27</small>`); }
    if (v.A != null) { const c = activityClass(v.A); d.push(`النشاط A = ${showNum(v.A)}: <b>${c.ar}</b> (${c.en}) <small>ص 28، مؤشر لإمكانية انتفاخ التربة الطينية</small>`); }
    const state = stateOf({ w: v.w, PL: v.PL, LL: v.LL, SL: v.ws });
    if (state) d.push(`حالة التربة: <b>${state.ar}</b> ${state.assumption ? '<span class="soil-badge-assume">افتراض</span>' : ''} <small>ص 26 و29</small>`);
    const min = mineralMatches({ LL: pct('LL'), PL: pct('PL'), A: v.A });
    if (min) d.push(min.length ? `معادن طينية محتملة (قيم نموذجية، ص 27): <b dir="ltr">${min.map((m) => m.name).join(' ، ')}</b>` : 'لا يطابق أي معدن في الجدول النموذجي (ص 27).');
    $('#sl-desc').innerHTML = d.length ? d.map((x) => `<div style="margin-bottom:6px;">${x}</div>`).join('') : 'أدخل معطيات لتظهر التوصيفات.';
    $('#sl-chart').innerHTML = renderPlasticityChart({ LL: pct('LL'), PI: pct('PI') });
  }

  const later = () => { clearTimeout(timer); timer = setTimeout(recompute, 120); };

  // ───────────── الأحداث ─────────────
  root.addEventListener('input', (e) => {
    if (e.target.id === 'sl-gw') { st.gammaW = e.target.value; later(); return; }
    const key = e.target.dataset && e.target.dataset.key;
    if (!key) return;
    if (e.target.value.trim() === '') delete st.inputs[key]; else st.inputs[key] = e.target.value;
    later();
  });
  root.addEventListener('change', (e) => {
    if (e.target.dataset && e.target.dataset.unit) { st.units[e.target.dataset.unit] = Number(e.target.value); recompute(); }
  });
  root.addEventListener('focusin', (e) => { // الخانة المحسوبة تُحدَّد كاملة حتى يستبدلها ما تكتبه
    const key = e.target.dataset && e.target.dataset.key;
    if (key && !(key in st.inputs) && e.target.value) e.target.select();
  });
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.act === 'sat') st.inputs.S = '100';
    else if (btn.dataset.act === 'dry') { st.inputs.S = '0'; st.inputs.w = '0'; }
    else if (btn.dataset.act === 'clear') { st.inputs = {}; st.units = {}; $('#sl-exnote').textContent = ''; }
    else if (btn.dataset.ex !== undefined) {
      const ex = EXAMPLES[Number(btn.dataset.ex)];
      st.inputs = { ...ex.inputs }; st.units = { ...(ex.units || {}) };
      $('#sl-exnote').innerHTML = ex.note ? `<span class="soil-badge-assume">ملاحظة على المحاضرة</span> ${ex.note}` : '';
    } else return;
    syncControls();
    recompute();
  });

  syncControls();
  recompute();
  return root;
}