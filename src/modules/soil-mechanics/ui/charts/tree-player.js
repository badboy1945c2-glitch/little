/**
 * tree-player.js - مشغّل الحركة السينمائية لشجرة USCS (S8).
 * createTreePlayer() يرجع { el, update(نتيجة classifyUSCS), destroy() }.
 * - يرسم المستوى 1 (رمز المجموعة) كاملاً، والمستوى 2 (الاسم) للرمز المحسوم فقط.
 * - الحالة النهائية تظهر فوراً، ثم تُشغَّل الحركة من الجذر بعد توقف الكتابة (إن كان التشغيل التلقائي مفعلاً).
 * - يحترم prefers-reduced-motion: لا تشغيل تلقائي ولا انتقالات ولا تمرير ناعم.
 */
import { getUscsTree, USCS_ROOT } from '../../engine/uscs-tree.js';
import { layoutTree } from './uscs-tree-layout.js';
import { renderTreeSvg, TREE_CSS } from './uscs-tree-svg.js';
import { buildSteps, describeFinal, candidateLeafIds, signature } from './tree-steps.js';

const STEP_MS = 1500;   // مدة الخطوة الواحدة عند السرعة 1×
const IDLE_MS = 700;    // انتظار توقف الكتابة قبل التشغيل التلقائي
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function ensurePlayerStyles() {
  if (document.getElementById('soil-tree-styles')) return;
  const st = document.createElement('style');
  st.id = 'soil-tree-styles';
  st.textContent = `${TREE_CSS}
  .tp-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px}
  .tp-bar .form-select{width:auto}
  .tp-check{display:flex;gap:6px;align-items:center;font-size:.82rem;color:var(--ink-soft)}
  .tp-legend{display:flex;flex-wrap:wrap;gap:12px;font-size:.75rem;color:var(--ink-soft);margin-bottom:8px}
  .tp-legend i{display:inline-block;width:14px;height:10px;border:1.5px solid var(--line);border-radius:3px;margin-inline-end:4px;vertical-align:middle}
  .tp-legend .l-taken{background:var(--violet-50);border-color:var(--violet-700)}
  .tp-legend .l-final{background:var(--violet-700);border-color:var(--violet-700)}
  .tp-legend .l-pend{border:2px dashed var(--violet-700)}
  .tp-legend .l-cand{border:1.5px dashed var(--violet-700)}
  .tp-caption{margin-top:8px;font-size:.88rem;min-height:2.6em;padding:8px 10px;border:1px solid var(--line);border-radius:var(--radius);background:var(--bg-soft)}`;
  document.head.appendChild(st);
}

export function createTreePlayer({ autoplay = true } = {}) {
  ensurePlayerStyles();
  const tree = getUscsTree();
  const layoutCache = new Map();
  const layoutOf = (rootId) => {
    if (!layoutCache.has(rootId)) layoutCache.set(rootId, layoutTree(tree, rootId));
    return layoutCache.get(rootId);
  };

  const el = document.createElement('div');
  el.className = 'tp';
  el.innerHTML = `
    <div class="tp-bar">
      <button type="button" class="btn btn-sm btn-secondary" data-tp="restart">↻ من البداية</button>
      <button type="button" class="btn btn-sm btn-primary" data-tp="play">▶ تشغيل</button>
      <button type="button" class="btn btn-sm btn-secondary" data-tp="step">⏭ خطوة</button>
      <select class="form-select" data-tp="speed" aria-label="سرعة الحركة">
        <option value="0.5">بطيء 0.5×</option><option value="1" selected>عادي 1×</option><option value="2">سريع 2×</option>
      </select>
      <button type="button" class="btn btn-sm btn-secondary" data-tp="zoom-out" aria-label="تصغير">−</button>
      <button type="button" class="btn btn-sm btn-secondary" data-tp="zoom-in" aria-label="تكبير">+</button>
      <button type="button" class="btn btn-sm btn-secondary" data-tp="fit">ملاءمة العرض</button>
      <label class="tp-check"><input type="checkbox" data-tp="auto" ${autoplay ? 'checked' : ''}> تشغيل تلقائي عند توقف الكتابة</label>
    </div>
    <div class="tp-legend">
      <span><i class="l-taken"></i>مسار تربتك</span><span><i class="l-final"></i>النتيجة</span>
      <span><i class="l-pend"></i>عقدة تنتظر قيمة (؟)</span><span><i class="l-cand"></i>احتمال باقٍ</span>
    </div>
    <div class="tp-view" tabindex="0" aria-label="مخطط قرار USCS، يمكن تمريره بالعرض والطول"></div>
    <div class="tp-caption" aria-live="polite"></div>`;
  const view = el.querySelector('.tp-view');
  const captionEl = el.querySelector('.tp-caption');
  const playBtn = el.querySelector('[data-tp="play"]');
  const speedSel = el.querySelector('[data-tp="speed"]');
  const autoEl = el.querySelector('[data-tp="auto"]');

  const cur = { result: null, steps: [], k: -1, sig: '' };
  let timer = null, idleTimer = null, playing = false, scale = 0.8, destroyed = false;

  // ───── مساعدات DOM ─────
  const q = (attr, val) => el.querySelectorAll(`[${attr}="${String(val).replace(/"/g, '\\"')}"]`);
  const addClass = (nodes, c) => nodes.forEach((n) => n.classList.add(c));

  function applyScale() {
    view.querySelectorAll('.tp-svg').forEach((svg) => {
      svg.style.width = `${Math.round(Number(svg.dataset.w) * scale)}px`;
      svg.style.height = `${Math.round(Number(svg.dataset.h) * scale)}px`;
    });
  }

  function render(r) {
    const sym = (r.path || []).find((p) => p.kind === 'symbol');
    const nameRoot = sym ? `name.${sym.symbol}` : null;
    let html = `<div class="tp-stage-title">المستوى 1 — رمز المجموعة (جدول 2، ص35)</div>${renderTreeSvg(layoutOf(USCS_ROOT), { label: 'شجرة رمز المجموعة' })}`;
    if (nameRoot && tree[nameRoot]) {
      html += `<div class="tp-stage-title">المستوى 2 — اسم التربة للرمز ${sym.symbol} (ص37-39)</div>${renderTreeSvg(layoutOf(nameRoot), { label: `شجرة اسم التربة للرمز ${sym.symbol}` })}`;
    } else {
      html += '<div class="tp-stage-title tp-muted">المستوى 2 — اسم التربة: يظهر بعد تحديد الرمز</div>';
    }
    view.innerHTML = `<div class="tp-stack">${html}</div>`;
    applyScale();
  }

  // ───── الرسم حسب الخطوة k (يُعاد من الصفر في كل مرة؛ ما لم يتغير لا ينتقل) ─────
  function paint(k) {
    el.querySelectorAll('.is-taken,.is-final,.is-pending,.is-cand,.is-active').forEach((n) =>
      n.classList.remove('is-taken', 'is-final', 'is-pending', 'is-cand', 'is-active'));
    const { steps, result: r } = cur;
    for (let i = 0; i <= k && i < steps.length; i++) {
      addClass(q('data-id', steps[i].nodeId), 'is-taken');
      if (steps[i].edgeIn) addClass(q('data-key', steps[i].edgeIn), 'is-taken');
    }
    if (k >= 0 && steps[k]) addClass(q('data-id', steps[k].nodeId), 'is-active');
    const atEnd = k === steps.length - 1;
    if (!atEnd && steps.length) return;
    if (r.status === 'complete' && steps.length) addClass(q('data-id', steps[steps.length - 1].nodeId), 'is-final');
    else if (r.status === 'partial') {
      if (r.pendingNode) addClass(q('data-id', r.pendingNode), 'is-pending');
      candidateLeafIds(tree, r.candidates).forEach((id) => addClass(q('data-id', id), 'is-cand'));
    }
  }

  function captionFor(k) {
    const r = cur.result, n = cur.steps.length;
    if (r.status === 'invalid') return 'المدخلات غير صالحة؛ صحّحها ليظهر المسار.';
    if (r.status === 'blocked') return 'أدخل أي قيمة ليبدأ المسار من جذر الشجرة.';
    if (k < 0) return 'اضغط «تشغيل» لمشاهدة المسار من الجذر.';
    let t = `الخطوة ${k + 1} من ${n}: ${cur.steps[k].text}`;
    if (k === n - 1) t += ` — ${describeFinal(r, tree)}`;
    return t;
  }

  function focusStep(k, smooth) {
    let target = null;
    if (k >= 0 && cur.steps[k]) target = q('data-id', cur.steps[k].nodeId)[0];
    if (k === cur.steps.length - 1 && cur.result.status === 'partial' && cur.result.pendingNode) target = q('data-id', cur.result.pendingNode)[0] || target;
    if (!target) { view.scrollTo({ left: view.scrollWidth, top: 0, behavior: 'auto' }); return; }
    const t = target.getBoundingClientRect(), v = view.getBoundingClientRect();
    view.scrollTo({
      left: view.scrollLeft + (t.left - v.left) - (view.clientWidth - t.width) / 2,
      top: view.scrollTop + (t.top - v.top) - (view.clientHeight - t.height) / 2,
      behavior: smooth && !reduced() ? 'smooth' : 'auto'
    });
  }

  function showStep(k, animated) {
    cur.k = k;
    el.classList.toggle('tp-anim', !!animated && !reduced());
    paint(k);
    captionEl.textContent = captionFor(k);
    focusStep(k, animated);
  }

  const setPlayLabel = () => { playBtn.textContent = playing ? '⏸ إيقاف مؤقت' : '▶ تشغيل'; };
  const stepMs = () => STEP_MS / Number(speedSel.value || 1);

  function stop() { clearTimeout(timer); timer = null; playing = false; setPlayLabel(); }

  function tick() {
    if (destroyed || !el.isConnected) { stop(); return; }
    const nk = cur.k + 1;
    if (nk >= cur.steps.length) { stop(); return; }
    showStep(nk, true);
    if (nk >= cur.steps.length - 1) { stop(); return; }
    timer = setTimeout(tick, stepMs());
  }

  function play() {
    if (!cur.steps.length) return;
    clearTimeout(idleTimer);
    if (cur.k >= cur.steps.length - 1) { cur.k = -1; paint(-1); }
    playing = true; setPlayLabel();
    el.style.setProperty('--tp-t', `${Math.round(600 / Number(speedSel.value || 1))}ms`);
    tick();
  }

  function restart() { stop(); cur.k = -1; paint(-1); captionEl.textContent = captionFor(-1); play(); }

  function showFinal() {
    stop();
    showStep(cur.steps.length - 1, false);
    if (!cur.steps.length) captionEl.textContent = captionFor(-1);
  }

  // ───── واجهة التحديث ─────
  function update(result) {
    if (!result) return;
    const sig = signature(result);
    if (sig === cur.sig) return;
    cur.sig = sig; cur.result = result; cur.steps = buildSteps(result);
    clearTimeout(idleTimer); stop();
    render(result);
    showFinal();
    if (autoEl.checked && !reduced() && cur.steps.length) idleTimer = setTimeout(() => { if (!destroyed && el.isConnected) restart(); }, IDLE_MS);
  }

  // ───── الأحداث ─────
  el.addEventListener('click', (e) => {
    const nodeEl = e.target.closest('.tp-node');
    if (nodeEl) {
      const n = tree[nodeEl.dataset.id];
      if (n) captionEl.textContent = n.leaf
        ? (n.stage === 'symbol' ? `رمز المجموعة: ${n.symbol}` : `الاسم: ${n.name}`)
        : `${n.question} — ${n.branches.map((b) => b.label).join(' / ')} (${n.source})`;
      return;
    }
    const b = e.target.closest('button[data-tp]'); if (!b) return;
    const act = b.dataset.tp;
    if (act === 'play') { playing ? stop() : play(); }
    else if (act === 'restart') restart();
    else if (act === 'step') { stop(); clearTimeout(idleTimer); showStep(Math.min(cur.k + 1, cur.steps.length - 1), true); }
    else if (act === 'zoom-in') { scale = Math.min(1.6, scale + 0.15); applyScale(); }
    else if (act === 'zoom-out') { scale = Math.max(0.25, scale - 0.15); applyScale(); }
    else if (act === 'fit') {
      const w = Math.max(...[...view.querySelectorAll('.tp-svg')].map((s) => Number(s.dataset.w)), 1);
      scale = Math.max(0.25, Math.min(1.2, (view.clientWidth - 24) / w)); applyScale();
    }
  });
  speedSel.addEventListener('change', () => { if (playing) { clearTimeout(timer); timer = setTimeout(tick, stepMs()); } });

  return { el, update, destroy() { destroyed = true; stop(); clearTimeout(idleTimer); }, _debug: { cur } };
}
