/**
 * grain.js - تبويب «التحليل الحبيبي» (S4)
 * كتل المناخل أو نقاط المنحنى، النسبة المارة، D10 وD30 وD60، Cu وCc، نسب الأجزاء، قانون ستوكس
 */
import { ensureStyles } from './laws.js';
import { SIEVES, percentFinerFromMasses, checkPoints, percentAt, dAt, gradeParams, fractions, GRAIN_SYSTEMS, stokesVelocity } from '../../engine/grain.js';
import { renderGrainChart } from '../charts/grain-chart.js';
import { soilState } from '../../state.js';

const DIG = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '٫': '.', ',': '.' };
const num = (t) => {
  const s = String(t ?? '').trim().replace(/[٠-٩٫,]/g, (c) => DIG[c]);
  if (s === '') return null;
  return /^-?(\d+\.?\d*|\.\d+)$/.test(s) ? parseFloat(s) : NaN;
};
const show = (x, d = 2) => (x == null || !Number.isFinite(x) ? '—' : String(Number(x.toFixed(d))));
const mmOf = (no) => SIEVES.find((s) => s.no === String(no)).mm;

const EX6 = { 4: '0', 10: '21.6', 20: '49.5', 40: '102.6', 60: '89.1', 100: '95.6', 200: '60.4' };
const EX7 = [[0.425, 100], [0.033, 90], [0.018, 80], [0.01, 70], [0.0062, 60], [0.0035, 50], [0.0018, 40], [0.001, 35]];

function ensureGrainStyles() {
  if (document.getElementById('grain-styles')) return;
  const s = document.createElement('style');
  s.id = 'grain-styles';
  s.textContent = `.soil-table{width:100%;border-collapse:collapse;font-size:.85rem}
  .soil-table th,.soil-table td{border-bottom:1px solid var(--line);padding:4px 6px;text-align:start}
  .soil-table input{width:100%;min-width:70px}.soil-table td.num{direction:ltr;text-align:left;font-family:var(--font-mono)}`;
  document.head.appendChild(s);
}

export function renderGrainTab() {
  ensureStyles(); ensureGrainStyles();
  const st = soilState.grain;
  const root = document.createElement('div');
  root.className = 'soil-laws';
  root.innerHTML = `
    <div>
      <div class="soil-card">
        <h3>طريقة الإدخال</h3>
        <div class="soil-tools">
          <button type="button" class="btn btn-sm" data-mode="masses">كتل المناخل (g)</button>
          <button type="button" class="btn btn-sm" data-mode="points">نقاط المنحنى (mm، %)</button>
          <button type="button" class="btn btn-sm btn-secondary" data-ex="6">مثال 6</button>
          <button type="button" class="btn btn-sm btn-secondary" data-ex="7">مثال 7</button>
          <button type="button" class="btn btn-sm btn-ghost" data-act="clear">مسح</button>
        </div>
        <div id="gr-inputs"></div>
      </div>
      <div class="soil-card">
        <h3>قانون ستوكس (حاسبة مرجعية للهيدروميتر، ص 20)</h3>
        <div class="soil-note" dir="ltr" style="margin-bottom:8px;">v = (ρs − ρw) D² / (18 η)</div>
        <div class="soil-tools" style="align-items:center;">
          <label>ρs (g/cm³) <input class="form-input" dir="ltr" data-hy="rhoS" style="width:90px"></label>
          <label>η (mPa·s) <input class="form-input" dir="ltr" data-hy="eta" style="width:90px"></label>
          <label>D (mm) <input class="form-input" dir="ltr" data-hy="D" style="width:90px"></label>
        </div>
        <div id="gr-stokes" class="soil-note"></div>
      </div>
    </div>
    <div>
      <div id="gr-err"></div>
      <div class="soil-card"><h3>منحنى التدرج</h3><div id="gr-chart"></div></div>
      <div class="soil-card"><h3>المعاملات</h3>
        <div class="soil-tools" style="align-items:center;">
          <label>D10 يدوي <input class="form-input" dir="ltr" data-man="D10" style="width:80px"></label>
          <label>D30 يدوي <input class="form-input" dir="ltr" data-man="D30" style="width:80px"></label>
          <label>D60 يدوي <input class="form-input" dir="ltr" data-man="D60" style="width:80px"></label>
        </div>
        <div class="soil-note">اتركها فارغة ليستخرجها الموقع بالاستيفاء من الجدول (افتراض)، أو اكتب قراءتك من المنحنى.</div>
        <div id="gr-params"></div>
      </div>
      <div class="soil-card"><h3>نسب الأجزاء</h3>
        <select class="form-select" id="gr-system" style="margin-bottom:10px;">${Object.entries(GRAIN_SYSTEMS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('')}</select>
        <div id="gr-frac"></div>
      </div>
      <div class="soil-card"><h3>إلى كشف التربة</h3>
        <button type="button" class="btn btn-primary btn-sm" data-act="send">أرسل إلى كشف التربة</button>
        <div id="gr-sent" class="soil-note" style="margin-top:8px;"></div>
      </div>
    </div>`;
  const $ = (s) => root.querySelector(s);

  function buildInputs() {
    root.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('btn-primary', b.dataset.mode === st.mode));
    if (st.mode === 'masses') {
      const used = new Set(st.rows.map((r) => r.no));
      $('#gr-inputs').innerHTML = `<table class="soil-table"><thead><tr><th>المنخل</th><th>mm</th><th>المحتجزة (g)</th><th>تراكمية</th><th>المار %</th><th></th></tr></thead><tbody>
        ${st.rows.map((r, i) => `<tr><td>No.${r.no}</td><td class="num">${mmOf(r.no)}</td>
          <td><input class="form-input" dir="ltr" data-mass="${i}" value="${r.mass}"></td>
          <td class="num" data-cum="${i}"></td><td class="num" data-fin="${i}"></td>
          <td><button type="button" class="btn btn-sm btn-ghost" data-del="${i}" aria-label="حذف">×</button></td></tr>`).join('')}
        <tr><td>Pan</td><td>—</td><td><input class="form-input" dir="ltr" data-pan value="${st.pan}"></td><td class="num" data-cum="pan"></td><td class="num">0</td><td></td></tr></tbody></table>
        <div class="soil-tools" style="margin-top:8px;"><select class="form-select" id="gr-add" style="width:auto;">${SIEVES.filter((s) => !used.has(s.no)).map((s) => `<option value="${s.no}">No.${s.no} (${s.mm} mm)</option>`).join('')}</select>
        <button type="button" class="btn btn-sm btn-secondary" data-act="addsieve">إضافة منخل</button></div>`;
    } else {
      $('#gr-inputs').innerHTML = `<table class="soil-table"><thead><tr><th>الحجم (mm)</th><th>النسبة المارة %</th><th></th></tr></thead><tbody>
        ${st.points.map((p, i) => `<tr><td><input class="form-input" dir="ltr" data-pmm="${i}" value="${p.mm}"></td>
          <td><input class="form-input" dir="ltr" data-pfin="${i}" value="${p.finer}"></td>
          <td><button type="button" class="btn btn-sm btn-ghost" data-pdel="${i}" aria-label="حذف">×</button></td></tr>`).join('')}</tbody></table>
        <button type="button" class="btn btn-sm btn-secondary" data-act="addpoint" style="margin-top:8px;">إضافة نقطة</button>`;
    }
  }

  function currentPoints(errors) {
    if (st.mode === 'masses') {
      const rows = st.rows.map((r) => ({ no: r.no, mm: mmOf(r.no), mass: num(r.mass) }));
      const pan = num(st.pan);
      if (rows.some((r) => Number.isNaN(r.mass)) || Number.isNaN(pan)) errors.push('أدخل أرقاماً صحيحة في خانات الكتل');
      if (rows.some((r) => r.mass < 0) || pan < 0) errors.push('الكتلة لا يمكن أن تكون سالبة');
      const any = rows.some((r) => r.mass) || pan;
      if (!any || errors.length) return { points: [], calc: null };
      const calc = percentFinerFromMasses(rows.map((r) => ({ ...r, mass: r.mass || 0 })), pan || 0);
      return { points: calc.points, calc };
    }
    const pts = st.points.map((p) => ({ mm: num(p.mm), finer: num(p.finer) }));
    if (pts.some((p) => Number.isNaN(p.mm) || Number.isNaN(p.finer))) errors.push('أدخل أرقاماً صحيحة في نقاط المنحنى');
    const ok = pts.filter((p) => p.mm > 0 && p.finer !== null && p.finer >= 0 && p.finer <= 100);
    if (pts.some((p) => p.finer > 100)) errors.push('النسبة المارة لا تزيد عن 100%');
    return { points: errors.length ? [] : ok, calc: null };
  }

  let last = { points: [], D: {} };
  function recompute() {
    const errors = [];
    const { points, calc } = currentPoints(errors);
    if (points.length) errors.push(...checkPoints(points));
    $('#gr-err').innerHTML = errors.length ? `<div class="soil-warn" role="alert">${errors.join('<br>')}</div>` : '';
    if (calc) calc.rows.forEach((r, i) => {
      const c = $(`[data-cum="${i}"]`), f = $(`[data-fin="${i}"]`);
      if (c) c.textContent = show(r.cumulative, 2); if (f) f.textContent = show(r.finer, 1);
    });
    if (calc) { const pc = $('[data-cum="pan"]'); if (pc) pc.textContent = show(calc.total, 2); }

    const valid = points.length >= 2 && !errors.length;
    const man = (k) => { const v = num(st.manual[k]); return v > 0 ? v : null; };
    const D = { D10: man('D10') ?? (valid ? dAt(points, 10) : null), D30: man('D30') ?? (valid ? dAt(points, 30) : null), D60: man('D60') ?? (valid ? dAt(points, 60) : null) };
    const { Cu, Cc } = gradeParams(D.D10, D.D30, D.D60);
    const src = (k) => (man(k) ? 'يدوي' : 'استيفاء');
    $('#gr-params').innerHTML = `<table class="soil-table"><tbody>
      ${['D10', 'D30', 'D60'].map((k) => `<tr><td dir="ltr">${k}</td><td class="num">${show(D[k], 4)} mm</td><td class="soil-note">${D[k] ? src(k) : ''}</td></tr>`).join('')}
      <tr><td dir="ltr">Cu = D60 / D10</td><td class="num">${show(Cu, 2)}</td><td class="soil-note">معامل الانتظام</td></tr>
      <tr><td dir="ltr">Cc = D30² / (D60 × D10)</td><td class="num">${show(Cc, 2)}</td><td class="soil-note">معامل التدرج</td></tr></tbody></table>`;
    $('#gr-chart').innerHTML = renderGrainChart({ points: valid || points.length ? points : [], D: { D10: D.D10 || 0, D30: D.D30 || 0, D60: D.D60 || 0 } });

    const f = valid ? fractions(points, st.system) : null;
    const key = [[4.75, 'No.4'], [2, 'No.10'], [0.425, 'No.40'], [0.075, 'No.200'], [0.06, ''], [0.05, ''], [0.002, '']];
    $('#gr-frac').innerHTML = f
      ? `<table class="soil-table"><tbody>${Object.entries(f).map(([k, v]) => `<tr><td>${{ gravel: 'حصى', sand: 'رمل', silt: 'غرين', clay: 'طين', fines: 'ناعم (أصغر من 0.075)' }[k]}</td><td class="num">${show(v, 1)} %</td></tr>`).join('')}</tbody></table>`
      : `<span class="soil-note">${valid ? 'بعض الأحجام خارج مجال بياناتك. أضف نقاطاً أصغر للحصول على كل الأجزاء.' : 'أدخل بياناتك لتظهر النسب.'}</span>`;
    $('#gr-frac').innerHTML += valid ? `<table class="soil-table" style="margin-top:10px;"><tbody>${key.map(([mm, t]) => `<tr><td class="soil-note">المار عند ${mm} mm ${t}</td><td class="num">${show(percentAt(points, mm), 1)} %</td></tr>`).join('')}</tbody></table>` : '';
    last = { points: valid ? points : [], D };

    const h = st.hydro, rs = num(h.rhoS), et = num(h.eta), dd = num(h.D);
    $('#gr-stokes').innerHTML = rs > 1 && et > 0 && dd > 0
      ? `سرعة الترسيب v ≈ <b dir="ltr">${(stokesVelocity({ rhoS: rs * 1000, rhoW: 1000, eta: et * 1e-3, D: dd * 1e-3 }) * 1000).toPrecision(4)} mm/s</b>`
      : 'أدخل ρs أكبر من 1 وη وD موجبين.';
  }

  const rebuild = () => { buildInputs(); recompute(); };
  root.addEventListener('input', (e) => {
    const d = e.target.dataset;
    if (d.mass !== undefined) st.rows[Number(d.mass)].mass = e.target.value;
    else if (d.pan !== undefined) st.pan = e.target.value;
    else if (d.pmm !== undefined) st.points[Number(d.pmm)].mm = e.target.value;
    else if (d.pfin !== undefined) st.points[Number(d.pfin)].finer = e.target.value;
    else if (d.man) st.manual[d.man] = e.target.value;
    else if (d.hy) st.hydro[d.hy] = e.target.value;
    else return;
    recompute();
  });
  root.addEventListener('change', (e) => { if (e.target.id === 'gr-system') { st.system = e.target.value; recompute(); } });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.mode) { st.mode = d.mode; rebuild(); }
    else if (d.del !== undefined) { st.rows.splice(Number(d.del), 1); rebuild(); }
    else if (d.pdel !== undefined) { st.points.splice(Number(d.pdel), 1); rebuild(); }
    else if (d.act === 'addsieve') { const no = $('#gr-add').value; if (no) { st.rows.push({ no, mass: '' }); st.rows.sort((a, c) => mmOf(c.no) - mmOf(a.no)); rebuild(); } }
    else if (d.act === 'addpoint') { st.points.push({ mm: '', finer: '' }); rebuild(); }
    else if (d.act === 'clear') { st.rows = st.rows.map((r) => ({ ...r, mass: '' })); st.pan = ''; st.points = [{ mm: '', finer: '' }]; st.manual = { D10: '', D30: '', D60: '' }; syncManual(); rebuild(); }
    else if (d.ex === '6') { st.mode = 'masses'; st.rows = Object.keys(EX6).map((no) => ({ no, mass: EX6[no] })); st.pan = '31.2'; st.manual = { D10: '', D30: '', D60: '' }; syncManual(); rebuild(); }
    else if (d.ex === '7') { st.mode = 'points'; st.points = EX7.map(([mm, finer]) => ({ mm: String(mm), finer: String(finer) })); st.manual = { D10: '', D30: '', D60: '' }; syncManual(); rebuild(); }
    else if (d.act === 'send') {
      const { points, D } = last;
      if (points.length < 2) { $('#gr-sent').textContent = 'أدخل بيانات صحيحة أولاً.'; return; }
      const v = { F200: percentAt(points, 0.075), P4: percentAt(points, 4.75), P10: percentAt(points, 2), P40: percentAt(points, 0.425), D10: D.D10, D30: D.D30, D60: D.D60 };
      const out = {}; Object.entries(v).forEach(([k, x]) => { if (x != null && Number.isFinite(x)) out[k] = Number(x.toPrecision(4)); });
      soilState.detect.inputs = { ...soilState.detect.inputs, ...out };
      $('#gr-sent').innerHTML = `أُرسلت ${Object.keys(out).length} قيمة: <span dir="ltr">${Object.entries(out).map(([k, x]) => `${k}=${x}`).join(' ، ')}</span>`;
    }
  });
  function syncManual() { root.querySelectorAll('[data-man]').forEach((i) => { i.value = st.manual[i.dataset.man]; }); }
  root.querySelectorAll('[data-hy]').forEach((i) => { i.value = st.hydro[i.dataset.hy]; });
  $('#gr-system').value = st.system; syncManual(); rebuild();
  return root;
}