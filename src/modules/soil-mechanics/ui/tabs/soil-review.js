/**
 * soil-review.js - لوحة المراجعة (S9) لوضع التطوير فقط.
 * 1) حالات المحاضرة (القسم 9 من المواصفات) والسلوك الجزئي: الناتج بجانب المتوقع (✓ أو ✗).
 * 2) فحص عشوائي: إضافة قيمة جديدة لا تغيّر ما حُسم سابقاً (المسار المعروف بادئة للمسار الكامل).
 * 3) وصف نصي لكل مخطط (أسئلة وفروع) لتقارنه مع المحاضرة.
 */
import { ensureStyles } from './laws.js';
import { classifyUSCS as U, classifyAASHTO as A, classifyUSDA as D } from '../../engine/classify.js';
import { getUscsTree, USCS_ROOT } from '../../engine/uscs-tree.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const syms = (r) => r.candidates.map((c) => c.symbol).sort().join(',');
const show = (o) => Object.entries(o).map(([k, v]) => `${k}=${v}`).join('، ');
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// كل حالة: id، مصدرها، مدخلاتها، المتوقع (نص)، ودالة تحسب الناتج كنص بنفس الصيغة
const CASES = [
  { id: 'T-C01', src: 'مثال 12 ص40 (AASHTO)', v: { P10: 42, P40: 35, F200: 20, LL: 25, PL: 20 }, exp: 'A-1-b',
    run: (v) => A(v).result?.group },
  { id: 'T-C02', src: 'مثال 13 ص40 (AASHTO)', v: { F200: 95, LL: 60, PI: 40 }, exp: 'A-7-6 | GI=42',
    run: (v) => { const r = A(v).result; return r && `${r.group} | GI=${r.GI}`; } },
  { id: 'T-C03', src: 'مثال 14 ص41 (USCS)', v: { P10: 100, P40: 80, F200: 58, LL: 30, PI: 10 }, exp: 'CL | Sandy lean clay',
    run: (v) => { const r = U(v).result; return r && `${r.symbol} | ${r.name}`; } },
  { id: 'T-C04', src: 'مثال 15 ص41–42 (USCS)', v: { P4: 70, F200: 30, LL: 33, PL: 12 }, exp: 'SC | Clayey sand with gravel',
    run: (v) => { const r = U(v).result; return r && `${r.symbol} | ${r.name}`; } },
  { id: 'T-C05', src: 'مثال 16 ص43 تربة A', v: { F200: 8, P4: 100, D10: 0.085, D30: 0.12, D60: 0.135, LL: 30, PL: 22 },
    exp: 'Cu=1.59 | Cc=1.25 | SP-SC | Poorly graded sand with clay (or silty clay)',
    run: (v) => { const u = U(v), r = u.result; return r && `Cu=${u.vars.Cu.toFixed(2)} | Cc=${u.vars.Cc.toFixed(2)} | ${r.symbol} | ${r.name}`; } },
  { id: 'T-C06a', src: 'مثال 16 ص44 تربة B (بلا P4)', v: { F200: 61, LL: 26, PL: 20 }, exp: 'partial | CL-ML | ينقص P4',
    run: (v) => { const u = U(v); return `${u.status} | ${u.path.some((s) => s.symbol === 'CL-ML') ? 'CL-ML' : '?'} | ينقص ${u.needs.map((n) => n.key).join(',')}`; } },
  { id: 'T-C06b', src: 'مثال 16 ص44 تربة B (P4=100)', v: { F200: 61, P4: 100, LL: 26, PL: 20 }, exp: 'CL-ML | Sandy silty clay',
    run: (v) => { const r = U(v).result; return r && `${r.symbol} | ${r.name}`; } },
  { id: 'T-C07', src: 'USDA ص32 تربة A', usda: { sand: 30, silt: 40, clay: 30 }, exp: 'Clay loam',
    run: (v) => D(v).result?.name },
  { id: 'T-C08', src: 'USDA ص32 تربة B', usda: { gravel: 20, sand: 10, silt: 30, clay: 40 }, exp: 'Clay | رمل 12.5',
    run: (v) => { const r = D(v); return r.result && `${r.result.name} | رمل ${r.corrected.sand}`; } },
  { id: 'T-C09', src: 'واجب 1 ص45 تربة A', v: { P4: 98, P10: 90, P40: 76, F200: 34, LL: 38, PL: 26 }, exp: 'A-2-6 | SM | Silty sand',
    run: (v) => { const u = U(v).result; return `${A(v).result?.group} | ${u?.symbol} | ${u?.name}`; } },
  { id: 'T-C10', src: 'واجب 1 ص45 تربة B', v: { P4: 100, P10: 98, P40: 86, F200: 58, LL: 49, PL: 28 }, exp: 'A-7-6 | ML | Sandy silt',
    run: (v) => { const u = U(v).result; return `${A(v).result?.group} | ${u?.symbol} | ${u?.name}`; } },
  { id: 'PT1', src: 'سلوك جزئي: F200=58', v: { F200: 58 }, exp: 'partial | يحتاج LL | CH,CL,CL-ML,MH,ML',
    run: (v) => { const u = U(v); return `${u.status} | ${u.needs.some((n) => n.key === 'LL') ? 'يحتاج LL' : '?'} | ${syms(u)}`; } },
  { id: 'PT2', src: 'سلوك جزئي: F200=58، LL=30', v: { F200: 58, LL: 30 }, exp: 'partial | يحتاج PI | CL,CL-ML,ML',
    run: (v) => { const u = U(v); return `${u.status} | ${u.needs.some((n) => n.key === 'PI') ? 'يحتاج PI' : '?'} | ${syms(u)}`; } },
  { id: 'PT6', src: 'سلوك جزئي: P4 مستنتج', v: { F200: 58, LL: 30, PI: 10, P10: 100 }, exp: 'Sandy lean clay',
    run: (v) => U(v).result?.name },
  { id: 'PT7a', src: 'حد: PI=7 مقابل 7.01', v: {}, exp: 'CL-ML | CL',
    run: () => { const f = (pi) => U({ F200: 60, P4: 100, LL: 22, PI: pi }).result?.symbol; return `${f(7)} | ${f(7.01)}`; } },
  { id: 'PT7b', src: 'حد: F200=5 و12 و12.01', v: {}, exp: 'GW-GC | GW-GC | GC',
    run: () => { const f = (x) => U({ F200: x, P4: 50, Cu: 5, Cc: 2, LL: 30, PL: 10 }).result?.symbol; return `${f(5)} | ${f(12)} | ${f(12.01)}`; } },
  { id: 'PT8', src: 'PI=21 مقابل خط A=21.17', v: { F200: 58, P4: 100, LL: 49, PI: 21 }, exp: 'ML',
    run: (v) => U(v).result?.symbol }
];

function runCases() {
  return CASES.map((c) => {
    let actual;
    try { actual = String(c.run(c.usda || c.v)); } catch (e) { actual = `خطأ: ${e.message}`; }
    return { ...c, actual, ok: actual === c.exp };
  });
}

// فحص عشوائي: المسار المعروف بعد حذف حقول عشوائية يبقى بادئة للمسار الكامل
function fuzz(count = 2000) {
  let seed = 20261101;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const ri = (a, b) => Math.round((a + rnd() * (b - a)) * 10) / 10;
  const key = (r) => r.path.map((p) => `${p.nodeId}:${p.branchId || ''}`);
  const isPrefix = (a, b) => a.length <= b.length && a.every((x, i) => x === b[i]);
  let checks = 0; const fails = [];
  for (let i = 0; i < count; i++) {
    const P4 = ri(0, 100), P10 = ri(0, P4), P40 = ri(0, P10), F200 = ri(0, P40), LL = ri(10, 90), PL = ri(5, LL);
    const D10 = ri(1, 50) / 100, D30 = D10 * (1 + rnd() * 3), D60 = D30 * (1 + rnd() * 4);
    const f = { P4, P10, P40, F200, LL, PL, D10, D30, D60 };
    const full = U(f);
    if (full.status !== 'complete') { fails.push(`المدخلات الكاملة لم تكتمل: ${show(f)}`); continue; }
    for (let t = 0; t < 3; t++) {
      const g = { ...f };
      for (const k of Object.keys(g)) if (rnd() < 0.4) delete g[k];
      const r = U(g);
      if (r.status === 'invalid' || r.status === 'blocked') continue;
      checks++;
      if (!isPrefix(key(r), key(full))) fails.push(`تغيّر المسار: كامل (${show(f)}) ← جزئي (${show(g)})`);
      else if (r.status === 'partial' && !r.candidates.some((c) => c.symbol === full.result.symbol && (!c.name || c.name === full.result.name))) {
        fails.push(`النتيجة النهائية ليست بين الاحتمالات: (${show(g)})`);
      }
    }
  }
  return { checks, fails };
}

// وصف نصي للأشجار
function treeText(tree, rootId) {
  const lines = [];
  const walk = (id, depth) => {
    const n = tree[id];
    if (n.leaf) { lines.push(`${'—'.repeat(depth)} ${n.stage === 'symbol' ? n.symbol : n.name}`); return; }
    lines.push(`${'—'.repeat(depth)} ${n.question}  [${n.source}]`);
    for (const b of n.branches) { lines.push(`${'—'.repeat(depth + 1)} «${b.label}»  (${b.test})`); walk(b.to, depth + 2); }
  };
  walk(rootId, 0);
  return lines.join('\n');
}

export function renderSoilReview() {
  ensureStyles();
  const root = document.createElement('div');
  const rows = runCases();
  const okCount = rows.filter((r) => r.ok).length;
  const tree = getUscsTree();
  const nameRoots = Object.keys(tree).filter((id) => /^name\.[A-Za-z-]+$/.test(id));
  const pre = 'direction:ltr;text-align:left;white-space:pre-wrap;font-family:var(--font-mono);font-size:.78rem;margin:0';

  root.innerHTML = `
    <div class="soil-card"><h3>حالات المحاضرة: ${okCount} من ${rows.length} مطابقة</h3>
      <table class="soil-table"><thead><tr><th>الحالة</th><th>المصدر</th><th>المدخلات</th><th>المتوقع</th><th>الناتج</th><th></th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td dir="ltr">${r.id}</td><td>${esc(r.src)}</td>
        <td dir="ltr">${esc(show(r.usda || r.v) || '—')}</td><td dir="ltr">${esc(r.exp)}</td><td dir="ltr">${esc(r.actual)}</td>
        <td><b style="color:${r.ok ? 'var(--violet-700)' : 'var(--error)'}">${r.ok ? '✓' : '✗'}</b></td></tr>`).join('')}
      </tbody></table>
      <div class="soil-note" style="margin-top:8px">واجب 2 (ص45): المحاضرة لا تعطي مفتاحه، فلا يُعدّ اختباراً. الموقع يعطي حسب القواعد A-1-b وSC-SM، ويُسأل الدكتور.</div></div>
    <div class="soil-card"><h3>فحص عشوائي</h3>
      <div class="soil-tools"><button type="button" class="btn btn-sm btn-secondary" data-act="fuzz">شغّل 2000 حالة</button></div>
      <div id="rv-fuzz" class="soil-note">يتحقق أن حذف أي قيم من مدخلات كاملة لا يغيّر الجزء المحسوم من المسار، وأن النتيجة النهائية تبقى بين الاحتمالات.</div></div>
    <div class="soil-card"><h3>وصف نصي للمخططات (قارنه مع المحاضرة)</h3>
      <details><summary>المستوى 1: رمز المجموعة (ص35)</summary><pre style="${pre}">${esc(treeText(tree, USCS_ROOT))}</pre></details>
      ${nameRoots.map((id) => `<details><summary dir="ltr">المستوى 2: ${id.slice(5)}</summary><pre style="${pre}">${esc(treeText(tree, id))}</pre></details>`).join('')}</div>`;

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="fuzz"]')) {
      const { checks, fails } = fuzz(2000);
      root.querySelector('#rv-fuzz').innerHTML = fails.length
        ? `<div class="soil-warn">${fails.length} مخالفة من ${checks} فحص:<br>${fails.slice(0, 5).map(esc).join('<br>')}</div>`
        : `✓ ${checks} فحص بلا أي مخالفة.`;
    }
  });
  return root;
}
