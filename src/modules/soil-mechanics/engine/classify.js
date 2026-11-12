/**
 * classify.js - محركات التصنيف الثلاثة: USCS وAASHTO وUSDA (القسم 6 من المواصفات)
 * كل محرك يرجع: { system, status, path, pendingNode, needs, candidates, result, assumptions, errors }
 *   status: 'invalid' | 'blocked' | 'partial' | 'complete'
 */
import aashtoData from '../data/aashto.json';
import { triEval, isKnown } from './tri-logic.js';
import { getUscsTree, USCS_ROOT } from './uscs-tree.js';

// ───────────── المدخلات والتحقق ─────────────
const KEYS = ['P4', 'P10', 'P40', 'F200', 'LL', 'PL', 'PI', 'D10', 'D30', 'D60', 'Cu', 'Cc', 'organicRatio'];
const PERCENT = ['P4', 'P10', 'P40', 'F200'];
const toNum = (v) => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};

function validate(raw = {}) {
  const errors = [], inp = {};
  for (const k of KEYS) {
    const v = toNum(raw[k]);
    if (v === undefined) continue;
    if (v < 0) errors.push(`${k} لا يمكن أن تكون سالبة`);
    else if (PERCENT.includes(k) && v > 100) errors.push(`${k} لا تزيد عن 100%`);
    inp[k] = v;
  }
  const chain = PERCENT.filter((k) => inp[k] !== undefined); // يجب أن تتناقص: P4 >= P10 >= P40 >= F200
  for (let i = 0; i + 1 < chain.length; i++) {
    if (inp[chain[i + 1]] > inp[chain[i]]) errors.push(`${chain[i]} يجب أن يكون ${chain[i + 1]} أو أكثر`);
  }
  if (inp.PL !== undefined && inp.LL !== undefined && inp.PL > inp.LL) errors.push('PL يجب ألا يتجاوز LL');
  inp.peat = !!raw.peat;
  inp.NP = !!raw.NP;
  return { errors, inp };
}

const hasAny = (inp) => KEYS.some((k) => inp[k] !== undefined) || inp.peat || inp.NP;

function deriveVars(inp) {
  const v = {}, assumptions = [];
  for (const k of KEYS) if (inp[k] !== undefined) v[k] = inp[k];
  if (v.P4 === undefined) {
    const k = ['P10', 'P40', 'F200'].find((x) => v[x] === 100);
    if (k) { v.P4 = 100; assumptions.push(`استُنتج P4 = 100% لأن ${k} = 100%`); }
  }
  if (v.PI === undefined) {
    if (inp.NP) v.PI = 0;
    else if (v.LL !== undefined && v.PL !== undefined) v.PI = v.LL - v.PL;
  }
  v.NP = inp.NP || v.PI === 0 ? 1 : (v.PI !== undefined ? 0 : undefined);
  if (v.Cu === undefined && v.D10 && v.D60 !== undefined) v.Cu = v.D60 / v.D10;
  if (v.Cc === undefined && v.D10 && v.D60 && v.D30 !== undefined) v.Cc = (v.D30 ** 2) / (v.D60 * v.D10);
  if (v.P4 !== undefined) v.gravel = 100 - v.P4;
  if (v.P4 !== undefined && v.F200 !== undefined) v.sand = v.P4 - v.F200;
  if (v.F200 !== undefined) v.plus200 = 100 - v.F200;
  if (v.LL !== undefined) v.aLine = 0.73 * (v.LL - 20);
  const ratio = v.organicRatio;
  v.isOrg = ratio !== undefined ? (ratio < 0.75 ? 1 : 0) : 0;
  v.peat = inp.peat ? 1 : 0;
  return { vars: v, assumptions, assumedOrganic: ratio === undefined };
}

// ───────────── ما ينقص (أسماء عربية) ─────────────
const NEED = {
  F200: [{ key: 'F200', ar: 'المار من منخل 200 (F200)' }],
  P4: [{ key: 'P4', ar: 'المار من منخل 4 (P4)' }],
  gravel: [{ key: 'P4', ar: 'المار من منخل 4 (P4)' }],
  sand: [{ key: 'P4', ar: 'المار من منخل 4 (P4)' }, { key: 'F200', ar: 'المار من منخل 200 (F200)' }],
  plus200: [{ key: 'F200', ar: 'المار من منخل 200 (F200)' }],
  LL: [{ key: 'LL', ar: 'الحد السائل (LL)' }],
  PI: [{ key: 'PI', ar: 'مؤشر اللدونة (PI) أو الحد اللدن (PL)' }],
  NP: [{ key: 'PI', ar: 'مؤشر اللدونة (PI) أو الحد اللدن (PL)' }],
  aLine: [{ key: 'LL', ar: 'الحد السائل (LL)' }],
  Cu: [{ key: 'Cu', ar: 'Cu (أو D10 وD60)' }],
  Cc: [{ key: 'Cc', ar: 'Cc (أو D10 وD30 وD60)' }],
  P10: [{ key: 'P10', ar: 'المار من منخل 10 (P10)' }],
  P40: [{ key: 'P40', ar: 'المار من منخل 40 (P40)' }],
  P200: [{ key: 'F200', ar: 'المار من منخل 200 (F200)' }]
};
function toNeeds(missing, vars = {}) {
  const seen = new Map();
  missing.flatMap((m) => NEED[m] || [{ key: m, ar: m }])
    .filter((n) => !isKnown(vars[n.key]))   // لا نطلب ما هو معلوم أصلاً
    .forEach((n) => seen.set(n.key, n));
  return [...seen.values()];
}

// ───────────── تقييم الشجرة (USCS) ─────────────
const fmtNum = (x) => String(Number(Number(x).toFixed(2)));
const fill = (txt, vars) => txt.replace(/\{(\w+)\}/g, (_, k) => (isKnown(vars[k]) ? fmtNum(vars[k]) : `{${k}}`));

function collectCandidates(tree, startId, vars) {
  const stage = tree[startId].stage;
  const out = new Map();
  const dfs = (id) => {
    const n = tree[id];
    if (n.leaf) {
      if (stage === 'symbol') { if (n.stage === 'symbol') out.set(n.symbol, { symbol: n.symbol }); return; }
      if (n.to) return dfs(n.to);
      out.set(`${n.symbol}|${n.name}`, { symbol: n.symbol, name: n.name });
      return undefined;
    }
    for (const b of n.branches) if (triEval(b.test, vars).value !== 'false') dfs(b.to);
    return undefined;
  };
  dfs(startId);
  return [...out.values()];
}

function evaluateTree(tree, rootId, vars, assumptions) {
  const path = [];
  let id = rootId;
  for (let guard = 0; guard < 80; guard++) {
    const node = tree[id];
    if (node.leaf) {
      path.push({ nodeId: id, kind: node.to ? 'symbol' : 'name', symbol: node.symbol, name: node.name });
      if (node.to) { id = node.to; continue; }
      return { status: 'complete', path, pendingNode: null, needs: [], candidates: [], result: { symbol: node.symbol, name: node.name } };
    }
    const evals = node.branches.map((b) => ({ b, e: triEval(b.test, vars) }));
    const hit = evals.find((x) => x.e.value === 'true');
    if (hit) {
      path.push({ nodeId: id, question: node.question, branchId: hit.b.id, label: hit.b.label,
        reasonAr: fill(hit.b.reasonAr, vars), source: node.source });
      if (hit.b.assumeIf && triEval(hit.b.assumeIf, vars).value === 'true') assumptions.push(hit.b.assumeAr);
      id = hit.b.to;
      continue;
    }
    const missing = [...new Set(evals.flatMap((x) => x.e.missing))];
    return { status: 'partial', path, pendingNode: id, needs: toNeeds(missing, vars),
      candidates: collectCandidates(tree, id, vars), result: null };
  }
  return { status: 'invalid', path, pendingNode: null, needs: [], candidates: [], result: null };
}

const empty = (system, status, extra = {}) => ({ system, status, path: [], pendingNode: null, needs: [], candidates: [], result: null, assumptions: [], errors: [], ...extra });

export function classifyUSCS(raw) {
  const { errors, inp } = validate(raw);
  if (errors.length) return empty('USCS', 'invalid', { errors });
  if (!hasAny(inp)) return empty('USCS', 'blocked');
  const { vars, assumptions, assumedOrganic } = deriveVars(inp);
  const r = evaluateTree(getUscsTree(), USCS_ROOT, vars, assumptions);
  if (assumedOrganic && r.path.some((s) => s.nodeId === 'uscs.fine.ll')) {
    assumptions.push('افتراض: التربة غير عضوية (لم تُدخل نسبة LL المجففة إلى غير المجففة)');
  }
  const fractions = isKnown(vars.gravel) && isKnown(vars.sand) ? { gravel: vars.gravel, sand: vars.sand, fines: vars.F200 } : null;
  return { system: 'USCS', ...r, assumptions, errors: [], vars, fractions };
}

// ───────────── AASHTO ─────────────
export function classifyAASHTO(raw) {
  const { errors, inp } = validate(raw);
  if (errors.length) return empty('AASHTO', 'invalid', { errors });
  if (!hasAny(inp)) return empty('AASHTO', 'blocked');
  const { vars: d } = deriveVars(inp);
  const assumptions = [];
  if (d.F200 === undefined) return empty('AASHTO', 'partial', { needs: toNeeds(['P200']) });

  // التقريب لأقرب عدد صحيح قبل المقارنات (افتراض) - ما عدا الفصل بين الحبيبي والغريني-الطيني فيعتمد القيمة الأصلية
  const r = (x) => (isKnown(x) ? Math.round(x) : undefined);
  const vars = { P10: r(d.P10), P40: r(d.P40), P200: r(d.F200), LL: r(d.LL), PI: r(d.PI), NP: d.NP };
  const changed = ['P10', 'P40', 'LL', 'PI'].some((k) => isKnown(d[k]) && d[k] !== vars[k]) || (d.F200 !== vars.P200);
  if (changed) assumptions.push('افتراض: قُرّبت القيم لأقرب عدد صحيح (جدول AASHTO بأعداد صحيحة)');

  const table = d.F200 <= 35 ? aashtoData.granular : aashtoData.siltClay;
  const tableKey = d.F200 <= 35 ? 'granular' : 'siltClay';
  const groups = [];
  let winner = null, stop = false;
  for (const g of table.groups) {
    const e = triEval(g.rule.replace(/\bNP\b/g, 'NP == 1'), vars);
    const status = stop ? 'skipped' : e.value;
    groups.push({ g: g.g, status, materials: g.materials, atoms: e.atoms, missing: e.missing });
    if (!stop && e.value === 'true') { winner = g; stop = true; }
  }
  const live = groups.filter((x) => x.status === 'true' || x.status === 'unknown');
  const cleanWin = winner && groups.slice(0, groups.findIndex((x) => x.g === winner.g)).every((x) => x.status === 'false');
  if (cleanWin) {
    const result = { group: winner.g, materials: winner.materials, rating: table.rating, table: tableKey };
    if (/^A-[4-7]/.test(winner.g) && isKnown(d.LL) && isKnown(d.PI)) {
      const raw = (d.F200 - 35) * (0.2 + 0.005 * (d.LL - 40)) + 0.01 * (d.F200 - 15) * (d.PI - 10);
      result.GI = Math.max(0, Math.round(raw));
      result.GIraw = raw;
      assumptions.push('افتراض: GI يُقرَّب لأقرب عدد صحيح وحده الأدنى صفر (عرف شائع غير مذكور في المحاضرة)');
    } else if (/^A-[4-7]/.test(winner.g)) {
      result.GInote = 'أدخل LL وPI لحساب GI';
    } else {
      result.GInote = 'لم تتناول المحاضرة حساب GI لهذه المجموعة';
    }
    return { system: 'AASHTO', status: 'complete', path: [], pendingNode: null, needs: [], candidates: [], result, groups, table: tableKey, assumptions, errors: [] };
  }
  const missing = [...new Set(live.flatMap((x) => x.missing))];
  return { system: 'AASHTO', status: 'partial', path: [], pendingNode: null, needs: toNeeds(missing, d),
    candidates: live.map((x) => ({ symbol: x.g })), result: null, groups, table: tableKey, assumptions, errors: [] };
}

// ───────────── USDA ─────────────
export const USDA_AR = {
  Sand: 'رمل', 'Loamy sand': 'رمل غريني', 'Sandy loam': 'طمي رملي', Loam: 'طمي', 'Silt loam': 'طمي غريني', Silt: 'غرين',
  'Sandy clay loam': 'طمي طيني رملي', 'Clay loam': 'طمي طيني', 'Silty clay loam': 'طمي طيني غريني',
  'Sandy clay': 'طين رملي', 'Silty clay': 'طين غريني', Clay: 'طين'
};

export function usdaName(sand, silt, clay) {
  if (silt + 1.5 * clay < 15) return 'Sand';
  if (silt + 1.5 * clay >= 15 && silt + 2 * clay < 30) return 'Loamy sand';
  if ((clay >= 7 && clay < 20 && sand > 52 && silt + 2 * clay >= 30) || (clay < 7 && silt < 50 && silt + 2 * clay >= 30)) return 'Sandy loam';
  if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52) return 'Loam';
  if ((silt >= 50 && clay >= 12 && clay < 27) || (silt >= 50 && silt < 80 && clay < 12)) return 'Silt loam';
  if (silt >= 80 && clay < 12) return 'Silt';
  if (clay >= 20 && clay < 35 && silt < 28 && sand > 45) return 'Sandy clay loam';
  if (clay >= 27 && clay < 40 && sand > 20 && sand <= 45) return 'Clay loam';
  if (clay >= 27 && clay < 40 && sand <= 20) return 'Silty clay loam';
  if (clay >= 35 && sand > 45) return 'Sandy clay';
  if (clay >= 40 && silt >= 40) return 'Silty clay';
  if (clay >= 40 && sand <= 45 && silt < 40) return 'Clay';
  return null;
}

export function classifyUSDA(raw = {}) {
  const v = { sand: toNum(raw.sand), silt: toNum(raw.silt), clay: toNum(raw.clay) };
  const gravel = toNum(raw.gravel) || 0;
  const errors = [], assumptions = [], warnings = [];
  for (const [k, x] of Object.entries({ ...v, gravel })) {
    if (x !== undefined && (x < 0 || x > 100)) errors.push(`${k} يجب أن تكون بين 0 و100`);
  }
  if (gravel >= 100) errors.push('الحصى لا يمكن أن يساوي 100%');
  if (errors.length) return empty('USDA', 'invalid', { errors });
  const keys = ['sand', 'silt', 'clay'];
  const known = keys.filter((k) => v[k] !== undefined);
  if (known.length === 0) return empty('USDA', 'blocked');
  if (known.length === 1) {
    return empty('USDA', 'partial', { needs: keys.filter((k) => v[k] === undefined).map((k) => ({ key: k, ar: { sand: 'نسبة الرمل', silt: 'نسبة الغرين', clay: 'نسبة الطين' }[k] })), assumptions });
  }
  if (known.length === 2) {
    const missing = keys.find((k) => v[k] === undefined);
    v[missing] = 100 - gravel - known.reduce((s, k) => s + v[k], 0);
    if (v[missing] < -0.05) return empty('USDA', 'invalid', { errors: ['مجموع النسب يتجاوز 100%'] });
    v[missing] = Math.max(0, v[missing]);
    assumptions.push(`اشتُقت نسبة ${{ sand: 'الرمل', silt: 'الغرين', clay: 'الطين' }[missing]} = ${fmtNum(v[missing])}% لأن المجموع 100%`);
  } else if (Math.abs(v.sand + v.silt + v.clay + gravel - 100) > 0.5) {
    warnings.push('مجموع النسب لا يساوي 100%');
  }
  const k = gravel > 0 ? 100 / (100 - gravel) : 1;
  const c = { sand: v.sand * k, silt: v.silt * k, clay: v.clay * k };
  if (gravel > 0) assumptions.push(`صُحّحت النسب بعد استبعاد الحصى ${fmtNum(gravel)}% (ص 32)`);
  const name = usdaName(c.sand, c.silt, c.clay);
  if (!name) return empty('USDA', 'invalid', { errors: ['النقطة تقع على حد بين منطقتين في القاعدة المعتمدة؛ راجع المخطط'], corrected: c });
  return { system: 'USDA', status: 'complete', path: [], pendingNode: null, needs: [], candidates: [], assumptions,
    errors: [], warnings, corrected: c, result: { name, nameAr: USDA_AR[name] } };
}

export const classifyAll = (raw) => ({ uscs: classifyUSCS(raw), aashto: classifyAASHTO(raw) });