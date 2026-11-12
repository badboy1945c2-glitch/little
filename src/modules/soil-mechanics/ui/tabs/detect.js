/**
 * detect.js - تبويب «كشف نوع التربة» (S6): واجهة ثابتة بلا حركة.
 * يقرأ ويكتب soilState.detect، ويستدعي محركات التصنيف الثلاثة، ويعرض:
 * النتيجة أو «ما ينقصك» + الاحتمالات، مع سلسلة الأسباب والصفحات والافتراضات.
 * المجهول يظهر «غير معروف» ولا يُعامل كصفر أبداً.
 */
import { soilState } from '../../state.js';
import { ensureStyles } from './laws.js';
import { classifyUSCS, classifyAASHTO, classifyUSDA } from '../../engine/classify.js';
import { renderPlasticityChart } from '../charts/plasticity-chart.js';
import { createTreePlayer } from '../charts/tree-player.js';

// ───────────── تعريف الحقول ─────────────
const GROUPS = [
  { title: 'تحليل المناخل (% مار)', keys: [['P4', 'المار من منخل 4 (P4)'], ['P10', 'المار من منخل 10 (P10)'], ['P40', 'المار من منخل 40 (P40)'], ['F200', 'المار من منخل 200 (F200)']] },
  { title: 'حدود أتربرغ', keys: [['LL', 'الحد السائل (LL)'], ['PL', 'الحد اللدن (PL)'], ['PI', 'مؤشر اللدونة (PI)']], flags: [['NP', 'غير لدن (NP)']] },
  { title: 'التدرج', keys: [['D10', 'D10 (mm)'], ['D30', 'D30 (mm)'], ['D60', 'D60 (mm)'], ['Cu', 'Cu'], ['Cc', 'Cc']] },
  { title: 'العضوية', keys: [['organicRatio', 'LL مجففة ÷ LL غير مجففة']], flags: [['peat', 'خث (عضوية في الغالب)']] }
];
const USDA_KEYS = [['gravel', 'حصى %'], ['sand', 'رمل %'], ['silt', 'غرين %'], ['clay', 'طين %']];

// أمثلة المحاضرة وواجب 1 (قيم نصية كما تُكتب)
const EXAMPLES = [
  { t: 'مثال AASHTO: A-1-b', sys: 'AASHTO', v: { P10: '42', P40: '35', F200: '20', LL: '25', PL: '20' } },
  { t: 'مثال AASHTO: A-7-6 وGI', sys: 'AASHTO', v: { F200: '95', LL: '60', PI: '40' } },
  { t: 'مثال 14: Sandy lean clay', sys: 'USCS', v: { P10: '100', P40: '80', F200: '58', LL: '30', PI: '10' } },
  { t: 'مثال: SC', sys: 'USCS', v: { P4: '70', F200: '30', LL: '33', PL: '12' } },
  { t: 'مثال: SP-SC', sys: 'USCS', v: { F200: '8', P4: '100', D10: '0.085', D30: '0.12', D60: '0.135', LL: '30', PL: '22' } },
  { t: 'مثال: CL-ML', sys: 'USCS', v: { F200: '61', LL: '26', PL: '20' } },
  { t: 'واجب 1 – تربة A', sys: 'USCS', v: { P4: '98', P10: '90', P40: '76', F200: '34', LL: '38', PL: '26' } },
  { t: 'واجب 1 – تربة B', sys: 'USCS', v: { P4: '100', P10: '98', P40: '86', F200: '58', LL: '49', PL: '28' } },
  { t: 'ناقص: F200 فقط', sys: 'USCS', v: { F200: '58' } },
  { t: 'USDA: Clay loam', sys: 'USDA', usda: { sand: '30', silt: '40', clay: '30' } },
  { t: 'USDA مع حصى', sys: 'USDA', usda: { gravel: '20', sand: '10', silt: '30', clay: '40' } }
];

// ───────────── أدوات ─────────────
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
/** يحوّل الأرقام العربية والفاصلة العربية إلى لاتينية؛ يرجع undefined إن كان الحقل فارغاً أو غير رقمي */
export function parseNum(s) {
  if (s === null || s === undefined) return undefined;
  const t = String(s).trim().replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d)).replace(/[٫,،]/g, '.');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}
const fmt = (x) => String(Number(Number(x).toFixed(4)));

function ensureDetectStyles() {
  if (document.getElementById('soil-detect-styles')) return;
  const st = document.createElement('style');
  st.id = 'soil-detect-styles';
  st.textContent = `
  .dt-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:24px;align-items:start}
  @media(max-width:900px){.dt-grid{grid-template-columns:1fr}}
  .dt-badge{font-size:.72rem;min-width:84px;color:var(--ink-soft)}
  .dt-badge.is-known{color:var(--violet-700);font-weight:600}
  .dt-badge.is-need{color:var(--error);font-weight:600}
  .dt-flag{display:flex;gap:8px;align-items:center;font-size:.88rem;margin:6px 0}
  .dt-result{border:1px solid var(--violet-200);background:var(--violet-50);border-radius:var(--radius-lg);padding:16px;margin-bottom:16px}
  .dt-sym{font-size:2rem;font-weight:700;color:var(--violet-800);direction:ltr;display:inline-block}
  .dt-name{font-size:1.05rem;direction:ltr;display:inline-block;margin-inline-start:10px}
  .dt-chip{display:inline-block;border:1px solid var(--line);background:var(--bg);border-radius:12px;padding:2px 10px;margin:2px;font-size:.85rem;direction:ltr}
  .dt-reason{border-bottom:1px solid var(--line);padding:8px 0;font-size:.88rem}
  .dt-reason small{display:block;color:var(--ink-soft)}
  .dt-st{font-size:.78rem;border-radius:10px;padding:0 8px;border:1px solid var(--line);margin-inline-start:6px}
  .dt-st.t{color:var(--violet-700);border-color:var(--violet-200)} .dt-st.f{color:var(--ink-soft)} .dt-st.u{color:var(--error)}
  .dt-need li{margin:2px 0}`;
  document.head.appendChild(st);
}

// ───────────── الواجهة ─────────────
export function renderDetectTab() {
  ensureStyles(); ensureDetectStyles();
  const st = soilState.detect;
  st.inputs ||= {}; st.flags ||= {}; st.usda ||= {}; st.system ||= 'USCS';

  const root = document.createElement('div');
  const $ = (sel) => root.querySelector(sel);

  const rowHtml = ([k, label]) => `
    <div class="soil-row" data-row="${k}">
      <label for="dt-${k}">${label}</label>
      <div class="soil-field">
        <input id="dt-${k}" class="form-input" dir="ltr" inputmode="decimal" data-in="${k}" autocomplete="off">
        <span class="dt-badge" data-badge="${k}"></span>
      </div>
      <small class="soil-err" data-err="${k}"></small>
    </div>`;
  const flagHtml = ([k, label]) => `<label class="dt-flag"><input type="checkbox" data-flag="${k}"> ${label}</label>`;

  root.innerHTML = `
    <div class="dt-grid">
      <div>
        <div class="soil-card">
          <h3>أمثلة جاهزة</h3>
          <div class="soil-tools">${EXAMPLES.map((e, i) => `<button type="button" class="btn btn-sm btn-secondary" data-ex="${i}">${e.t}</button>`).join('')}
            <button type="button" class="btn btn-sm btn-secondary" data-act="clear">مسح الكل</button></div>
          <div class="soil-note">اكتب ما تعرفه فقط. الحقل الفارغ يعني «غير معروف» وليس صفراً.</div>
        </div>
        ${GROUPS.map((g) => `<div class="soil-card"><h3>${g.title}</h3>${g.keys.map(rowHtml).join('')}${(g.flags || []).map(flagHtml).join('')}</div>`).join('')}
        <div class="soil-card"><h3>مدخلات USDA (للمثلث)</h3>
          ${USDA_KEYS.map(([k, label]) => `
            <div class="soil-row"><label for="dt-u-${k}">${label}</label>
              <div class="soil-field"><input id="dt-u-${k}" class="form-input" dir="ltr" inputmode="decimal" data-usda="${k}" autocomplete="off"></div>
              <small class="soil-err" data-err="u-${k}"></small></div>`).join('')}
          <div class="soil-note">إن تركت واحدة من الرمل/الغرين/الطين فارغة تُشتق من المجموع 100%.</div>
        </div>
      </div>
      <div>
        <div role="tablist" class="soil-tools">
          ${['USCS', 'AASHTO', 'USDA'].map((s) => `<button type="button" role="tab" data-sys="${s}" class="btn btn-sm"></button>`).join('')}
        </div>
        <div id="dt-errors"></div>
        <div id="dt-out" aria-live="polite"></div>
        <div class="soil-card"><h3>مخطط اللدونة</h3><div id="dt-chart"></div></div>
      </div>
    </div>
    <div class="soil-card" id="dt-tree-card"><h3>مخطط القرار (USCS)</h3><div id="dt-tree"></div></div>`;

  // لوحة المراجعة (S9): تظهر في وضع التطوير فقط (npm run dev)
  if (import.meta.env && import.meta.env.DEV) {
    const dev = document.createElement('div');
    dev.className = 'soil-card';
    dev.innerHTML = '<h3>وضع المراجعة (تطوير فقط)</h3><div class="soil-tools"><button type="button" class="btn btn-sm btn-secondary" id="dt-review-btn">افتح لوحة المراجعة</button></div><div id="dt-review"></div>';
    root.appendChild(dev);
    dev.querySelector('#dt-review-btn').addEventListener('click', async () => {
      const host = dev.querySelector('#dt-review');
      if (host.firstChild) { host.innerHTML = ''; return; }
      const { renderSoilReview } = await import('./soil-review.js');
      host.appendChild(renderSoilReview());
    });
  }

  // مشغّل شجرة القرار (S7 رسم ثابت + S8 حركة)
  const player = createTreePlayer();
  $('#dt-tree').appendChild(player.el);

  // ───── قراءة المدخلات ─────
  function collect() {
    const raw = {}, bad = {}, usda = {};
    for (const [k, v] of Object.entries(st.inputs)) {
      if (String(v ?? '').trim() === '') continue;
      const n = parseNum(v);
      if (n === undefined) bad[k] = 'اكتب رقماً'; else raw[k] = n;
    }
    raw.peat = !!st.flags.peat; raw.NP = !!st.flags.NP;
    for (const [k, v] of Object.entries(st.usda)) {
      if (String(v ?? '').trim() === '') continue;
      const n = parseNum(v);
      if (n === undefined) bad['u-' + k] = 'اكتب رقماً'; else usda[k] = n;
    }
    return { raw, usda, bad };
  }

  // ───── عرض أجزاء النتيجة ─────
  const needsHtml = (needs = []) => needs.length
    ? `<div class="soil-card"><h3>ما ينقصك لإكمال التصنيف</h3><ul class="dt-need">${needs.map((n) => `<li>${esc(n.ar)}</li>`).join('')}</ul></div>` : '';
  const candHtml = (c = []) => c.length
    ? `<div class="soil-card"><h3>الاحتمالات الباقية</h3>${c.map((x) => `<span class="dt-chip">${esc(x.symbol)}${x.name ? ' — ' + esc(x.name) : ''}</span>`).join('')}</div>` : '';
  const assumeHtml = (a = []) => a.length ? `<div style="margin-top:8px">${a.map((x) => `<span class="soil-badge-assume">${esc(x)}</span>`).join(' ')}</div>` : '';
  const pathHtml = (path = []) => {
    const steps = path.filter((p) => p.question);
    if (!steps.length) return '';
    return `<div class="soil-card"><h3>سلسلة الأسباب</h3>${steps.map((s, i) => `
      <div class="dt-reason"><b>${i + 1}. ${esc(s.question)}</b> ← ${esc(s.label)}
        <small>${esc(s.reasonAr)} <span class="soil-badge-assume">${esc(s.source)}</span></small></div>`).join('')}</div>`;
  };
  const idle = (r) => r.status === 'blocked' ? '<div class="soil-note">أدخل أي معلومة لتبدأ.</div>' : '';

  function uscsHtml(r) {
    if (r.status === 'complete') {
      return `<div class="dt-result"><div class="soil-note">النتيجة (USCS)</div>
        <span class="dt-sym">${esc(r.result.symbol)}</span><span class="dt-name">${esc(r.result.name)}</span>${assumeHtml(r.assumptions)}</div>${pathHtml(r.path)}`;
    }
    if (r.status === 'partial') {
      const sym = r.path.find((p) => p.kind === 'symbol');
      const head = sym
        ? `<div class="soil-note">الرمز محسوم، والاسم ينتظر معلومات</div><span class="dt-sym">${esc(sym.symbol)}</span>`
        : '<b>التصنيف غير مكتمل بعد</b>';
      return `<div class="dt-result">${head}${assumeHtml(r.assumptions)}</div>${needsHtml(r.needs)}${candHtml(r.candidates)}${pathHtml(r.path)}`;
    }
    return idle(r);
  }

  const STL = { true: ['t', 'مطابقة'], false: ['f', 'غير مطابقة'], unknown: ['u', 'غير معروف'], skipped: ['f', 'لم تُفحص'] };
  function aashtoHtml(r) {
    if (r.status !== 'complete' && r.status !== 'partial') return idle(r);
    const groups = r.groups ? `<div class="soil-card"><h3>فحص المجموعات بالترتيب من اليسار</h3>${r.groups.map((g) => {
      const [c, t] = STL[g.status] || ['f', g.status];
      return `<div class="dt-reason"><b dir="ltr">${esc(g.g)}</b><span class="dt-st ${c}">${t}</span></div>`;
    }).join('')}</div>` : '';
    if (r.status === 'complete') {
      const x = r.result;
      const gi = x.GI !== undefined
        ? `<b dir="ltr">GI = ${x.GI}</b> <small class="soil-note">(قبل التقريب ${fmt(x.GIraw)})</small>`
        : `<span class="soil-note">${esc(x.GInote || '')}</span>`;
      return `<div class="dt-result"><div class="soil-note">النتيجة (AASHTO)</div><span class="dt-sym">${esc(x.group)}</span>
        <div>${esc(x.materials)}</div><div class="soil-note">${esc(x.rating)}</div><div>${gi}</div>${assumeHtml(r.assumptions)}</div>${groups}`;
    }
    return `<div class="dt-result"><b>التصنيف غير مكتمل بعد</b>${assumeHtml(r.assumptions)}</div>${needsHtml(r.needs)}${candHtml(r.candidates)}${groups}`;
  }

  function usdaHtml(r) {
    if (r.status === 'complete') {
      const c = r.corrected;
      return `<div class="dt-result"><div class="soil-note">النتيجة (USDA)</div><span class="dt-sym">${esc(r.result.name)}</span>
        <span class="dt-name" style="direction:rtl">${esc(r.result.nameAr)}</span>${assumeHtml(r.assumptions)}
        ${(r.warnings || []).map((w) => `<div class="soil-note">${esc(w)}</div>`).join('')}</div>
        <div class="soil-card"><h3>النسب المعتمدة</h3><table class="soil-table"><tbody>
          ${[['sand', 'رمل'], ['silt', 'غرين'], ['clay', 'طين']].map(([k, a]) => `<tr><td>${a}</td><td class="num">${fmt(c[k])} %</td></tr>`).join('')}</tbody></table></div>`;
    }
    if (r.status === 'partial') return `<div class="dt-result"><b>أدخل نسبتين على الأقل من الرمل والغرين والطين</b></div>${needsHtml(r.needs)}`;
    return idle(r);
  }

  // ───── إعادة الحساب ─────
  function recompute() {
    const { raw, usda, bad } = collect();
    const res = { USCS: classifyUSCS(raw), AASHTO: classifyAASHTO(raw), USDA: classifyUSDA(usda) };
    const uscs = res.USCS, aashto = res.AASHTO;
    const vars = uscs.vars || {};
    const needKeys = new Set([...(uscs.needs || []), ...(aashto.needs || [])].map((n) => n.key));
    const done = uscs.status === 'complete' && aashto.status === 'complete';

    // شارات الحقول: محسوب / مطلوب الآن / غير معروف / غير مطلوب
    root.querySelectorAll('[data-in]').forEach((inp) => {
      const k = inp.dataset.in;
      const typed = String(st.inputs[k] ?? '').trim() !== '';
      const derived = !typed && Number.isFinite(vars[k]);
      let txt = '', cls = '';
      if (typed) txt = '';
      else if (derived) { txt = `محسوب: ${fmt(vars[k])}`; cls = 'is-known'; }
      else if (needKeys.has(k)) { txt = 'مطلوب الآن'; cls = 'is-need'; }
      else if (done) txt = 'غير مطلوب';
      else txt = 'غير معروف';
      const badge = root.querySelector(`[data-badge="${k}"]`);
      badge.textContent = txt; badge.className = `dt-badge ${cls}`;
      root.querySelector(`[data-row="${k}"]`).classList.toggle('is-computed', derived);
    });
    root.querySelectorAll('[data-err]').forEach((el) => { el.textContent = bad[el.dataset.err] || ''; });

    const cur = res[st.system];
    const errs = [...new Set([...(cur.errors || []), ...(st.system === 'USDA' ? [] : (aashto.errors || [])), ...Object.values(bad)])];
    $('#dt-errors').innerHTML = errs.length ? `<div class="soil-warn" role="alert">${errs.map(esc).join('<br>')}</div>` : '';

    root.querySelectorAll('[data-sys]').forEach((b) => {
      const s = b.dataset.sys, on = s === st.system;
      b.className = `btn btn-sm ${on ? 'btn-primary' : 'btn-secondary'}`;
      b.setAttribute('aria-selected', String(on));
      b.textContent = s + (res[s].status === 'complete' ? ' ✓' : '');
    });

    $('#dt-out').innerHTML = cur.status === 'invalid' ? '' : { USCS: uscsHtml, AASHTO: aashtoHtml, USDA: usdaHtml }[st.system](cur);

    // شجرة القرار تظهر مع نظام USCS فقط
    const showTree = st.system === 'USCS';
    $('#dt-tree-card').hidden = !showTree;
    if (showTree) player.update(uscs);

    // مخطط اللدونة بالقيم المعلومة (مُدخلة أو محسوبة)
    $('#dt-chart').innerHTML = renderPlasticityChart({
      LL: Number.isFinite(vars.LL) ? vars.LL : null,
      PI: Number.isFinite(vars.PI) ? vars.PI : null
    });
  }

  let timer = null;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(recompute, 120); };

  function syncFields() {
    root.querySelectorAll('[data-in]').forEach((i) => { i.value = st.inputs[i.dataset.in] ?? ''; });
    root.querySelectorAll('[data-usda]').forEach((i) => { i.value = st.usda[i.dataset.usda] ?? ''; });
    root.querySelectorAll('[data-flag]').forEach((i) => { i.checked = !!st.flags[i.dataset.flag]; });
  }

  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.in) st.inputs[t.dataset.in] = t.value;
    else if (t.dataset.usda) st.usda[t.dataset.usda] = t.value;
    else return;
    schedule();
  });
  root.addEventListener('change', (e) => {
    if (e.target.dataset.flag) { st.flags[e.target.dataset.flag] = e.target.checked; recompute(); }
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sys) { st.system = b.dataset.sys; recompute(); }
    else if (b.dataset.act === 'clear') { st.inputs = {}; st.usda = {}; st.flags = {}; syncFields(); recompute(); }
    else if (b.dataset.ex !== undefined) {
      const ex = EXAMPLES[Number(b.dataset.ex)];
      st.inputs = { ...(ex.v || {}) }; st.usda = { ...(ex.usda || {}) }; st.flags = {}; st.system = ex.sys;
      syncFields(); recompute();
    }
  });

  syncFields(); recompute();
  return root;
}
