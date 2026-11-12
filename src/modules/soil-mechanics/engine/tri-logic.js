/**
 * tri-logic.js - تقييم الشروط بثلاث قيم: true / false / unknown (القسم 6.0 من المواصفات)
 * الشرط نص بسيط: ذرات مقارنة تُفصل بـ && و || (بدون أقواس). مثال: "F200 >= 5 && F200 <= 12"
 * منطق Kleene: (false && unknown) = false  و  (true || unknown) = true
 */
import { parse } from 'mathjs';

const cache = new Map();
function compileTest(test) {
  if (!cache.has(test)) {
    cache.set(test, test.split('||').map((orPart) => orPart.split('&&').map((raw) => {
      const atom = raw.trim();
      const node = parse(atom);
      const symbols = new Set();
      node.traverse((n) => { if (n.isSymbolNode) symbols.add(n.name); });
      return { atom, code: node.compile(), symbols: [...symbols] };
    })));
  }
  return cache.get(test);
}

export const isKnown = (v) => typeof v === 'number' && Number.isFinite(v);

function evalAtom(a, vars) {
  const missing = a.symbols.filter((s) => !isKnown(vars[s]));
  if (missing.length) return { atom: a.atom, value: 'unknown', missing };
  return { atom: a.atom, value: a.code.evaluate(vars) ? 'true' : 'false', missing: [] };
}

// يرجع { value, atoms: [{atom, value}], missing: [أسماء الرموز الناقصة] }
export function triEval(test, vars) {
  const atoms = [];
  const missing = new Set();
  let orValue = 'false';
  for (const group of compileTest(test)) {
    const res = group.map((a) => evalAtom(a, vars));
    atoms.push(...res);
    let andValue = 'true';
    for (const r of res) {
      if (r.value === 'false') { andValue = 'false'; break; }
      if (r.value === 'unknown') andValue = 'unknown';
    }
    if (andValue === 'true') orValue = 'true';
    else if (andValue === 'unknown') {
      if (orValue !== 'true') orValue = 'unknown';
      res.forEach((r) => r.missing.forEach((m) => missing.add(m)));
    }
  }
  return { value: orValue, atoms, missing: orValue === 'unknown' ? [...missing] : [] };
}