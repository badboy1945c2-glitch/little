/**
 * solver.js - المحرك الذكي لحل العلاقات (القسم 3.3 من المواصفات)
 * تسلسل أمامي: يبحث عن معادلة فيها مجهول واحد فقط، يحلها، ويكرر.
 * الحل: صيغة مغلقة إن كانت المعادلة خطية بالمجهول، وإلا bisection ثم تحقق بالتعويض.
 */
import { parse } from 'mathjs';

const CONFLICT_TOLERANCE = 0.005;  // 0.5% (القسم 3.3 بند 5)
const DEFAULT_RANGE = { lo: 1e-12, hi: 1e12, geometric: true };

const fmt = (x) => String(Number(Number(x).toPrecision(6)));

export function createSolver({ equations, constants = {}, ranges = {} }) {
  const eqs = equations.map((e) => {
    const [lhs, rhs] = e.expr.split('=').map((s) => s.trim());
    const symbols = new Set();
    const nodes = [parse(lhs), parse(rhs)];
    nodes.forEach((n) => n.traverse((nd) => {
      if (nd.isSymbolNode && !(nd.name in constants)) symbols.add(nd.name);
    }));
    return { ...e, left: nodes[0].compile(), right: nodes[1].compile(), symbols: [...symbols] };
  });
  const allKeys = [...new Set(eqs.flatMap((e) => e.symbols))];

  const sides = (eq, scope) => [eq.left.evaluate(scope), eq.right.evaluate(scope)];
  const relErr = (l, r) => Math.abs(l - r) / Math.max(Math.abs(l), Math.abs(r), 1e-12);

  // حل معادلة لمجهول واحد. يرجع الرقم أو null
  function solveFor(eq, key, values) {
    const scope = { ...values };
    const f = (x) => { scope[key] = x; const [l, r] = sides(eq, scope); return l - r; };
    const range = ranges[key] || DEFAULT_RANGE;
    let x = null;

    // (1) صيغة مغلقة: إن كانت المعادلة خطية بالمجهول
    const f1 = f(1), f2 = f(2), f3 = f(3);
    if ([f1, f2, f3].every(Number.isFinite)) {
      const slope = f2 - f1;
      const mag = Math.abs(f1) + Math.abs(f2) + Math.abs(f3);
      if (Math.abs(f3 - 2 * f2 + f1) <= 1e-9 * (mag + 1e-300)) {
        if (Math.abs(slope) < 1e-12 * (mag + 1e-300)) return null; // لا تحدد المجهول
        x = 1 - f1 / slope;
        const tol = 1e-9;
        if (x < range.lo - tol || x > range.hi + tol) return null; // خارج النطاق الفيزيائي
      }
    }

    // (2) bisection إن لم تكن خطية
    if (x === null) {
      let lo = range.lo, hi = range.hi;
      let flo = f(lo);
      const fhi = f(hi);
      if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null;
      for (let i = 0; i < 400; i++) {
        const mid = range.geometric ? Math.sqrt(lo * hi) : (lo + hi) / 2;
        const fm = f(mid);
        if (!Number.isFinite(fm)) return null;
        if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; }
        const done = range.geometric ? hi / lo - 1 < 1e-14 : hi - lo < 1e-14 * Math.max(1, Math.abs(mid));
        if (done) break;
      }
      x = range.geometric ? Math.sqrt(lo * hi) : (lo + hi) / 2;
    }

    // (3) التحقق بالتعويض
    scope[key] = x;
    const [l, r] = sides(eq, scope);
    return Number.isFinite(x) && relErr(l, r) <= 1e-6 ? x : null;
  }

  // تعويض الأرقام في المعادلة (للعرض فقط)
  function substitute(expr, values, exceptKey) {
    let out = expr;
    [...allKeys].sort((a, b) => b.length - a.length).forEach((k) => {
      if (k !== exceptKey && k in values) out = out.replace(new RegExp(`\\b${k}\\b`, 'g'), `(${fmt(values[k])})`);
    });
    return out;
  }

  // known: { المفتاح: قيمة بالوحدات الداخلية }
  function solve(known) {
    const values = { ...constants, ...known };
    const steps = [];
    let progress = true;
    while (progress) {
      progress = false;
      for (const eq of eqs) {
        const unknown = eq.symbols.filter((s) => !(s in values));
        if (unknown.length !== 1) continue;
        const key = unknown[0];
        const x = solveFor(eq, key, values);
        if (x === null) continue;
        steps.push({ key, eqId: eq.id, expr: eq.expr, page: eq.page, name: eq.ar,
          substituted: substitute(eq.expr, values, key), value: x });
        values[key] = x;
        progress = true;
      }
    }
    // كشف التعارض: معادلة كل رموزها معلومة ولا تتحقق ضمن 0.5%
    const conflicts = [];
    for (const eq of eqs) {
      if (!eq.symbols.every((s) => s in values)) continue;
      const [l, r] = sides(eq, values);
      if (relErr(l, r) > CONFLICT_TOLERANCE) conflicts.push({ eqId: eq.id, expr: eq.expr, lhs: l, rhs: r });
    }
    const derived = {};
    steps.forEach((s) => { derived[s.key] = s.value; });
    return { values, derived, steps, conflicts, unknown: allKeys.filter((k) => !(k in values)) };
  }

  // ── اقتراح «ما ينقص» (إغلاق بنيوي بدون أرقام) ──
  function closure(knownKeys) {
    const have = new Set(knownKeys);
    let progress = true;
    while (progress) {
      progress = false;
      for (const eq of eqs) {
        const unknown = eq.symbols.filter((s) => !have.has(s));
        if (unknown.length === 1) { have.add(unknown[0]); progress = true; }
      }
    }
    return have;
  }

  // أقل إضافات (واحدة، وإلا اثنتان) تجعل حساب target ممكناً
  function suggest(target, knownKeys, limit = 6) {
    const known = new Set(knownKeys);
    if (closure(known).has(target)) return [];
    const free = allKeys.filter((k) => !known.has(k) && k !== target);
    const singles = free.filter((k) => closure(new Set([...known, k])).has(target)).map((k) => [k]);
    if (singles.length) return singles.slice(0, limit);
    const pairs = [];
    for (let i = 0; i < free.length && pairs.length < limit; i++) {
      for (let j = i + 1; j < free.length && pairs.length < limit; j++) {
        if (closure(new Set([...known, free[i], free[j]])).has(target)) pairs.push([free[i], free[j]]);
      }
    }
    return pairs;
  }

  return { solve, suggest, closure, allKeys, equations: eqs };
}